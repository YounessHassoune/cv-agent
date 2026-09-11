"use client";

import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";

import { usePlan } from "@/components/plan-provider";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./settings-section";

/**
 * The plan, in Settings, at a glance.
 *
 * Deliberately a summary and not a second billing page: invoices, the usage
 * meter and cancelling live at `/dashboard/billing`, and two screens drifting
 * apart about what somebody is paying is worse than one extra click.
 *
 * It stays here at all because "what am I on" is a settings question.
 */
export function BillingSection() {
  const { plan, limits, credits, status, cancelAtPeriodEnd, periodEnd } = usePlan();

  const renews = periodEnd ? new Date(periodEnd).toLocaleDateString() : null;

  return (
    <SettingsSection
      description="What you are on today. Invoices and cancelling live on the billing page."
      title="Plan"
    >
      {status === "past_due" ? (
        <p className="flex items-start gap-2 rounded-lg bg-warning/12 px-3 py-2 text-sm text-warning">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Your last payment did not go through. Nothing is locked yet — update your card to keep
            it that way.
          </span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge className="border bg-field px-3 py-1.5" variant="outline">
          {limits.label} plan
        </Badge>
        {credits > 0 ? (
          <Badge className="border bg-field px-3 py-1.5" variant="outline">
            {credits} extra credits
          </Badge>
        ) : null}
        {renews ? (
          <Badge className="border bg-field px-3 py-1.5" variant="outline">
            {cancelAtPeriodEnd ? `Ends ${renews}` : `Renews ${renews}`}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link className={cn(buttonVariants({ variant: "outline" }))} href="/dashboard/billing">
          Billing and invoices
        </Link>
        <Link
          className={cn(buttonVariants({ variant: plan === "free" ? "default" : "outline" }))}
          href="/dashboard/pricing"
        >
          {plan === "free" ? "See plans" : "Change plan"}
        </Link>
      </div>
    </SettingsSection>
  );
}
