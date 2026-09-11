import Stripe from "stripe";
import { isPlanId, type PlanId } from "@/lib/entitlements";

/**
 * The Stripe client, and the catalogue of what each plan actually costs.
 *
 * Prices are addressed by **lookup key**, not by id. A Price object is
 * immutable and its id differs between test mode, live mode and every account
 * that ever clones this project, so an id in code or in env is four values
 * pretending to be one. A lookup key — `pro_monthly` — is a name we choose,
 * stays the same everywhere, and moves to the new Price when a price changes.
 *
 * The amount comes back with it, which is the point: the pricing page prints
 * what Stripe will charge rather than a number typed into a constant beside it.
 * Two sources of truth for a price is how a page advertises $12 and the card
 * gets billed $15.
 *
 * No `apiVersion` is passed: the SDK pins the version it was built against, and
 * naming a different one here would mean this file and the type definitions
 * disagree about the shape of every object.
 */

let client: Stripe | null = null;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in .env, and give each Price a lookup key in the Stripe dashboard.",
    );
  }

  /*
   * A sandbox key in production would take real customers through a checkout
   * that never charges anybody and hand them a paid plan for free. It is the
   * one billing mistake that is silent from both sides, so it fails loudly
   * here instead.
   */
  if (process.env.NODE_ENV === "production" && key.startsWith("sk_test_")) {
    throw new Error(
      "Refusing to start: STRIPE_SECRET_KEY is a test key and NODE_ENV is production.",
    );
  }

  client ??= new Stripe(key);
  return client;
}

export type BillingInterval = "monthly" | "yearly";
export type PaidPlanId = Exclude<PlanId, "free">;

export const PAID_PLANS: readonly PaidPlanId[] = ["pro", "max"];
export const INTERVALS: readonly BillingInterval[] = ["monthly", "yearly"];

/** The name to give a Price in the dashboard, e.g. `pro_monthly`. */
export function lookupKeyFor(plan: PaidPlanId, interval: BillingInterval): string {
  return `${plan}_${interval}`;
}

/** The plan a lookup key belongs to, or null if it is not one of ours. */
export function planForLookupKey(key: string | null | undefined): PlanId | null {
  const plan = key?.split("_")[0];
  return isPlanId(plan) && plan !== "free" ? plan : null;
}

export type PriceInfo = {
  readonly id: string;
  /** Whole currency units — 12, not 1200. */
  readonly amount: number;
  /** Lowercase ISO code, as Stripe reports it. */
  readonly currency: string;
};

/** What each paid plan costs, per interval. A missing entry has no live Price. */
export type PriceCatalog = Partial<Record<PaidPlanId, Partial<Record<BillingInterval, PriceInfo>>>>;

/**
 * Cached because the catalogue is read on every render of the landing page,
 * the pricing page and the dashboard layout, and prices change a few times a
 * year at most. Five minutes is short enough that a correction in the dashboard
 * shows up while you are still looking at the dashboard.
 */
const CACHE_MS = 5 * 60 * 1000;

/**
 * An empty result is cached for seconds, not minutes.
 *
 * Empty means one of two things, and both of them get fixed within a minute of
 * being noticed: nothing has a lookup key yet, or Stripe was briefly
 * unreachable. Holding "there are no prices" for five minutes after either is
 * repaired turns a solved problem into a mystery.
 */
const EMPTY_CACHE_MS = 15 * 1000;

let cache: { at: number; catalog: PriceCatalog } | null = null;

/**
 * Every active Price we have named, in one call.
 *
 * Returns an empty catalogue rather than throwing when Stripe is unconfigured
 * or unreachable: a marketing page that 500s because a billing provider is
 * having a bad afternoon is a worse outcome than one showing fallback prices.
 * Callers fall back to the figures in `lib/entitlements.ts`.
 */
