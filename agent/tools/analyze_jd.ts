import { createHash } from "node:crypto";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { sanitizeKeywords } from "../lib/ats";
import { resolveUserId } from "../lib/auth";
import { billingState, consumeApplication, refundApplication } from "../lib/billing";
import { db } from "../lib/db";
import { ExtractionSchema } from "../lib/extraction-schema";
import { cvLoop } from "../lib/state";

/**
 * Longest job ad we will carry into the pipeline.
 *
 * The JD is not read once: it rides in the analyst's prompt, the writer's
 * prompt, every scoring embedding, and the durable history of every later
 * chat turn. A pasted forty-page careers-site dump therefore multiplies the
 * cost of the whole application, and the part past the first few thousand
 * words is boilerplate about the company's values.
 */
const MAX_JD_CHARS = 24_000;

/** Enough of a job ad to tell one from another, whatever the whitespace. */
const JD_COMPARE_CHARS = 2_000;

/**
 * Whether two job descriptions are the same posting. Whitespace and case are
 * noise — the model does not hand back the text it was given byte for byte —
 * and the stored copy is truncated, so this compares the opening of each.
 */
function sameJob(stored: string, incoming: string): boolean {
  return normalizeJob(stored) === normalizeJob(incoming);
}

function normalizeJob(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase().slice(0, JD_COMPARE_CHARS);
}

/**
 * The same comparison as `sameJob`, reduced to something a unique index can
 * hold. `(userId, sessionId, jdHash)` is what makes "one application per job"
 * a fact about the database rather than a hope about the agent.
 */
function jobFingerprint(text: string): string {
  return createHash("sha256").update(normalizeJob(text)).digest("hex");
}

/** Prisma's duplicate-key error, without importing its runtime error class. */
function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2002";
}

