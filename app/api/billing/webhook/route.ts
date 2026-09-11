import { NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  recipientFor,
  sendCancellationReverted,
  sendCancellationScheduled,
  sendPaymentFailed,
  sendPaymentReceipt,
  sendPlanChanged,
  sendSubscriptionEnded,
  sendSubscriptionStarted,
} from "@/agent/lib/billing-email.ts";
import { db } from "@/agent/lib/db.ts";
import { getStripe, planForLookupKey, planFromMetadata } from "@/app/lib/stripe";
import { CURRENT_PLAN_VERSION, isPlanId, type PlanId } from "@/lib/entitlements";

/**
 * The only writer of `Billing.plan`.
 *
 * A checkout `success_url` is a URL in the address bar — anybody can type it,
 * and nothing about landing on it says money moved. A signed webhook is the
 * only statement from Stripe that this app can act on.
 */

/** Static: the signature is computed over the exact bytes Stripe sent. */
export const dynamic = "force-dynamic";

/**
 * Where a subscription's period lives.
 *
 * Recent API versions moved `current_period_start`/`end` off the subscription
 * and onto its items, because a subscription with several items can have
 * several periods. Read the item first and fall back to the old top-level
 * field, so the same code survives whichever version the account is pinned to.
 */
function periodOf(subscription: Stripe.Subscription): { start: Date | null; end: Date | null } {
  const item = subscription.items.data[0] as
    | (Stripe.SubscriptionItem & { current_period_start?: number; current_period_end?: number })
    | undefined;
  const legacy = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };

  const start = item?.current_period_start ?? legacy.current_period_start ?? null;
  const end = item?.current_period_end ?? legacy.current_period_end ?? null;

  return {
    start: start === null ? null : new Date(start * 1000),
    end: end === null ? null : new Date(end * 1000),
  };
}

/** Our user id for a Stripe subscription: its metadata first, then the customer. */
async function userIdFor(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.userId;
  if (typeof fromMetadata === "string" && fromMetadata.length > 0) return fromMetadata;

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const row = await db.billing.findUnique({
    where: { stripeCustomerId: customerId },
    select: { userId: true },
  });
  return row?.userId ?? null;
}

/**
 * Writes one subscription's state onto the billing row.
 *
 * `canceled` drops the plan to free immediately, because by the time Stripe
 * sends it the period the user paid for has already run out — a cancellation
 * scheduled for the end of the month arrives as an `updated` with
 * `cancel_at_period_end`, and that one keeps the plan.
 */
async function applySubscription(subscription: Stripe.Subscription): Promise<void> {
  const userId = await userIdFor(subscription);
  if (!userId) return;

  /*
   * The subscription item carries the whole Price object, lookup key included,
   * so the plan is readable straight off the event — no catalogue fetch, and
   * no dependence on a price id that differs per account and per mode.
   *
   * Metadata is the fallback for a subscription created before the price was
   * given a lookup key, or one made by hand in the dashboard.
   */
  const price = subscription.items.data[0]?.price ?? null;
  const canceled =
    subscription.status === "canceled" || subscription.status === "incomplete_expired";
  const plan = canceled
    ? "free"
    : (planForLookupKey(price?.lookup_key) ?? planFromMetadata(subscription.metadata) ?? "free");
  const priceId = price?.id ?? null;

  const period = periodOf(subscription);
  const versionFromMetadata = Number(subscription.metadata?.planVersion);
  const planVersion = Number.isInteger(versionFromMetadata)
    ? versionFromMetadata
    : CURRENT_PLAN_VERSION;

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const data = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    plan,
    // A downgrade to free must not rewrite the version someone bought: they
    // may resubscribe, and their old row is the record of what they were sold.
    ...(canceled ? {} : { planVersion }),
    status: subscription.status,
    periodStart: period.start,
    periodEnd: period.end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };

  /*
   * The state before this event, read for the sake of the email.
   *
   * A Stripe subscription event says what things are now, never what they
   * were, so "upgraded", "cancellation scheduled" and "plan ended" are all the
   * same `customer.subscription.updated` until you diff against the row. This
   * read is the difference between four useful emails and none.
   */
  const before = await db.billing.findUnique({
    where: { userId },
    select: { plan: true, cancelAtPeriodEnd: true },
  });

  await db.billing.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  await notifyOfChange({
    userId,
    before: before ?? { plan: "free", cancelAtPeriodEnd: false },
    after: { plan, cancelAtPeriodEnd: subscription.cancel_at_period_end },
    periodEnd: period.end,
  });
}

/**
 * Turns a before/after pair into at most one email.
 *
 * At most one on purpose: a downgrade that also clears a scheduled
 * cancellation is one thing that happened to the customer, and two emails
 * about it reads as a broken system. The order below is the order of
 * importance to the person receiving it.
 */