export async function getPriceCatalog(): Promise<PriceCatalog> {
  if (!stripeConfigured()) return {};
  if (cache) {
    const ttl = Object.keys(cache.catalog).length > 0 ? CACHE_MS : EMPTY_CACHE_MS;
    if (Date.now() - cache.at < ttl) return cache.catalog;
  }

  const keys = PAID_PLANS.flatMap((plan) =>
    INTERVALS.map((interval) => lookupKeyFor(plan, interval)),
  );

  try {
    const { data } = await getStripe().prices.list({
      lookup_keys: keys,
      active: true,
      limit: keys.length,
    });

    const catalog: PriceCatalog = {};
    for (const price of data) {
      const plan = planForLookupKey(price.lookup_key);
      const interval = price.recurring?.interval === "year" ? "yearly" : "monthly";
      if (!plan || plan === "free" || price.unit_amount === null) continue;

      catalog[plan] ??= {};
      catalog[plan][interval] = {
        id: price.id,
        // Stripe counts in the currency's smallest unit. Zero-decimal
        // currencies (JPY and friends) would need a divisor of 1 here.
        amount: price.unit_amount / 100,
        currency: price.currency,
      };
    }

    cache = { at: Date.now(), catalog };
    return catalog;
  } catch (cause) {
    console.warn("stripe: could not load the price catalogue", cause);
    return {};
  }
}

/**
 * The Price id to charge. Throws rather than guessing — a checkout against the
 * wrong price is worse than a checkout that does not open.
 */
export async function priceIdFor(plan: PaidPlanId, interval: BillingInterval): Promise<string> {
  const catalog = await getPriceCatalog();
  const price = catalog[plan]?.[interval];
  if (!price) {
    throw new Error(
      `No active Stripe Price with lookup key "${lookupKeyFor(plan, interval)}". Create the Price in Stripe and set that lookup key on it.`,
    );
  }
  return price.id;
}

export type InvoiceSummary = {
  readonly id: string;
  /** Stripe's human-facing number, e.g. `B1C2D3-0001`. Null while a draft. */
  readonly number: string | null;
  /** ISO string — a server component cannot hand a Date to the client. */
  readonly created: string;
  /** Whole currency units. */
  readonly amount: number;
  readonly currency: string;
  /** draft | open | paid | uncollectible | void */
  readonly status: string;
  /** Stripe-hosted receipt page. Null for a draft that has never been sent. */
  readonly hostedUrl: string | null;
  readonly pdfUrl: string | null;
};

/**
 * The last year of invoices.
 *
 * Receipts only. Cards, failed-payment retries, cancellations and disputes all
 * stay in Stripe's own portal — each is a PCI surface and a regulatory
 * obligation there is no reason to take on, and Stripe's screens for them are
 * better than anything worth building here. What this buys is the one part a
 * portal is bad at: seeing, without leaving the app, that you were charged what
 * you expected.
 *
 * Returns empty rather than throwing. A billing page that 500s because Stripe
 * is slow is worse than one that shows the plan and nothing else.
 */
export async function getInvoices(
  customerId: string | null | undefined,
): Promise<readonly InvoiceSummary[]> {
  if (!customerId || !stripeConfigured()) return [];

  try {
    const { data } = await getStripe().invoices.list({ customer: customerId, limit: 12 });
    return data.map((invoice) => ({
      id: invoice.id ?? "",
      number: invoice.number ?? null,
      created: new Date(invoice.created * 1000).toISOString(),
      // `amount_paid` would read 0 on an open invoice, which is the one a user
      // most wants the figure for.
      amount: (invoice.amount_due ?? invoice.total ?? 0) / 100,
      currency: invoice.currency,
      status: invoice.status ?? "draft",
      hostedUrl: invoice.hosted_invoice_url ?? null,
      pdfUrl: invoice.invoice_pdf ?? null,
    }));
  } catch (cause) {
    console.warn("stripe: could not list invoices", cause);
    return [];
  }
}

/** The plan id stamped into checkout metadata, if it is one we know. */
export function planFromMetadata(metadata: Stripe.Metadata | null | undefined): PlanId | null {
  const value = metadata?.plan;
  return isPlanId(value) ? value : null;
}

/** Absolute origin for checkout return URLs. */
export { appUrl } from "@/lib/app-url";
