import { defineTool } from "eve/tools";
import { z } from "zod";
import type { JdKeyword } from "../lib/ats";
import { resolveUserId } from "../lib/auth";
import { db } from "../lib/db";
import { ExtractionSchema } from "../lib/extraction-schema";
import { cvLoop } from "../lib/state";

/** Fallback when jd-analyst is unavailable: frequency-based unigrams. */
function heuristicKeywords(jdText: string): JdKeyword[] {
  const stop = new Set(
    "the a an and or of to in for with on at by from as is are be we you our your will this that have has can plus etc & - •".split(" "),
  );
  const words = jdText.toLowerCase().replace(/[^a-z0-9+#./\s-]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !stop.has(w));
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([term, count]) => ({ term, weight: count >= 3 ? 2 : 1, category: "hard" as const }));
}

export default defineTool({
  description:
    "Create the single Application draft row for this job. Call this exactly once per job — no matter how many target languages — after jd-analyst has analyzed the JD, passing its extraction through. Returns the applicationId used by compile_pdf / score_ats / stage_application for every language.",
  inputSchema: z.object({
    jdText: z.string().min(50).describe("The full job description text"),
    targetLanguages: z
      .array(z.string().min(2))
      .min(1)
      .default(["en"])
      .describe("ISO codes of every language the CV should be written in, e.g. ['en','fr']"),
    extraction: ExtractionSchema.optional().describe(
      "The jd-analyst subagent's result. Omit only if jd-analyst failed — keywords then degrade to a frequency heuristic.",
    ),
  }),
  async execute({ jdText, targetLanguages, extraction }, ctx) {
    const userId = resolveUserId(ctx);

    const languages = [...new Set(targetLanguages.map((lang) => lang.toLowerCase()))];
    const keywords: JdKeyword[] = extraction?.keywords ?? heuristicKeywords(jdText);

    const application = await db.application.create({
      data: {
        userId,
        jdText,
        languages,
        jdKeywords: keywords,
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
    }));

    return {
      applicationId: application.id,
      role: extraction?.role ?? "unknown",
      seniority: extraction?.seniority ?? "unspecified",
      jdLanguage: extraction?.language ?? "unknown",
      domain: extraction?.domain ?? "",
      targetProfile: extraction?.targetProfile ?? "",
      responsibilities: extraction?.responsibilities ?? [],
      targetLanguages: languages,
      keywords,
      keywordSource: extraction ? "jd-analyst" : "heuristic",
    };
  },
});