async function notifyOfChange(change: {
  userId: string;
  before: { plan: string; cancelAtPeriodEnd: boolean };
  after: { plan: string; cancelAtPeriodEnd: boolean };
  periodEnd: Date | null;
}): Promise<void> {
  const { before, after, periodEnd } = change;
  if (before.plan === after.plan && before.cancelAtPeriodEnd === after.cancelAtPeriodEnd) return;

  const to = await recipientFor(change.userId);
  if (!to) return;

  const wasPaid = isPlanId(before.plan) && before.plan !== "free";
  const isPaid = isPlanId(after.plan) && after.plan !== "free";

  // 4. Ended.
  if (wasPaid && !isPaid) {
    await sendSubscriptionEnded(to, before.plan as PlanId);
    return;
  }

  // 1. Started.
  if (!wasPaid && isPaid) {
    await sendSubscriptionStarted(to, after.plan as PlanId, periodEnd);
    return;
  }

  // 2. Moved between paid plans.
  if (wasPaid && isPaid && before.plan !== after.plan) {
    await sendPlanChanged(to, before.plan as PlanId, after.plan as PlanId, periodEnd);
    return;
  }

  // 3 and 5. Cancellation scheduled, or taken back.
  if (isPaid && before.cancelAtPeriodEnd !== after.cancelAtPeriodEnd) {
    await (after.cancelAtPeriodEnd
      ? sendCancellationScheduled(to, after.plan as PlanId, periodEnd)
      : sendCancellationReverted(to, after.plan as PlanId, periodEnd));
  }
}

/**
 * The subscription reference moved off the invoice and onto its lines in
 * recent API versions, so it is read defensively rather than by one path.
 */
type InvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
};

function subscriptionIdOf(invoice: InvoiceWithSubscription): string | null {
  if (typeof invoice.subscription === "string") return invoice.subscription;
  if (invoice.subscription?.id) return invoice.subscription.id;

  const line = invoice.lines?.data[0] as
    | { subscription?: string | { id: string } | null }
    | undefined;
  if (typeof line?.subscription === "string") return line.subscription;
  return line?.subscription?.id ?? null;
}

/** Who an invoice email goes to, and which plan it is about. */
async function invoiceContext(invoice: InvoiceWithSubscription): Promise<{
  to: NonNullable<Awaited<ReturnType<typeof recipientFor>>>;
  plan: PlanId;
  periodEnd: Date | null;
} | null> {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : (invoice.customer?.id ?? null);
  if (!customerId) return null;

  const row = await db.billing.findUnique({
    where: { stripeCustomerId: customerId },
    select: { userId: true, plan: true, periodEnd: true },
  });
  if (!row || !isPlanId(row.plan) || row.plan === "free") return null;

  const to = await recipientFor(row.userId);
  if (!to) return null;

  return { to, plan: row.plan, periodEnd: row.periodEnd };
}

/** Top-up credit packs: a one-off payment, not a subscription. */
async function applyCreditPurchase(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId;
  const credits = Number(session.metadata?.credits);
  if (!userId || !Number.isInteger(credits) || credits <= 0) return;

  await db.billing.upsert({
    where: { userId },
    create: { userId, credits },
    update: { credits: { increment: credits } },
  });
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "not_configured" }, { status: 400 });
  }

  // The raw bytes, not `request.json()`: the signature covers the exact body,
  // and a parse-and-restringify changes it enough to fail every time.
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, secret);
  } catch (cause) {
    console.warn("stripe webhook: bad signature", cause);
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  /*
   * Idempotency, claimed before any work. Stripe retries a failed delivery for
   * three days, and a replayed `checkout.session.completed` would otherwise
   * grant a second month or a second pack of credits. The insert is the lock:
   * whoever wins the primary key does the work, everyone else returns 200 and
   * lets Stripe stop retrying.
   */
  try {
    await db.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "payment") {
          await applyCreditPurchase(session);
          break;
        }
        if (session.mode === "subscription" && session.subscription) {
          const id =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          // Re-fetched rather than trusted from the event: the session's copy
          // predates anything the subscription did in the seconds since.
          await applySubscription(await getStripe().subscriptions.retrieve(id));
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscription(event.data.object);
        break;

      case "invoice.payment_failed": {
        // Stripe also sends a `subscription.updated` for this, but not always
        // first. Recording it here means the banner is up by the time the user
        // notices the email.
        const invoice = event.data.object as InvoiceWithSubscription;
        const id = subscriptionIdOf(invoice);
        if (id) await applySubscription(await getStripe().subscriptions.retrieve(id));

        const context = await invoiceContext(invoice);
        if (context) {
          await sendPaymentFailed(
            context.to,
            context.plan,
            (invoice.amount_due ?? 0) / 100,
            invoice.currency,
          );
        }
        break;
      }

      case "invoice.payment_succeeded": {
        /*
         * Receipt only — this event changes nothing about the plan, which the
         * accompanying `subscription.updated` has already settled.
         *
         * Stripe can send its own receipts (Settings → Billing → Customer
         * emails). Leave that switch off, or every payment arrives twice.
         */
        const invoice = event.data.object as InvoiceWithSubscription;
        const context = await invoiceContext(invoice);
        if (context) {
          await sendPaymentReceipt({
            to: context.to,
            plan: context.plan,
            amount: (invoice.amount_paid ?? invoice.total ?? 0) / 100,
            currency: invoice.currency,
            invoiceNumber: invoice.number ?? null,
            hostedUrl: invoice.hosted_invoice_url ?? null,
            periodEnd: context.periodEnd,
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (cause) {
    /*
     * Drop the idempotency claim so Stripe's retry can have another go — a
     * half-applied event that can never be redelivered is worse than a
     * duplicate delivery, which the claim above already handles.
     */
    await db.stripeEvent.delete({ where: { id: event.id } }).catch(() => {});
    console.error("stripe webhook: handler failed", event.type, cause);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
