import { defineTool } from "eve/tools";
import { z } from "zod";
import { sanitizeKeywords } from "../lib/ats";
import { resolveUserId } from "../lib/auth";
import { db } from "../lib/db";
import { ExtractionSchema } from "../lib/extraction-schema";
import { cvLoop } from "../lib/state";

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
     * The analyst is a language model, so its keyword list is a suggestion.
     * The scorer gates on must-haves, which makes one over-eager weight-3 the
     * difference between 29/100 and 57/100 on the same job — settle the list
     * here, once, before anything is stored or scored against it.
     */
    const keywords = sanitizeKeywords(extraction.keywords);

    const languages = [...new Set(targetLanguages.map((lang) => lang.toLowerCase()))];

    /*
     * Idempotence. "Exactly once per job" is an instruction, and instructions
     * get double-dispatched. A second call for the same JD in the same session
     * would fork the work into an orphan application the user never sees, so
     * hand back the one that already exists.
     */
    const openApplicationId = cvLoop.get().applicationId;
    if (openApplicationId !== null) {
      const open = await db.application.findFirst({
        where: { id: openApplicationId, userId, jdText },
      });
      if (open !== null) {
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

    const application = await db.application.create({
      data: {
        userId,
        jdText,
        languages,
        jdKeywords: keywords,
        jdRole: extraction.role,
        jdSeniority: extraction.seniority,
        status: "DRAFT",
        // Link the eve session that is creating this application, so the
        // review page resumes this very conversation (stream replays from 0).
        chatSession: { sessionId: ctx.session.id, streamIndex: 0 },
      },
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
    };
  },
});
