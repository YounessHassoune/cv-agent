import { defineState } from "eve/context";

/**
 * Bounds the compile → score → revise loop durably per language, so it stays
 * capped even across retries and cold starts. `analyze_jd` resets it,
 * `compile_pdf` increments the entry for the language it compiled.
 */
export const cvLoop = defineState("cv-agent.loop", () => ({
  applicationId: null as string | null,
  /** Successful compile count per ISO language code. */
  iterations: {} as Record<string, number>,
  cap: 4,
  /**
   * Rejected compiles per language. A rejection deliberately does not spend an
   * iteration — the draft never rendered — so it needs its own bound, or a
   * writer that keeps inventing terms retries forever and burns model calls.
   */
  rejections: {} as Record<string, number>,
  rejectionCap: 3,
  /**
   * Every ATS total scored per language, oldest first. `score_ats` reads it to
   * spot a plateau: two revisions that move the number by nothing are two more
   * that will not either.
   */
  scores: {} as Record<string, number[]>,
}));
