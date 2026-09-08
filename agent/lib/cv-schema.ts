import { z } from "zod";

/**
 * The tailored CV the model must produce. `compile_pdf` takes this as tool
 * input, so a malformed or fabricated CV is rejected before any PDF exists.
 *
 * **Every field is required — never add `.optional()` or `.default()` here.**
 * Both make the property optional in the generated JSON Schema, and strict
 * structured-output providers reject any object whose `required` list is not
 * exhaustive, failing `cv-writer` on every single call. Use "" or [] as the
 * empty value and say so in `.describe()`; the renderer already treats an
 * empty string as absent.
 */
export const CvSchema = z.object({
  language: z
    .string()
    .min(2)
    .describe("ISO language code the CV is written in, e.g. 'en' or 'fr'"),
  header: z.object({
    fullName: z.string().min(1),
    headline: z.string().min(1).describe("Tailored to the target role"),
    email: z.string().min(3),
    phone: z.string().describe("Phone number, or \"\" when the profile has none"),
    location: z.string().describe("City / country, or \"\""),
    links: z.array(z.string()).describe("Profile URLs; empty array when there are none"),
  }),
  summary: z
    .string()
    .max(600)
    .describe("2-3 sentence professional summary tailored to the JD, or \"\" for none"),
  skills: z
    .array(
      z.object({
        category: z.string().describe("e.g. Languages, Frameworks, Cloud"),
        items: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
  experiences: z
    .array(
      z.object({
        company: z.string().min(1),
        role: z.string().min(1),
        location: z.string().describe("City / country / \"Remote\", or \"\""),
        start: z.string().describe("Display date, e.g. 'Jan 2022'"),
        end: z.string().describe("Display date; \"\" for a role still held"),
        bullets: z.array(z.string().min(1)).min(1),
        stack: z.array(z.string()).describe("Tech used in this role; [] when none"),
      }),
    )
    .min(1),
  projects: z
    .array(
      z.object({
        title: z.string().min(1),
        link: z.string().describe("Project URL, or \"\""),
        bullets: z.array(z.string().min(1)).min(1),
        stack: z.array(z.string()).describe("Tech used; [] when none"),
      }),
    )
    .describe("Empty array when the profile has no projects worth showing"),
  education: z
    .array(
      z.object({
        institution: z.string().min(1),
        degree: z.string().min(1),
        dates: z.string().describe("Display dates, or \"\""),
      }),
    )
    .describe("Empty array when the profile lists no education"),
  languages: z
    .array(z.object({ name: z.string().min(1), level: z.string().min(1) }))
    .describe("Spoken languages; empty array when none are listed"),
});

export type Cv = z.infer<typeof CvSchema>;

/**
 * The same CV, relaxed for hand editing.
 *
 * `CvSchema` is a contract with a model: every field required, every list
 * non-empty, so a half-built draft can never become a PDF. A person editing
 * their own document is not that — they delete their last project, clear a
 * headline they are rewriting, and save mid-thought. The strict minimums would
 * turn each of those into an error about a CV they can see in front of them.
 * The fabrication guard is skipped for the same reason: these are the user's
 * own words about their own work, not a model's claims about someone else's.
 */
export const EditedCvSchema = z.object({
  language: z.string().min(2),
  header: z.object({
    fullName: z.string(),
    headline: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    links: z.array(z.string()),
  }),
  summary: z.string().max(2000),
  skills: z.array(z.object({ category: z.string(), items: z.array(z.string()) })),
  experiences: z.array(
    z.object({
      company: z.string(),
      role: z.string(),
      location: z.string(),
      start: z.string(),
      end: z.string(),
      bullets: z.array(z.string()),
      stack: z.array(z.string()),
    }),
  ),
  projects: z.array(
    z.object({
      title: z.string(),
      link: z.string(),
      bullets: z.array(z.string()),
      stack: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({ institution: z.string(), degree: z.string(), dates: z.string() }),
  ),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
});
