import { defineState } from "eve/context";

/**
 * Bounds the compile → score → revise loop per language, so the agent cannot
 * grind on a draft on its own. The budget is *per turn*: `analyze_jd` resets
 * it, `compile_pdf` increments the entry for the language it compiled, and the
 * `cv-budget` hook clears the counters when a new turn starts.
 *
 * Per turn, not per session, because the cap exists to stop the agent looping
 * unprompted — not to stop the user. A session-wide cap meant that once the
 * first run spent it, every later "optimize this" was answered with advice the
 * user never asked for, since no compile was possible any more.
 */
export const cvLoop = defineState("cv-agent.loop", () => ({
  applicationId: null as string | null,
  /**
   * The principal this session belongs to, stamped by `resolveUserId` on the
   * first tool call. The usage hook reads it: hook context carries no auth, so
   * without this a recorded step has no one to bill.
   */
  userId: null as string | null,
  /** Successful compile count per ISO language code, this turn. */
  iterations: {} as Record<string, number>,
  /*
   * One draft, one improvement pass, then it belongs to the user. Four
   * compiles took five minutes and spent the last three moving the score by
   * nothing — the user is sitting in front of the CV and can ask for the next
   * change themselves, with the report open beside it.
   */
  cap: 2,
  /**
   * Rejected compiles per language, this turn. A rejection deliberately does
   * not spend an iteration — the draft never rendered — so it needs its own
   * bound, or a writer that keeps inventing terms retries forever and burns
   * model calls.
   */
  rejections: {} as Record<string, number>,
  rejectionCap: 3,
  /**
   * Every ATS total scored per language, oldest first. `score_ats` reads it to
   * spot a plateau: two revisions that move the number by nothing are two more
   * that will not either. Unlike the counters this survives the turn boundary —
   * a plateau is a fact about the profile, not about this turn.
   */
  scores: {} as Record<string, number[]>,
  /**
   * Terms the user told us in their own words to put on the CV, even though
   * the profile does not list them ("add Databricks and Snowflake anyway").
   *
   * The borrow budget exists to stop the *writer* padding a draft with the
   * job's vocabulary. It has no business overruling the person whose CV it is:
   * asked for twelve terms by name, `compile_pdf` rejected the draft, the
   * agent asked again, and the user ended up with fewer terms than they
   * started with. These are exempt from the budget and from the fabrication
   * check, and still reported for confirmation. Kept across turns — the user
   * says it once, not on every recompile.
   */
  assertedTerms: [] as string[],
  /**
   * The turn the counters belong to. A retried step replays `turn.started`
   * under the same `turnId`, so the hook compares against this before clearing
   * anything — a retry must not hand the loop a second budget mid-turn.
   */
  turnId: null as string | null,
}));
