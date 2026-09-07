import { z } from "zod";

/**
 * Structured JD analysis produced by the `jd-analyst` subagent (its task-mode
 * `outputSchema`) and consumed by the root `analyze_jd` tool, which validates
 * it again before persisting.
 *
 * **Every field is required — never add `.default()` here.** A default makes
 * the property optional in the generated JSON Schema, and OpenAI structured
 * outputs reject any object whose `required` list is not exhaustive
 * ("'required' ... including every key in properties"). The whole subagent
 * then fails on every call, and `analyze_jd` silently degrades to frequency
 * keywords — a broken score with no error anywhere. Use "" or [] as the empty
 * value and say so in `.describe()`.
 */
export const ExtractionSchema = z.object({
  role: z.string().describe("The job title being hired for"),
  seniority: z.string().describe("junior | mid | senior | lead | unspecified"),
  language: z.string().describe("ISO code of the language the JD is written in"),
  domain: z
    .string()
    .describe("The industry/business domain of the role (e.g. fintech, e-commerce, healthcare)"),
  targetProfile: z
    .string()
    .describe(
      "2-3 sentences describing the profile the employer is actually looking for: role focus, core responsibilities, and what they value most. Written to brief a CV writer, not to repeat the JD.",
    ),
  responsibilities: z
    .array(z.string())
    .max(10)
    .describe(
      "The role's core responsibilities in the JD's own terminology, most important first",
    ),
  keywords: z
    .array(
      z.object({
        term: z.string().describe("Short canonical term as it appears in the JD"),
        weight: z.number().min(1).max(3).describe("3 = must-have, 1 = nice-to-have"),
        category: z.enum(["hard", "tool", "domain", "soft"]),
        aliases: z
          .array(z.string())
          .describe(
            "Other names the SAME skill is written under, so a CV that spells it differently still matches: \"Golang\" for \"Go\", \"k8s\" for \"Kubernetes\", \"RN\" for \"Registered Nurse\". Never a related or broader skill. Empty array when the term has no common alternative spelling.",
          ),
      }),
    )
    .min(5)
    .max(30),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
