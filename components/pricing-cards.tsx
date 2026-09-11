"use client";

import { CheckIcon, LoaderIcon, MinusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PLAN_LIST, type PlanId, type PlanLimits } from "@/lib/entitlements";
import { cn } from "@/lib/utils";

type Interval = "monthly" | "yearly";

/**
 * Real prices, read off Stripe by the server that rendered this. Shaped as a
 * plain object rather than the Stripe type so nothing about the SDK crosses
 * into the browser bundle.
 */
export type PriceTable = Partial<
  Record<PlanId, Partial<Record<Interval, { amount: number; currency: string }>>>
>;

/** `12` and `"usd"` → `$12`. Whole units: nobody prices a subscription at $12.40. */
function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/**
 * The same rows in the same order on every card, so the plans can be compared
 * by running your eye down a column instead of reading three different lists.
 * An excluded row stays visible and greyed: what a plan does *not* do is half
 * of what a price means.
 */
function rowsFor(limits: PlanLimits): { label: string; included: boolean }[] {
  return [
    {
      label: `${limits.applications} tailored ${limits.applications === 1 ? "application" : "applications"} ${
        limits.applicationWindow === "lifetime" ? "in total" : "a month"
      }`,
      included: true,
    },
    {
      label: `${limits.languages} ${limits.languages === 1 ? "language" : "languages"} per application`,
      included: true,
    },
    {
      label:
        limits.cvImports === 1
          ? "One CV upload to fill your profile"
          : "Upload a CV any time to refill your profile",
      included: limits.cvImport,
    },
    { label: "Follow-up chat on every CV", included: limits.applicationChat },
    {
      label: limits.atsScore
        ? "Keyword gaps and how to fix them"
        : "ATS score only, without the fixes",
      included: limits.atsScore,
    },
    {
      label: limits.templates === "all" ? "All six layouts" : "Two starter layouts",
      included: limits.templates === "all",
    },
    {
      label: limits.customThemeColor ? "Every theme, plus your own colour" : "Ink theme only",
      included: limits.customThemeColor,
    },
  ];
}

/**
 * The plan cards, on the public page and inside the app.
 *
 * `currentPlan` is null for a visitor with no session. Checkout needs a user to
 * attach a Stripe customer to, so signed-out cards send people to sign-up
 * rather than to a checkout that would 401 — the prices themselves are readable
 * either way, which is the whole point of putting them on a public page.
 */
export function PricingCards({
  currentPlan,
  prices = {},
}: {
  readonly currentPlan: PlanId | null;
  /** From Stripe. Empty during an outage, or before any Price has a lookup key. */
  readonly prices?: PriceTable;
}) {
  const [interval, setInterval] = useState<Interval>("monthly");
  const [pending, setPending] = useState<PlanId | null>(null);

  const checkout = async (plan: PlanId) => {
    setPending(plan);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const payload = (await response.json().catch(() => null)) as { url?: string } | null;
      if (payload?.url) {
        window.location.href = payload.url;
        return;
      }
      setPending(null);
    } catch {
      setPending(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Yearly is a discount, not a different product, so it is a toggle on
          one set of cards rather than a second set of them. */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border bg-card p-1">
          {(["monthly", "yearly"] as const).map((option) => (
            <button
              aria-pressed={interval === option}
              className={cn(
                "rounded-full px-4 py-1.5 font-medium text-sm capitalize transition-colors",
                interval === option
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
              key={option}
              onClick={() => setInterval(option)}
              type="button"
            >
              {option}
              {option === "yearly" ? (
                <span className="ml-1.5 text-[11px] text-success">2 months free</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_LIST.map(({ id, limits }) => {
          /*
           * Stripe first. The constants in `entitlements.ts` only stand in when
           * the catalogue could not be loaded — printing a price the checkout
           * will not honour is worse than printing nothing, and this is the one
           * number on the page a visitor is entitled to trust.
           */
          const live = prices[id]?.[interval];
          const fallback =
            interval === "yearly" ? limits.fallbackPriceYearly : limits.fallbackPriceMonthly;
          const label = live ? money(live.amount, live.currency) : `$${fallback}`;
          const isFree = (live?.amount ?? fallback) === 0;

          const current = currentPlan !== null && id === currentPlan;
          const featured = id === "pro";

          return (
            <div
              className={cn(
                "flex flex-col gap-5 rounded-xl border bg-card p-6",
                featured && "ring-1 ring-foreground/15",
              )}
              key={id}
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold tracking-tight">{limits.label}</h2>
                  {featured ? (
                    <Badge className="px-2 py-0.5 text-[11px]" variant="outline">
                      Most popular
                    </Badge>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{limits.tagline}</p>
              </div>

              <p className="flex items-baseline gap-1.5">
                <span className="font-semibold text-3xl tabular-nums tracking-tight">{label}</span>
                <span className="text-muted-foreground text-sm">
                  {isFree ? "forever" : interval === "yearly" ? "per year" : "per month"}
                </span>
              </p>

              <ul className="flex-1 space-y-2.5">
                {rowsFor(limits).map((row) => (
                  <li
                    className={cn(
                      "flex items-start gap-2.5 text-sm",
                      row.included ? "" : "text-muted-foreground/70",
                    )}
                    key={row.label}
                  >
                    {row.included ? (
                      <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
                    ) : (
                      <MinusIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                    )}
                    <span>{row.label}</span>
                  </li>
                ))}
              </ul>

              {currentPlan === null ? (
                <Link
                  className={cn(buttonVariants({ variant: featured ? "default" : "outline" }))}
                  href="/signup"
                >
                  {id === "free" ? "Start free" : `Start with ${limits.label}`}
                </Link>
              ) : current ? (
                <Button disabled type="button" variant="outline">
                  Current plan
                </Button>
              ) : id === "free" ? (
                <Button disabled type="button" variant="outline">
                  Included
                </Button>
              ) : (
                <Button
                  disabled={pending !== null}
                  onClick={() => void checkout(id)}
                  type="button"
                  variant={featured ? "default" : "outline"}
                >
                  {pending === id ? <LoaderIcon className="size-4 animate-spin" /> : null}
                  Upgrade to {limits.label}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-muted-foreground text-xs">
        {currentPlan === null
          ? "No card needed to start. The free plan tailors one CV, end to end."
          : "Cancel any time from Settings. Your applications and CVs stay yours either way."}
      </p>
    </div>
  );
}
