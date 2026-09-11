import type { Metadata } from "next";

import { billingState } from "@/agent/lib/billing.ts";
import { requireUser } from "@/app/lib/current-user";
import { getPriceCatalog } from "@/app/lib/stripe";
import { PricingCards } from "@/components/pricing-cards";

export const metadata: Metadata = { title: "Plans · Wellsuited" };
export const dynamic = "force-dynamic";

/**
 * The plans, inside the app.
 *
 * The same cards as the public page, but reached without leaving the sidebar.
 * Sending a signed-in user out to the marketing site to look at a price drops
 * them into a different layout with a "Sign in" header, which reads as having
 * been logged out.
 *
 * The copy differs from the public page for the same reason: somebody already
 * using the product does not need to be told what it is, only where their
 * current plan runs out.
 */
export default async function DashboardPricingPage() {
  const user = await requireUser();
  const [state, prices] = await Promise.all([billingState(user.userId), getPriceCatalog()]);

  const used = Math.min(state.usage.applications, state.limits.applications);
  const spent = state.usage.applications >= state.limits.applications;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8 md:py-10">
      <div className="space-y-1 pb-8">
        <h1 className="font-semibold text-2xl tracking-tight">Plans</h1>
        <p className="text-muted-foreground text-sm">
          {spent
            ? `You have used all ${state.limits.applications} ${state.limits.applications === 1 ? "application" : "applications"} on ${state.limits.label}. A larger plan starts them again.`
            : `${used} of ${state.limits.applications} ${state.limits.applications === 1 ? "application" : "applications"} used on ${state.limits.label}.`}
        </p>
      </div>

      <PricingCards currentPlan={state.plan} prices={prices} />
    </div>
  );
}
