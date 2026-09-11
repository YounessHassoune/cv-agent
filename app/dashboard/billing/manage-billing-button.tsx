"use client";

import { ExternalLinkIcon, LoaderIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Hands the user over to Stripe's billing portal.
 *
 * Cards, failed-payment retries, cancellations, plan switches and tax receipts
 * all live there. Rebuilding any of it here would mean touching card data and
 * reimplementing proration and dunning — badly, and with a fresh chance to get
 * somebody's money wrong.
 */
export function ManageBillingButton({
  children = "Manage billing",
  variant = "default",
}: {
  readonly children?: React.ReactNode;
  readonly variant?: "default" | "outline";
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const open = async () => {
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;

      if (payload?.url) {
        window.location.href = payload.url;
        return;
      }
      setError(
        payload?.error === "no_customer"
          ? "Nothing to manage yet — you have never been charged."
          : "Could not open the billing portal. Try again in a moment.",
      );
    } catch {
      setError("Could not reach the billing portal.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button disabled={pending} onClick={() => void open()} type="button" variant={variant}>
        {pending ? (
          <LoaderIcon className="size-4 animate-spin" />
        ) : (
          <ExternalLinkIcon className="size-4" />
        )}
        {children}
      </Button>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
