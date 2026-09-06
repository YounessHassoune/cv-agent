import { defineAgent } from "eve";
import { CvSchema } from "../../lib/cv-schema";
import { requireModelEnv } from "../../lib/model-env";

/**
 * The writing tier: drafts or revises exactly one CV in exactly one language.
 * Pure LLM work — no tools, no database access (subagent sessions carry no
 * user principal); the parent packs everything into the message. To tailor
 * several languages, the parent emits several cv-writer calls in parallel.
 */
export default defineAgent({
  description:
    "Draft or revise one tailored CV in one target language, returned as structured CV JSON. Adapts the candidate's real experience to the role (transferable framing, no fabrication). The message must contain: the full master profile JSON (the only source of truth), the allowedTerms list, the jd-analyst role analysis (role, seniority, domain, target profile, responsibilities, weighted keywords), the target language, and — for revisions — the previous CV JSON plus the missing keywords or user feedback to address. One call per language.",
  model: requireModelEnv("CV_WRITER_MODEL"),
  outputSchema: CvSchema,
});
