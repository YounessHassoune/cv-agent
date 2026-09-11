"use client";

import { useEffect, useRef, useState } from "react";
import { PROGRESS_STEP_MS } from "../lib/activity-copy";

/**
 * Walks a list of status lines while a step runs, holding on the last one.
 *
 * It holds rather than loops on purpose: a line that comes back around tells
 * the user the app is cycling filler, while a final "still working" line that
 * stays put is simply the truth about a long step.
 */
export function useCyclingMessage(
  steps: readonly string[],
  intervalMs: number = PROGRESS_STEP_MS,
): string {
  const [index, setIndex] = useState(0);
  /*
   * The stop condition lives here rather than inside the state updater.
   * Updaters run during render and a concurrent render can be thrown away —
   * calling `clearInterval` from one would stop the timer on a render whose
   * state change never lands, freezing the line on whatever it last showed.
   */
  const indexRef = useRef(0);
  // A different step restarts the sequence instead of continuing the last one.
  const signature = steps.join("\u0000");
  const last = steps.length - 1;

  useEffect(() => {
    indexRef.current = 0;
    setIndex(0);
    if (last <= 0) return;

    const timer = setInterval(() => {
      const next = indexRef.current + 1;
      indexRef.current = next;
      setIndex(next);
      if (next >= last) clearInterval(timer);
    }, intervalMs);

    return () => clearInterval(timer);
    // `signature` stands in for the array, which callers rebuild every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, intervalMs, last]);

  return steps[Math.min(index, last)] ?? "";
}
