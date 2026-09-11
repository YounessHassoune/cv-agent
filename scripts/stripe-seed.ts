import Stripe from "stripe";
import { entitlements, PLAN_IDS } from "../lib/entitlements.ts";

/**
 * Makes this app's plans resolvable in Stripe, once.
 *
 * The app addresses prices by lookup key — `pro_monthly`, `max_yearly` — so a
 * price is invisible to it until one is set, and a checkout against a plan with
 * no key fails with "No active Stripe Price with lookup key". Setting four of
 * them by hand means a field three clicks deep in the dashboard, where a typo
 * surfaces only as a broken checkout.
 *
 * Three cases, in order:
 *
 *   1. The lookup key already resolves — left exactly as it is.
 *   2. A price exists with the right amount and interval but no key — adopted,
 *      by setting the key on it. A price's *amount* is immutable, but its key
 *      is not, which is what makes prices created by hand in the dashboard
 *      usable without recreating them.
 *   3. Nothing matches — product and price created.
 *
 * Idempotent, so running it twice is safe and running it after adding a plan
 * creates only what is missing.
 *
 *   node --env-file=.env scripts/stripe-seed.ts
 */

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Set STRIPE_SECRET_KEY in .env first.");
  process.exit(1);
}

/*
 * Live keys are refused. This writes billing objects, and the one thing that
 * must never happen by accident is a half-considered price appearing on a live
 * account where real customers can be charged against it.
 */
if (!key.startsWith("sk_test_")) {
  console.error(
    "Refusing to run: STRIPE_SECRET_KEY is not a test key. Set up live prices in the Stripe dashboard deliberately.",
  );
  process.exit(1);
}

const stripe = new Stripe(key);

const CURRENCY = "usd";
const INTERVALS = [
  { name: "monthly", stripe: "month" },
  { name: "yearly", stripe: "year" },
] as const;

const paidPlans = PLAN_IDS.filter((id) => id !== "free");

// Everything currently on the account, read once rather than per plan.
const [{ data: livePrices }, { data: liveProducts }] = await Promise.all([
  stripe.prices.list({ active: true, limit: 100 }),
  stripe.products.list({ active: true, limit: 100 }),
]);

const productIdOf = (price: Stripe.Price): string =>
  typeof price.product === "string" ? price.product : price.product.id;

for (const plan of paidPlans) {
  const limits = entitlements(plan);

  for (const interval of INTERVALS) {
    const lookupKey = `${plan}_${interval.name}`;
    const amount =
      interval.name === "yearly" ? limits.fallbackPriceYearly : limits.fallbackPriceMonthly;

    // 1. Already resolvable.
    const keyed = livePrices.find((price) => price.lookup_key === lookupKey);
    if (keyed) {
      console.log(`= ${lookupKey.padEnd(14)} ok       ${keyed.id}`);
      continue;
    }

    // 2. An unkeyed price that is already the right money. Adopt it: recreating
    //    would leave a duplicate at the same amount, and the dashboard gives no
    //    hint which of the two anybody is being charged.
    const orphan = livePrices.find(
      (price) =>
        !price.lookup_key &&
        price.unit_amount === amount * 100 &&
        price.currency === CURRENCY &&
        price.recurring?.interval === interval.stripe,
    );
    if (orphan) {
      const updated = await stripe.prices.update(orphan.id, {
        lookup_key: lookupKey,
        metadata: { plan, interval: interval.name },
      });
      // Keep the local copy in step so a later iteration cannot adopt it twice.
      orphan.lookup_key = updated.lookup_key;
      console.log(`~ ${lookupKey.padEnd(14)} adopted  ${orphan.id}  ${amount} ${CURRENCY}`);
      continue;
    }

    // 3. Nothing to reuse. Prefer a product that already carries one of this
    //    plan's prices, then one named for the plan, before making another.
    const sibling = livePrices.find((price) => price.lookup_key?.startsWith(`${plan}_`));
    const named = liveProducts.find((product) => product.name === `Wellsuited ${limits.label}`);

    let productId = sibling ? productIdOf(sibling) : named?.id;
    if (!productId) {
      const product = await stripe.products.create({
        name: `Wellsuited ${limits.label}`,
        description: limits.tagline,
        metadata: { plan },
      });
      productId = product.id;
      liveProducts.push(product);
      console.log(`+ product ${product.id}  Wellsuited ${limits.label}`);
    }

    const price = await stripe.prices.create({
      product: productId,
      // Stripe counts in the currency's smallest unit.
      unit_amount: amount * 100,
      currency: CURRENCY,
      recurring: { interval: interval.stripe },
      lookup_key: lookupKey,
      metadata: { plan, interval: interval.name },
    });
    livePrices.push(price);

    console.log(`+ ${lookupKey.padEnd(14)} created  ${price.id}  ${amount} ${CURRENCY}`);
  }
}

console.log(
  "\nDone. Restart `next dev`: the price catalogue is cached in-process, so a running server may still be holding the empty result it got before this.",
);
