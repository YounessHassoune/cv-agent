"use client";

import { cn } from "@/lib/utils";

/**
 * Whether the agent is working, in one glyph beside the heading.
 *
 * It was a 4px dot in `bg-emerald-500`, which at that size reads as grey
 * against the header — the one thing that says a long run is still alive was
 * invisible. A live dot is now 8px, saturated, and pulses under its own ping.
 */
export function StatusDot({
  hasError,
  isBusy,
}: {
  /** The chat's own view of whether the server still owes us a turn. */
  readonly isBusy: boolean;
  readonly hasError: boolean;
}) {
  /*
   * Driven by `isBusy`, not by the store's status. The status says "ready"
   * whenever this chat is *following* a turn another view started, and again
   * whenever the runtime hands a turn back mid-run — so the dot sat grey
   * through exactly the long runs it exists to report.
   */
  const isLive = isBusy;
  const tone = hasError ? "bg-destructive" : isLive ? "bg-emerald-500" : "bg-muted-foreground/60";

  return (
    <span
      aria-label={isLive ? "Working" : hasError ? "Error" : "Idle"}
      className={cn("relative flex shrink-0", isLive ? "size-2" : "size-1.5")}
      role="status"
    >
      {isLive ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-75",
            tone,
          )}
        />
      ) : null}
      <span
        className={cn(
          "relative inline-flex size-full rounded-full transition-colors",
          tone,
          isLive && "shadow-[0_0_6px_2px] shadow-emerald-500/40",
        )}
      />
    </span>
  );
}
