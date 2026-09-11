"use client";

import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { UpgradeDialog } from "@/components/upgrade-ui";
import {
  CAPABILITY_COPY,
  type Capability,
  type PlanId,
  type PlanLimits,
  proHighlights,
} from "@/lib/entitlements";

/**
 * What the signed-in browser is allowed to do, and the one dialog that sells
 * the rest of it.
 *
 * Every lock in the app is the same gesture: the control stays where it is,
 * gets a lock, and opens this dialog instead of doing nothing. A disabled
 * button teaches a user that the app is broken; a lock teaches them what they
 * are missing, which is the only reason to gate a feature at all.
 *
 * The server is still the gate. This decides what the interface says, never
 * what the backend permits.
 */

export type PlanSnapshot = {
  plan: PlanId;
  planVersion: number;
  limits: PlanLimits;
  usage: { applications: number; agentTurns: number; cvImports: number };
  /** Successful CV imports left in this window. Zero means the lock is on. */
  cvImportsLeft: number;
  credits: number;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  /** ISO string; the server cannot hand a Date to a client component. */
  periodEnd: string | null;
  /**
   * What Pro costs per month, read off Stripe by the server. Null when the
   * catalogue could not be loaded — the dialog then sends people to the pricing
   * page instead of naming a figure it cannot stand behind.
   */
  proPrice: { amount: number; currency: string } | null;
};

type PlanContextValue = PlanSnapshot & {
  can: (capability: Capability) => boolean;
  /** Opens the upgrade dialog for one gate. */
  upgrade: (capability: Capability) => void;
};

const PlanContext = createContext<PlanContextValue | null>(null);

export function usePlan(): PlanContextValue {
  const value = useContext(PlanContext);
  if (!value) throw new Error("usePlan must be used inside <PlanProvider>.");
  return value;
}

export function PlanProvider({
  snapshot,
  children,
}: {
  readonly snapshot: PlanSnapshot;
  readonly children: ReactNode;
}) {
  const [gate, setGate] = useState<Capability | null>(null);

  const value = useMemo<PlanContextValue>(
    () => ({
      ...snapshot,
      can: (capability) => snapshot.limits[capability],
      upgrade: (capability) => setGate(capability),
    }),
    [snapshot],
  );

  return (
    <PlanContext value={value}>
      {children}
      <ConnectedUpgradeDialog
        gate={gate}
        onClose={() => setGate(null)}
        proPrice={snapshot.proPrice}
      />
    </PlanContext>
  );
}

/**
 * Binds the shared dialog to this session's plan: the copy for whichever gate
 * was hit, the real Pro price, and the checkout call.
 */
function ConnectedUpgradeDialog({
  gate,
  onClose,
  proPrice,
}: {
  readonly gate: Capability | null;
  readonly onClose: () => void;
  readonly proPrice: PlanSnapshot["proPrice"];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const copy = gate ? CAPABILITY_COPY[gate] : null;

  // Named only when Stripe told us the figure. A price on a button is a promise
  // about what the next screen will charge.
  const priceLabel =
    proPrice === null
      ? null
      : new Intl.NumberFormat("en", {
          style: "currency",
          currency: proPrice.currency.toUpperCase(),
          maximumFractionDigits: Number.isInteger(proPrice.amount) ? 0 : 2,
        }).format(proPrice.amount);

  const checkout = useCallback(async () => {
    setPending(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "pro", interval: "monthly" }),
      });
      const payload = (await response.json().catch(() => null)) as { url?: string } | null;
      if (payload?.url) {
        window.location.href = payload.url;
        return;
      }
      // Stripe not configured yet, or the call failed. The pricing page is a
      // better dead end than a dialog with a button that does nothing.
      router.push("/dashboard/pricing");
    } finally {
      setPending(false);
    }
  }, [router]);

  return (
    <UpgradeDialog
      body={copy?.body}
      highlights={proHighlights()}
      onCheckout={() => void checkout()}
      onClose={onClose}
      open={gate !== null}
      pending={pending}
      priceLabel={priceLabel}
      title={copy?.title ?? "Upgrade to Pro"}
    />
  );
}

/**
 * Re-exported so a call site needs one import for the whole lock vocabulary,
 * and so the kit stays the only place any of it is drawn.
 */
export { LockedCard, LockPill, UpgradeButton, UpgradeIcon } from "@/components/upgrade-ui";
