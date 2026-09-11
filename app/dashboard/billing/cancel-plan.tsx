"use client";

import { LoaderIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Cancel, and un-cancel.
 *
 * In the app rather than only behind Stripe's portal, and in the plan card
 * rather than at the bottom of the page. A cancel button that is hard to find
 * does not keep subscribers; it produces support mail and chargebacks from
 * people who concluded there was no way out.
 *
 * The confirmation exists to say what cancelling does *not* do — the plan runs
 * to the end of the period, and nothing already made is deleted. Most people
 * asking to cancel are really asking what they lose.
 */
export function CancelPlan({
  cancelAtPeriodEnd,
  periodEnd,
  planLabel,
}: {
  readonly cancelAtPeriodEnd: boolean;
  /** ISO string, already known to exist when this renders. */
  readonly periodEnd: string | null;
  readonly planLabel: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const ends = periodEnd
    ? new Date(periodEnd).toLocaleDateString("en", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const send = async (resume: boolean) => {
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resume }),
      });
      if (!response.ok) {
        setError("That did not go through. Try again, or use the Stripe portal below.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
    }
  };

  // Already cancelled: the only useful action left is taking it back.
  if (cancelAtPeriodEnd) {
    return (
      <div className="space-y-2">
        <Button disabled={pending} onClick={() => void send(true)} type="button" variant="outline">
          {pending ? <LoaderIcon className="size-4 animate-spin" /> : null}
          Keep my plan
        </Button>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    );
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button className="text-muted-foreground" size="sm" type="button" variant="ghost">
            Cancel plan
          </Button>
        }
      />
      <DialogContent className="gap-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel {planLabel}?</DialogTitle>
          <DialogDescription className="leading-relaxed">
            {ends
              ? `You keep everything ${planLabel} includes until ${ends}, which you have already paid for. After that the account goes back to Free.`
              : `You keep everything ${planLabel} includes until the end of the period you have paid for. After that the account goes back to Free.`}
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-muted-foreground text-sm">
          <li>Every CV and application you have made stays, and stays downloadable.</li>
          <li>Your master profile is untouched.</li>
          <li>You can undo this any time before it takes effect.</li>
        </ul>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <DialogFooter>
          <Button onClick={() => setOpen(false)} type="button" variant="ghost">
            Never mind
          </Button>
          <Button
            disabled={pending}
            onClick={() => void send(false)}
            type="button"
            variant="destructive"
          >
            {pending ? <LoaderIcon className="size-4 animate-spin" /> : null}
            Cancel at period end
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
