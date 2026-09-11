import { NextResponse } from "next/server";

import { getBilling } from "@/agent/lib/billing.ts";
import { getCurrentUser } from "@/app/lib/current-user";
import { appUrl, getStripe } from "@/app/lib/stripe";

/**
 * Sends the user to Stripe's own billing portal.
 *
 * Cancelling, switching monthly to yearly, changing a card, downloading
 * invoices and fixing a failed payment all live there. Rebuilding any of it
 * here would mean reimplementing proration, dunning and tax receipts — badly,
 * and with a second chance to get someone's money wrong.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const billing = await getBilling(user.userId);
  if (!billing.stripeCustomerId) {
    // Nobody has ever paid, so there is nothing to manage.
    return NextResponse.json({ error: "no_customer" }, { status: 404 });
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: billing.stripeCustomerId,
    return_url: appUrl("/dashboard/settings"),
  });

  return NextResponse.json({ url: session.url });
}
