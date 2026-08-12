import { defineState } from "eve/context";

/**
 * Bounds the compile → score → revise loop durably, so it stays capped even
 * across retries and cold starts. `analyze_jd` resets it, `compile_pdf`
 * increments it.
 */
export const cvLoop = defineState("cv-agent.loop", () => ({
  applicationId: null as string | null,
  iterations: 0,
  cap: 4,
}));
