import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertTriangleIcon, FileTextIcon } from "lucide-react";

import { billingState } from "@/agent/lib/billing.ts";
import { requireUser } from "@/app/lib/current-user";
import { getInvoices, stripeConfigured } from "@/app/lib/stripe";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { CancelPlan } from "./cancel-plan";
import { CheckoutReturn } from "./checkout-return";
import { ManageBillingButton } from "./manage-billing-button";

export const metadata: Metadata = { title: "Billing · Wellsuited" };
export const dynamic = "force-dynamic";

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

function date(value: string | Date): string {
  return new Date(value).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Invoice states, in the words a customer uses for them. */
const invoiceTone: Record<string, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-success/12 text-success" },
  open: { label: "Due", className: "bg-warning/15 text-warning" },
  draft: { label: "Draft", className: "bg-secondary text-muted-foreground" },
  uncollectible: { label: "Unpaid", className: "bg-destructive/12 text-destructive" },
  void: { label: "Void", className: "bg-secondary text-muted-foreground" },
};

export default async function BillingPage() {
  const user = await requireUser();
  const state = await billingState(user.userId);
  const invoices = await getInvoices(state.billing.stripeCustomerId);

  const used = Math.min(state.usage.applications, state.limits.applications);
  const spent = state.usage.applications >= state.limits.applications;
  const renews = state.billing.periodEnd ? date(state.billing.periodEnd) : null;
  const hasCustomer = Boolean(state.billing.stripeCustomerId);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8 md:py-10">
      <div className="space-y-1 pb-8">
        <h1 className="font-semibold text-2xl tracking-tight">Billing</h1>
        <p className="text-muted-foreground text-sm">
          Your plan, what you have used of it, and every receipt.
        </p>
      </div>

      {/* Reads ?checkout=success, so it needs a boundary even on a dynamic page. */}
      <Suspense fallback={null}>
        <CheckoutReturn plan={state.plan} />
      </Suspense>

      {state.billing.status === "past_due" ? (
        <p className="mb-6 flex items-start gap-2 rounded-lg bg-warning/12 px-3 py-2.5 text-sm text-warning">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            Your last payment did not go through. Nothing is locked yet — Stripe will retry, and
            updating your card in the billing portal settles it immediately.
          </span>
        </p>
      ) : null}

      {state.billing.cancelAtPeriodEnd && renews ? (
        <p className="mb-6 rounded-lg bg-secondary px-3 py-2.5 text-sm">
          Your plan ends on {renews}. Everything you have tailored stays readable after that.
        </p>
      ) : null}

      {/* Plan. The one thing somebody opens this page to check. */}
      <section className="space-y-5 rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Current plan</p>
            <p className="font-semibold text-xl tracking-tight">{state.limits.label}</p>
            {renews ? (
              <p className="text-muted-foreground text-sm">
                {state.billing.cancelAtPeriodEnd ? "Ends" : "Renews"} {renews}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">No subscription — free forever.</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {state.credits > 0 ? (
              <Badge className="border bg-field px-3 py-1.5" variant="outline">
                {state.credits} extra credits
              </Badge>
            ) : null}
            <Link
              className={cn(buttonVariants({ variant: state.plan === "free" ? "default" : "outline" }))}
              href="/dashboard/pricing"
            >
              {state.plan === "free" ? "Upgrade" : "Change plan"}
            </Link>
          </div>
        </div>

        <div className="space-y-2 border-t pt-5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">
              {used} of {state.limits.applications}{" "}
              {state.limits.applications === 1 ? "application" : "applications"} used
            </span>
            <span className="text-muted-foreground text-xs">
              {state.limits.applicationWindow === "period"
                ? "This billing period"
                : "Lifetime, on the free plan"}
            </span>
          </div>
          <Progress
            indicatorClassName={cn(spent && "bg-warning")}
            value={
              state.limits.applications === 0 ? 100 : (used / state.limits.applications) * 100
            }
          />
        </div>

        {/* Cancelling belongs on the plan, not at the bottom of the page behind
            a portal link. Hidden until there is a subscription to cancel. */}
        {state.billing.stripeSubscriptionId ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
            <p className="text-muted-foreground text-xs">
              {state.billing.cancelAtPeriodEnd
                ? "Your plan is set to end. Changed your mind?"
                : "Cancelling keeps your plan until the end of the period you have paid for."}
            </p>
            <CancelPlan
              cancelAtPeriodEnd={state.billing.cancelAtPeriodEnd}
              periodEnd={state.billing.periodEnd?.toISOString() ?? null}
              planLabel={state.limits.label}
            />
          </div>
        ) : null}
      </section>

      {/* Invoices. */}
      <section className="mt-4 rounded-xl border bg-card">
        <div className="flex items-center gap-2.5 border-b p-6">
          <FileTextIcon className="size-4 text-muted-foreground" />
          <h2 className="font-medium">Invoices</h2>
          {invoices.length > 0 ? (
            <span className="ml-auto text-muted-foreground text-xs">Last {invoices.length}</span>
          ) : null}
        </div>

        {invoices.length === 0 ? (
          <p className="p-6 text-muted-foreground text-sm">
            {stripeConfigured()
              ? "Nothing here yet. Invoices appear the first time you are charged."
              : "Billing is not configured in this environment, so there is nothing to show."}
          </p>
        ) : (
          <ul className="divide-y">
            {invoices.map((invoice) => {
              const tone = invoiceTone[invoice.status] ?? invoiceTone.draft;
              return (
                <li
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4"
                  key={invoice.id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm tabular-nums">
                      {invoice.number ?? "Draft invoice"}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {date(invoice.created)}
                    </p>
                  </div>

                  <span className="font-medium text-sm tabular-nums">
                    {money(invoice.amount, invoice.currency)}
                  </span>

                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 font-medium text-xs",
                      tone.className,
                    )}
                  >
                    {tone.label}
                  </span>

                  {/* Stripe-hosted, so `rel="noreferrer"` and a new tab: these
                      leave the app, and one of them is a PDF download. */}
                  <span className="flex shrink-0 items-center gap-3">
                    {invoice.hostedUrl ? (
                      <a
                        className="font-medium text-xs underline underline-offset-2"
                        href={invoice.hostedUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        View
                      </a>
                    ) : null}
                    {invoice.pdfUrl ? (
                      <a
                        className="font-medium text-muted-foreground text-xs underline underline-offset-2"
                        href={invoice.pdfUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        PDF
                      </a>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* The single way out to Stripe. Cards, cancellations and tax receipts
          are all theirs; offered here only because this is the page somebody is
          on when they want one of them. */}
      {hasCustomer ? (
        <div className="mt-4">
          <ManageBillingButton variant="outline">Manage billing in Stripe</ManageBillingButton>
        </div>
      ) : null}

      <p className="mt-4 text-muted-foreground text-xs leading-relaxed">
        Payments are handled by Stripe. Your card details never reach us, and cancelling leaves
        every CV you have already made exactly where it is.
      </p>
    </div>
  );
}
