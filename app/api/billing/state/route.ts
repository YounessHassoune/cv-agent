import { NextResponse } from "next/server";

import { billingState } from "@/agent/lib/billing.ts";
import { getCurrentUser } from "@/app/lib/current-user";

export const dynamic = "force-dynamic";

export type BillingStateResponse = {
  plan: string;
  planVersion: number;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  periodEnd: string | null;
  credits: number;
  usage: { applications: number; agentTurns: number };
  limits: { applications: number; agentTurns: number; window: "lifetime" | "period" };
};

/**
 * What plan the browser is on, and how much of it is left.
 *
 * Exists for the seconds after checkout: the user is back on the site and the
 * webhook may still be in flight, so the success page polls this rather than
 * announcing a plan it has not been told about.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const state = await billingState(user.userId);

  const body: BillingStateResponse = {
    plan: state.plan,
    planVersion: state.billing.planVersion,
    status: state.billing.status,
    cancelAtPeriodEnd: state.billing.cancelAtPeriodEnd,
    periodEnd: state.billing.periodEnd?.toISOString() ?? null,
    credits: state.credits,
    usage: state.usage,
    limits: {
      applications: state.limits.applications,
      agentTurns: state.limits.agentTurns,
      window: state.limits.applicationWindow,
    },
  };

  return NextResponse.json(body);
}
