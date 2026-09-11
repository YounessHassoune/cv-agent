"use client";

import type { ReactNode } from "react";
import { CheckIcon, GemIcon, LoaderIcon, LockIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Every locked thing in the app, drawn the same way.
 *
 * Before this there were three lock layouts and two icons — a gem in the nav, a
 * sparkle in the dialog — so the same idea arrived looking like three unrelated
 * features. A paywall has to be recognisable on sight: the second time someone
 * meets one they should already know what the button does.
 *
 * Purely presentational. Nothing here reads the plan; call sites pass
 * `onUpgrade`, which keeps this file out of the provider's import cycle.
 */

/** The one upgrade mark. Used in the nav, every lock, and the dialog. */
export const UpgradeIcon = GemIcon;

/** The tile a lock icon sits in, at the two sizes the layouts need. */
function IconTile({ size = "default" }: { readonly size?: "default" | "sm" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl border bg-card",
        size === "sm" ? "size-8 rounded-lg" : "size-10",
      )}
    >
      <LockIcon className={cn("text-muted-foreground", size === "sm" ? "size-4" : "size-4.5")} />
    </span>
  );
}

/** The upgrade button, so the label, icon and weight never drift between locks. */
export function UpgradeButton({
  onUpgrade,
  children = "Upgrade",
  className,
  size = "sm",
}: {
  readonly onUpgrade: () => void;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly size?: "sm" | "default";
}) {
  return (
    <Button className={cn("shrink-0", className)} onClick={onUpgrade} size={size} type="button">
      <UpgradeIcon className="size-3.5" />
      {children}
    </Button>
  );
}

/**
 * A locked feature, explained.
 *
 * `row` is for a lock that replaces a control in place — the chat composer —
 * where the surrounding layout already says what it is about. `center` is for a
 * lock that owns its whole area, where the block has to introduce itself.
 */
export function LockedCard({
  title,
  body,
  action = "Upgrade",
  onUpgrade,
  layout = "center",
  className,
}: {
  readonly title: string;
  readonly body: string;
  readonly action?: string;
  readonly onUpgrade: () => void;
  readonly layout?: "row" | "center";
  readonly className?: string;
}) {
  if (layout === "row") {
    return (
      <div className={cn("flex items-start gap-3 rounded-xl border bg-card p-4", className)}>
        <IconTile size="sm" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-sm">{title}</p>
          <p className="text-muted-foreground text-xs leading-relaxed">{body}</p>
        </div>
        <UpgradeButton onUpgrade={onUpgrade}>{action}</UpgradeButton>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 text-center", className)}>
      <IconTile />
      <div className="space-y-1">
        <p className="font-medium text-sm">{title}</p>
        <p className="mx-auto max-w-xs text-muted-foreground text-sm leading-relaxed">{body}</p>
      </div>
      <UpgradeButton onUpgrade={onUpgrade}>{action}</UpgradeButton>
    </div>
  );
}

/**
 * A badge for a control the plan cannot use — small enough to sit on a colour
 * swatch or beside a menu label without redesigning either.
 */
export function LockPill({ className }: { readonly className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none inline-flex items-center gap-1 rounded-full bg-foreground/85 px-1.5 py-0.5 font-medium text-[10px] text-background uppercase tracking-wide",
        className,
      )}
    >
      <UpgradeIcon className="size-2.5" />
      Pro
    </span>
  );
}

/**
 * The upgrade dialog: one mount, contextual copy.
 *
 * Whichever lock was clicked leads, and the rest of the plan follows as the
 * supporting argument. The gate's own words come first because somebody who
 * clicked "see my score" is not shopping for a plan — they are trying to do one
 * thing, and the plan is only how.
 */
export function UpgradeDialog({
  open,
  title,
  body,
  highlights,
  priceLabel,
  pending,
  onCheckout,
  onClose,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly body?: string;
  readonly highlights: readonly string[];
  /** `$12`, already formatted. Null hides the figure rather than guessing it. */
  readonly priceLabel: string | null;
  readonly pending: boolean;
  readonly onCheckout: () => void;
  readonly onClose: () => void;
}) {
  return (
    <Dialog onOpenChange={(next) => (next ? undefined : onClose())} open={open}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        {/* The header carries the mark and the one sentence the click earned. */}
        <DialogHeader className="space-y-3 border-b bg-card/60 p-6 text-left">
          <span className="flex size-10 items-center justify-center rounded-xl border bg-background">
            <UpgradeIcon className="size-4.5" />
          </span>
          <DialogTitle className="text-lg tracking-tight">{title}</DialogTitle>
          {body ? (
            <DialogDescription className="text-sm leading-relaxed">{body}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-3 p-6">
          <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
            Pro also includes
          </p>
          <ul className="space-y-2.5">
            {highlights.map((line) => (
              <li className="flex items-start gap-2.5 text-sm" key={line}>
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="border-t p-4">
          <Button onClick={onClose} type="button" variant="ghost">
            Maybe later
          </Button>
          <Button disabled={pending} onClick={onCheckout} type="button">
            {pending ? (
              <LoaderIcon className="size-4 animate-spin" />
            ) : (
              <UpgradeIcon className="size-3.5" />
            )}
            {priceLabel === null ? "See plans" : `Upgrade — ${priceLabel}/mo`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
