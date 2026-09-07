import { defineAgent } from "eve";
import { ExtractionSchema } from "../../lib/extraction-schema";
import { requireModelEnv } from "../../lib/model-env";

/**
 * Cheap structured-parsing tier: reads a raw job description semantically and
 * returns the role, seniority, JD language, domain, target profile,
 * responsibilities, and weighted ATS keywords. Pure LLM work — no tools, no
 * database access (subagent sessions carry no user principal).
 */
export default defineAgent({
  description:
    "Analyze a raw job description semantically: returns the role, seniority, language, domain, a 2-3 sentence target profile (what the employer is really looking for), core responsibilities, and 5-30 weighted ATS keywords as structured output. Send the full JD text in the message. Call this before analyze_jd and pass its result along.",
  // Its own tier, not the shared EXTRACTION_MODEL. This one call gates the
  // whole pipeline — without it there is no role and no weighted keywords, so
  // nothing downstream can run — and the smallest tier failed it
  // intermittently. One short call per job: reliability is worth more than the
  // fraction of a cent.
  model: requireModelEnv("JD_ANALYST_MODEL"),
  // Extraction, not deliberation: the JD text is right there and the schema
  // says exactly what to pull out. Letting a reasoning model think its way
  // through this is what made "analyzing the job offer" the slowest step, and
  // on a small model it also burns the budget into empty responses.
  reasoning: "minimal",
  outputSchema: ExtractionSchema,
});
