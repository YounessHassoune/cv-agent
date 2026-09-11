"use client";

import { CheckCircle2Icon, LoaderIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** How long to keep waiting for the webhook after a successful checkout. */
const WEBHOOK_GRACE_MS = 15_000;
const POLL_MS = 1_500;

/**
 * The few seconds between paying and the plan appearing.
 *
 * Checkout returns the browser here as soon as Stripe has the money, which can
 * be before the webhook that grants the plan has been delivered — and the
 * webhook is the only thing allowed to grant it. So for a moment the honest
 * answer to "what plan am I on" is still "Free", which is the worst possible
 * thing to show someone who has just been charged.
 *
 * This waits instead, refreshing until the server changes its mind.
 */
export function CheckoutReturn({ plan }: { readonly plan: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const justPaid = params.get("checkout") === "success";

  const waiting = justPaid && plan === "free";

  useEffect(() => {
    if (!waiting) return;

    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > WEBHOOK_GRACE_MS) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [waiting, router]);

  if (!justPaid) return null;

  if (waiting) {
    return (
      <p className="mb-6 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2.5 text-sm">
        <LoaderIcon className="size-4 animate-spin" />
        Payment received — activating your plan.
      </p>
    );
  }

  return (
    <p className="mb-6 flex items-center gap-2 rounded-lg bg-success/12 px-3 py-2.5 text-sm text-success">
      <CheckCircle2Icon className="size-4 shrink-0" />
      You&apos;re all set. Everything on your plan is unlocked.
    </p>
  );
}
