import { generateObject } from "ai";
import { defineTool } from "eve/tools";
import { z } from "zod";
import type { JdKeyword } from "../lib/ats";
import { resolveUserId } from "../lib/auth";
import { db } from "../lib/db";
import { cvLoop } from "../lib/state";

// Keyword extraction is plain structured parsing — route it to the cheap tier.
// The premium model (agent.ts) is reserved for bullet rewriting/translation.
const EXTRACTION_MODEL = process.env.EXTRACTION_MODEL ?? "anthropic/claude-haiku-4.5";

const ExtractionSchema = z.object({
  role: z.string().describe("The job title being hired for"),
  seniority: z.string().describe("junior | mid | senior | lead | unspecified"),
  language: z.string().describe("ISO code of the language the JD is written in"),
  keywords: z
    .array(
      z.object({
        term: z.string().describe("Short canonical term as it appears in the JD"),
        weight: z.number().min(1).max(3).describe("3 = must-have, 1 = nice-to-have"),
        category: z.enum(["hard", "tool", "domain", "soft"]),
      }),
    )
    .min(5)
    .max(30),
});

/** Fallback when no model/gateway key is available: frequency-based unigrams/bigrams. */
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
    "Analyze a job description: extract weighted ATS keywords, role, and seniority, then create the Application draft row for this run. Call this once per job, before tailoring. Returns the applicationId used by compile_pdf / score_ats / stage_application.",
  inputSchema: z.object({
    jdText: z.string().min(50).describe("The full job description text"),
    targetLanguage: z
      .string()
      .default("en")
      .describe("ISO code of the language the CV should be written in"),
  }),
  async execute({ jdText, targetLanguage }, ctx) {
    const userId = resolveUserId(ctx);

    let extraction: z.infer<typeof ExtractionSchema>;
    try {
      const { object } = await generateObject({
        model: EXTRACTION_MODEL,
        schema: ExtractionSchema,
        prompt: `Extract ATS-relevant data from this job description. Focus keywords on concrete skills, technologies, methodologies, and domain terms an ATS would scan for — not generic filler.\n\n${jdText}`,
      });
      extraction = object;
    } catch {
      extraction = {
        role: "unknown",
        seniority: "unspecified",
        language: "en",
        keywords: heuristicKeywords(jdText),
      };
    }

    const application = await db.application.create({
      data: {
        userId,
        jdText,
        language: targetLanguage,
        jdKeywords: extraction.keywords,
        status: "DRAFT",
      },
    });

    cvLoop.update(() => ({ applicationId: application.id, iterations: 0, cap: 4 }));

    return {
      applicationId: application.id,
      role: extraction.role,
      seniority: extraction.seniority,
      jdLanguage: extraction.language,
      targetLanguage,
      keywords: extraction.keywords,
    };
  },
});
