import { z } from "zod";

/**
 * Structured JD analysis produced by the `jd-analyst` subagent (its task-mode
 * `outputSchema`) and consumed by the root `analyze_jd` tool, which validates
 * it again before persisting.
 */
export const ExtractionSchema = z.object({
  role: z.string().describe("The job title being hired for"),
  seniority: z.string().describe("junior | mid | senior | lead | unspecified"),
  language: z.string().describe("ISO code of the language the JD is written in"),
  domain: z
    .string()
    .default("")
    .describe("The industry/business domain of the role (e.g. fintech, e-commerce, healthcare)"),
  targetProfile: z
    .string()
    .default("")
    .describe(
      "2-3 sentences describing the profile the employer is actually looking for: role focus, core responsibilities, and what they value most. Written to brief a CV writer, not to repeat the JD.",
    ),
  responsibilities: z
    .array(z.string())
    .max(10)
    .default([])
    .describe(
      "The role's core responsibilities in the JD's own terminology, most important first",
    ),
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

export type Extraction = z.infer<typeof ExtractionSchema>;
