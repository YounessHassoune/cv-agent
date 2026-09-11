import type { ReactNode } from "react";

import { billingState } from "@/agent/lib/billing.ts";
import { initialsOf, requireUser } from "@/app/lib/current-user";
import { profileCompleteness } from "@/app/lib/profile-completeness";
import { getPriceCatalog } from "@/app/lib/stripe";
import { PlanProvider, type PlanSnapshot } from "@/components/plan-provider";
import { ProfileNudge } from "./_components/profile-nudge";
import { Sidebar, SidebarProvider } from "./_components/sidebar";
import { Topbar } from "./_components/topbar";

export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const user = await requireUser();
  const [completeness, billing, prices] = await Promise.all([
    profileCompleteness(user.userId),
    billingState(user.userId),
    getPriceCatalog(),
  ]);

  /*
   * Resolved once per navigation and handed down, rather than fetched by every
   * lock that needs it. A plan is read by the template picker, the score card,
   * the chat composer and the sidebar meter on the same screen; that is four
   * round trips for one fact that the server already had in hand.
   */
  const snapshot: PlanSnapshot = {
    plan: billing.plan,
    planVersion: billing.billing.planVersion,
    limits: billing.limits,
    usage: billing.usage,
    cvImportsLeft: billing.cvImportsLeft,
    credits: billing.credits,
    status: billing.billing.status,
    cancelAtPeriodEnd: billing.billing.cancelAtPeriodEnd,
    periodEnd: billing.billing.periodEnd?.toISOString() ?? null,
    // Read off Stripe, so the upgrade dialog quotes what checkout will charge.
    proPrice: prices.pro?.monthly
      ? { amount: prices.pro.monthly.amount, currency: prices.pro.monthly.currency }
      : null,
  };

  return (
    <PlanProvider snapshot={snapshot}>
      <SidebarProvider>
        <div className="flex h-dvh overflow-hidden">
          <Sidebar initials={initialsOf(user)} name={user.name ?? user.email} />
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar
              email={user.email}
              image={user.image}
              initials={initialsOf(user)}
              name={user.name}
            />
            {completeness.complete ? null : (
              <ProfileNudge missing={completeness.missing} percent={completeness.percent} />
            )}
            <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">{children}</div>
          </div>
        </div>
      </SidebarProvider>
    </PlanProvider>
  );
}