export default defineTool({
  description:
    "Create the single Application draft row for this job. Call this exactly once per job — no matter how many target languages — after jd-analyst has analyzed the JD, passing its extraction through. Returns the applicationId used by compile_pdf and score_ats for every language.",
  inputSchema: z.object({
    jdText: z.string().min(50).describe("The full job description text"),
    targetLanguages: z
      .array(z.string().min(2))
      .min(1)
      .default(["en"])
      .describe("ISO codes of every language the CV should be written in, e.g. ['en','fr']"),
    extraction: ExtractionSchema.describe(
      "The jd-analyst subagent's result, passed through unchanged. Required: without it there is no role, no seniority and no weighted keywords, so the CV cannot be tailored and the score would be meaningless. If jd-analyst fails, retry it — never call this tool without its result.",
    ),
  }),
  async execute({ jdText, targetLanguages, extraction }, ctx) {
    const userId = resolveUserId(ctx);
    /*
     * The row stores a truncated JD, so the truncated text — not the argument
     * — is what a later call must be compared against. Comparing the raw
     * argument is what let a long job ad slip past the idempotence check below
     * and create a second application for the same job.
     */
    const storedJd = jdText.slice(0, MAX_JD_CHARS);
    const jdHash = jobFingerprint(storedJd);

    /*
     * The analyst is a language model, so its keyword list is a suggestion.
     * The scorer gates on must-haves, which makes one over-eager weight-3 the
     * difference between 29/100 and 57/100 on the same job — settle the list
     * here, once, before anything is stored or scored against it.
     */
    const keywords = sanitizeKeywords(extraction.keywords);

    const state = await billingState(userId);

    /*
     * Each language is a whole extra cv-writer call, its own compile and its
     * own scoring pass — the cost of an application scales one-for-one with
     * this list. Trim rather than refuse: the user asked for a CV, and getting
     * two of the three languages is a better answer than an error.
     */
    const requested = [...new Set(targetLanguages.map((lang) => lang.toLowerCase()))];
    const languages = requested.slice(0, state.limits.languages);
    const droppedLanguages = requested.slice(state.limits.languages);

    /*
     * Idempotence. "Exactly once per job" is an instruction, and instructions
     * get double-dispatched. A second call for the same JD in the same session
     * would fork the work into an orphan application the user never sees, so
     * hand back the one that already exists.
     */
    /*
     * Two ways the same job comes back, and both have produced a duplicate
     * row: the agent calls this twice in one turn (the loop state knows the
     * id), or the step is replayed into a session whose loop state was already
     * reset (it does not, and the only record is the row the first call
     * stamped with this session). Look for both, every time — the loop state
     * having an id is no reason to skip the session lookup.
     */
    const openApplicationId = cvLoop.get().applicationId;
    {
      const candidates = await db.application.findMany({
        where: {
          userId,
          OR: [
            ...(openApplicationId === null ? [] : [{ id: openApplicationId }]),
            { chatSession: { path: ["sessionId"], equals: ctx.session.id } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      /*
       * Matched in JS rather than in the WHERE clause. The model re-types the
       * job ad between calls — a collapsed blank line, a stripped bullet — and
       * an exact string comparison read that as a different job and forked the
       * work. Compare the text the way a person would.
       */
      const open = candidates.find((row) => sameJob(row.jdText, storedJd)) ?? null;
      if (open !== null) {
        // A replay that found its row by session still has to restore the loop
        // state, or every later compile runs against a null application id.
        if (cvLoop.get().applicationId !== open.id) {
          cvLoop.update((loop) => ({ ...loop, applicationId: open.id }));
        }
        return {
          applicationId: open.id,
          role: extraction.role,
          seniority: extraction.seniority,
          jdLanguage: extraction.language,
          domain: extraction.domain,
          targetProfile: extraction.targetProfile,
          responsibilities: extraction.responsibilities,
          targetLanguages: open.languages,
          keywords,
          unchanged: true,
          note: "This job already has an application — reusing it. Do not create another.",
        };
      }
    }

    /*
     * The quota is spent here, at the one place an application actually comes
     * into existence, and it is reported rather than thrown: a refused tool
     * call surfaces to the user as a broken turn, while a result the agent can
     * read ends in it saying what happened and where to upgrade.
     */
    const quota = await consumeApplication(userId);
    if (!quota.ok) {
      return {
        blocked: "quota" as const,
        plan: quota.plan,
        used: quota.used,
        limit: quota.limit,
        message:
          quota.window === "lifetime"
            ? `The ${quota.plan} plan includes ${quota.limit} application in total, and it has been used. Tell the user — in their own language, briefly — that tailoring another CV needs an upgrade, and that they can see the plans at /pricing. Do not call this tool again for this job.`
            : `This plan's ${quota.limit} applications for the current billing period are used up. Tell the user, mention that /pricing has larger plans, and do not call this tool again for this job.`,
      };
    }

    /*
     * The check above cannot see a write that has not committed yet, so two
     * calls dispatched at the same moment both read an empty table and both
     * get here. `(userId, sessionId, jdHash)` is unique, so the database
     * refuses the second one — and the loser reads back the winner's row
     * rather than reporting a failure the agent would try to route around.
     */
    let application: { id: string; languages: string[] };
    try {
      application = await db.application.create({
        data: {
          userId,
          jdText: storedJd,
          languages,
          jdKeywords: keywords,
          jdRole: extraction.role,
          jdSeniority: extraction.seniority,
          status: "DRAFT",
          sessionId: ctx.session.id,
          jdHash,
          // Link the eve session that is creating this application, so the
          // review page resumes this very conversation (stream replays from 0).
          chatSession: { sessionId: ctx.session.id, streamIndex: 0 },
        },
        select: { id: true, languages: true },
      });
    } catch (error) {
      const winner = isUniqueViolation(error)
        ? await db.application.findFirst({ where: { userId, sessionId: ctx.session.id, jdHash } })
        : null;
      if (winner === null) throw error;

      // Charged a moment ago for a row that was never created.
      await refundApplication(userId, quota);
      cvLoop.update((loop) => ({ ...loop, applicationId: winner.id }));

      return {
        applicationId: winner.id,
        role: extraction.role,
        seniority: extraction.seniority,
        jdLanguage: extraction.language,
        domain: extraction.domain,
        targetProfile: extraction.targetProfile,
        responsibilities: extraction.responsibilities,
        targetLanguages: winner.languages,
        keywords,
        unchanged: true,
        note: "This job already has an application — reusing it. Do not create another.",
      };
    }

    // The receipt is written before the row exists, so point it at the row now
    // that there is one — that is what makes "what did this CV cost" answerable.
    await db.usageEvent.update({
      where: { id: quota.eventId },
      data: { applicationId: application.id },
    });

    cvLoop.update((s) => ({
      ...s,
      applicationId: application.id,
      iterations: {},
      rejections: {},
      scores: {},
    }));

    return {
      applicationId: application.id,
      role: extraction.role,
      seniority: extraction.seniority,
      jdLanguage: extraction.language,
      domain: extraction.domain,
      targetProfile: extraction.targetProfile,
      responsibilities: extraction.responsibilities,
      targetLanguages: languages,
      keywords,
      ...(droppedLanguages.length > 0
        ? {
            droppedLanguages,
            note: `This plan tailors ${state.limits.languages} language(s) per application, so ${droppedLanguages.join(", ")} was not included. Say so once, plainly, and carry on with the rest.`,
          }
        : {}),
    };
  },
});
