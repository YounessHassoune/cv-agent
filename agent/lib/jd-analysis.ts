import { Prisma } from "../generated/prisma/client.ts";
import { db } from "./db.ts";
import { type Extraction, ExtractionSchema } from "./extraction-schema.ts";
import { generateStructured } from "./llm.ts";
import { requireModelEnv } from "./model-env.ts";
import { JD_ANALYST_SYSTEM } from "./prompts/jd-analyst.ts";

/**
 * The role analysis for one job description: cached by fingerprint, computed
 * once.
 *
 * The analyst is a language model, and asked twice about the same job ad it
 * picks a different set of must-haves each time. `score_ats` multiplies the
 * whole total by the share of must-haves present, so the same profile against
 * the same job scored 49 one run and 58 the next with nothing changed. Reusing
 * the first analysis makes the score a property of the job and the CV rather
 * than of the dice — and skips the slowest step of a repeat run entirely.
 *
 * Keyed per user rather than globally: the JD text is the user's paste, and
 * an analysis one account paid for should not be readable through another.
 */
export async function analyzeJob({
  abortSignal,
  jdHash,
  jdText,
  sessionId,
  userId,
}: {
  readonly abortSignal?: AbortSignal;
  readonly jdHash: string;
  readonly jdText: string;
  readonly sessionId: string;
  readonly userId: string;
}): Promise<{ extraction: Extraction; cached: boolean }> {
  const previous = await db.application.findFirst({
    where: { userId, jdHash, jdExtraction: { not: Prisma.DbNull } },
    orderBy: { createdAt: "desc" },
    select: { jdExtraction: true },
  });
  const reused = ExtractionSchema.safeParse(previous?.jdExtraction);
  if (reused.success) return { extraction: reused.data, cached: true };

  const extraction = await generateStructured({
    abortSignal,
    applicationId: null,
    // Extraction, not deliberation: the JD text is right there and the schema
    // says exactly what to pull out.
    effort: "minimal",
    kind: "application",
    model: requireModelEnv("JD_ANALYST_MODEL"),
    name: "job_analysis",
    prompt: `Job description:\n\n${jdText}`,
    schema: ExtractionSchema,
    sessionId,
    system: JD_ANALYST_SYSTEM,
    userId,
  });
  return { extraction, cached: false };
}
