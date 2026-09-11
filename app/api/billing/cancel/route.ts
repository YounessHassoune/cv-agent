import { NextResponse } from "next/server";
import { z } from "zod";

import { getBilling } from "@/agent/lib/billing.ts";
import { db } from "@/agent/lib/db.ts";
import { getCurrentUser } from "@/app/lib/current-user";
import { getStripe } from "@/app/lib/stripe";

const Body = z.object({
  /** true puts a scheduled cancellation back, false schedules one. */
  resume: z.boolean().default(false),
});

/**
 * Cancels at the end of the paid period, or takes that back.
 *
 * Never an immediate cancellation. Somebody who cancels on day 3 of a month
 * they have already paid for should keep the other 27 days — ending it on the
 * spot is taking money for nothing, and it is the fastest route to a chargeback.
 * Stripe models this as `cancel_at_period_end`, and `planOf()` already keeps a
 * plan alive until `periodEnd` passes.
 *
 * `cancelAtPeriodEnd` is written here as well as by the webhook. That does not
 * break the rule that the webhook alone writes `plan` — this flag is not the
 * plan, and a user who clicks Cancel needs the page to say so before Stripe's
 * event has made the round trip.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const billing = await getBilling(user.userId);
  if (!billing.stripeSubscriptionId) {
    return NextResponse.json({ error: "no_subscription" }, { status: 404 });
  }

  const { resume } = parsed.data;

  try {
    const subscription = await getStripe().subscriptions.update(billing.stripeSubscriptionId, {
      cancel_at_period_end: !resume,
    });

    await db.billing.update({
      where: { userId: user.userId },
      data: { cancelAtPeriodEnd: subscription.cancel_at_period_end },
    });

    return NextResponse.json({
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      status: subscription.status,
    });
  } catch (cause) {
    console.error("billing: could not change the cancellation", cause);
    return NextResponse.json({ error: "stripe_failed" }, { status: 502 });
  }
}
