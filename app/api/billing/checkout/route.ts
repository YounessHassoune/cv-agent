import { NextResponse } from "next/server";
import { z } from "zod";

import { getBilling } from "@/agent/lib/billing.ts";
import { db } from "@/agent/lib/db.ts";
import { getCurrentUser } from "@/app/lib/current-user";
import { appUrl, getStripe, priceIdFor } from "@/app/lib/stripe";
import { CURRENT_PLAN_VERSION } from "@/lib/entitlements";

const Body = z.object({
  plan: z.enum(["pro", "max"]),
  interval: z.enum(["monthly", "yearly"]).default("monthly"),
});

/**
 * Opens a Stripe Checkout session and hands back its URL.
 *
 * The session carries `metadata.userId` and `metadata.plan` because the
 * webhook is the only thing that may grant a plan, and it needs to know whose
 * plan to grant without trusting the browser that comes back. `client_reference_id`
 * carries the same id for the dashboard's benefit.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { plan, interval } = parsed.data;
  const stripe = getStripe();
  const billing = await getBilling(user.userId);

  /*
   * One Stripe customer per user, forever. Letting Checkout mint a fresh one
   * each time is how an account ends up with three customers, two live
   * subscriptions and a portal that shows only one of them.
   */
  let customerId = billing.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId: user.userId },
    });
    customerId = customer.id;
    await db.billing.upsert({
      where: { userId: user.userId },
      create: { userId: user.userId, stripeCustomerId: customerId },
      update: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: await priceIdFor(plan, interval), quantity: 1 }],
    client_reference_id: user.userId,
    metadata: { userId: user.userId, plan, planVersion: String(CURRENT_PLAN_VERSION) },
    // Copied onto the subscription itself, so a `customer.subscription.updated`
    // that arrives without a checkout session can still say what it is for.
    subscription_data: {
      metadata: { userId: user.userId, plan, planVersion: String(CURRENT_PLAN_VERSION) },
    },
    allow_promotion_codes: true,
    // Stripe Tax works out VAT and sales tax from the address collected here.
    // Collecting it later means re-asking customers who have already paid.
    billing_address_collection: "auto",
    success_url: appUrl("/dashboard/billing?checkout=success"),
    cancel_url: appUrl("/dashboard/pricing?checkout=cancelled"),
  });

  if (!session.url) {
    return NextResponse.json({ error: "no_checkout_url" }, { status: 502 });
  }

  return NextResponse.json({ url: session.url });
}
