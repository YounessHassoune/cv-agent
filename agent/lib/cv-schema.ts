import { z } from "zod";

/**
 * The tailored CV the model must produce. `compile_pdf` takes this as tool
 * input, so a malformed or fabricated CV is rejected before any PDF exists.
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
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.string()).default([]),
  }),
  summary: z
    .string()
    .max(600)
    .optional()
    .describe("2-3 sentence professional summary tailored to the JD"),
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
        location: z.string().optional(),
        start: z.string().describe("Display date, e.g. 'Jan 2022'"),
        end: z.string().optional().describe("Display date; omit for current role"),
        bullets: z.array(z.string().min(1)).min(1),
        stack: z.array(z.string()).default([]),
      }),
    )
    .min(1),
  projects: z
    .array(
      z.object({
        title: z.string().min(1),
        link: z.string().optional(),
        bullets: z.array(z.string().min(1)).min(1),
        stack: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  education: z
    .array(
      z.object({
        institution: z.string().min(1),
        degree: z.string().min(1),
        dates: z.string().optional(),
      }),
    )
    .default([]),
  languages: z
    .array(z.object({ name: z.string().min(1), level: z.string().min(1) }))
    .default([]),
});

export type Cv = z.infer<typeof CvSchema>;
