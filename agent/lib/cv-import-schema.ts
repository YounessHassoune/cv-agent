import { z } from "zod";

/**
 * Shape the importer pulls out of an uploaded CV file. It mirrors the master
 * profile (`ProfileInput` in `app/api/profile/route.ts`) rather than the CV
 * document, because the result is fed straight into the profile editor.
 *
 * Every field is required and unknown values are empty strings / arrays: the
 * cheap structured-output models used for extraction handle a flat, fully
 * required schema far more reliably than optionals, and an empty string is
 * unambiguous where a missing key is not.
 *
 * Nothing here is trusted enough to write to the database on its own — the
 * result prefills the editor and the user saves it. `Experience.bullets` and
 * `stack` become the hallucination guard the cv-writer is held to, so the
 * extraction prompt copies them verbatim instead of paraphrasing.
 */
export const ImportedProfileSchema = z.object({
  fullName: z.string().describe("The candidate's full name, or \"\" if absent"),
  headline: z
    .string()
    .describe("Professional title as written on the CV, e.g. \"Full-Stack Engineer\". \"\" if absent"),
  summary: z
    .string()
    .describe(
      "The CV's own profile/summary/objective paragraph, copied verbatim. \"\" when the CV has none — never write one",
    ),
  contact: z.object({
    email: z.string().describe("Email address, or \"\""),
    phone: z.string().describe("Phone number as written, or \"\""),
    location: z.string().describe("City / country, or \"\""),
    links: z
      .array(z.string())
      .describe("Full URLs for LinkedIn, GitHub, portfolio, etc. Empty array if none"),
  }),
  languages: z
    .array(
      z.object({
        name: z.string().describe("Spoken language, e.g. \"French\" — never a programming language"),
        level: z.string().describe("Level as written, e.g. \"Native\", \"C1\". \"\" if absent"),
      }),
    )
    .describe("Spoken languages only"),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string().describe("Degree or programme name"),
      start: z.string().describe("YYYY-MM, or \"\" when the CV gives no start"),
      end: z.string().describe("YYYY-MM, or \"\" when ongoing or absent"),
    }),
  ),
  skills: z
    .array(
      z.object({
        name: z.string().describe("One skill, exactly as written on the CV"),
        category: z
          .string()
          .describe(
            "The CV's own grouping heading for this skill (e.g. \"Languages\", \"Cloud\"). \"\" when the CV lists skills flat",
          ),
      }),
    )
    .describe("One entry per skill — never a comma-joined list in a single entry"),
  experiences: z.array(
    z.object({
      company: z.string(),
      role: z.string().describe("Job title held at this company"),
      location: z.string().describe("City / country / \"Remote\", or \"\""),
      start: z.string().describe("YYYY-MM. Use YYYY-01 when only a year is given, \"\" when absent"),
      end: z.string().describe("YYYY-MM, or \"\" when this is the current role"),
      bullets: z
        .array(z.string())
        .describe(
          "The achievement lines under this role, copied verbatim with bullet glyphs stripped. Never merged, summarised or invented",
        ),
      stack: z
        .array(z.string())
        .describe("Only technologies explicitly named in this role's own text. Empty array if none"),
    }),
  ),
  projects: z.array(
    z.object({
      title: z.string(),
      description: z.string().describe("One-line description as written, or \"\""),
      link: z.string().describe("Project URL, or \"\""),
      bullets: z.array(z.string()).describe("Detail lines copied verbatim"),
      stack: z.array(z.string()).describe("Only technologies explicitly named for this project"),
    }),
  ),
});

export type ImportedProfile = z.infer<typeof ImportedProfileSchema>;
