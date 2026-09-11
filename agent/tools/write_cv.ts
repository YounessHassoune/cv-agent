import { defineTool } from "eve/tools";
import { z } from "zod";
import { screenAssertedTerms } from "../lib/asserted";
import type { JdKeyword } from "../lib/ats";
import { resolveUserId } from "../lib/auth";
import { CvSchema } from "../lib/cv-schema";
import { db } from "../lib/db";
import { type Extraction, ExtractionSchema } from "../lib/extraction-schema";
import { applicationGone } from "../lib/gone";
import { allowedTerms, unsupportedClaims } from "../lib/guard";
import { generateStructured } from "../lib/llm";
import { requireModelEnv } from "../lib/model-env";
import { CV_WRITER_SYSTEM } from "../lib/prompts/cv-writer";
import { cvLoop } from "../lib/state";
import { readDrafts, readVariants } from "../lib/variants";

/** Same budget `compile_pdf` enforces; named here so the receipt can say so. */
const BORROW_BUDGET = 6;

/**
 * Row bookkeeping the writer has no use for. Every token of it rode in the
 * prompt on every call when the orchestrator pasted `get_profile`'s output.
 */
const NOISE_KEYS = new Set([
  "id",
  "userId",
  "profileId",
  "createdAt",
  "updatedAt",
  "photoUrl",
  "photoPublicId",
  "template",
  "theme",
]);

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^p{L}p{N}]+/gu, " ")
    .trim();

/** "2025-06-01T00:00:00.000Z" → "2025-06"; compile_pdf turns that into "Jun 2025". */
const isoMonth = (date: Date | string | null | undefined) =>
  date ? new Date(date).toISOString().slice(0, 7) : "";

/**
 * Dates come from the profile, never from the writer.
 *
 * A date is a fact like an employer name, and the schema still asks the model
 * to write it out. At the default effort it copied the profile's timestamps;
 * at low effort it wrote "" for every role and the CV went out undated. Match
 * each entry back to the profile by employer (and role, when one employer has
 * several) and stamp the profile's own dates over whatever the model wrote.
 * An entry that matches nothing keeps the model's value — there is nothing
 * truer to replace it with.
 */
function stampProfileDates<
  T extends {
    experiences: { company: string; role: string; start: string; end: string }[];
    education: { institution: string; dates: string }[];
  },
>(
  cv: T,
  profile: {
    experiences: { company: string; role: string; start: Date; end: Date | null }[];
    education: unknown;
  },
): T {
  const unused = new Set(profile.experiences);
  const experiences = cv.experiences.map((entry) => {
    const sameCompany = profile.experiences.filter(
      (candidate) =>
        unused.has(candidate) && normalizeName(candidate.company) === normalizeName(entry.company),
    );
    const match =
      sameCompany.find(
        (candidate) => normalizeName(candidate.role) === normalizeName(entry.role),
      ) ?? sameCompany[0];
    if (match === undefined) return entry;
    unused.delete(match);
    return { ...entry, start: isoMonth(match.start), end: isoMonth(match.end) };
  });

  const known = Array.isArray(profile.education)
    ? (profile.education as { institution?: string; start?: string; end?: string }[])
    : [];
  const education = cv.education.map((entry) => {
    const match = known.find(
      (candidate) =>
        candidate.institution !== undefined &&
        normalizeName(candidate.institution) === normalizeName(entry.institution),
    );
    if (match === undefined) return entry;
    const start = isoMonth(match.start || null);
    const end = isoMonth(match.end || null);
    const dates = start && end ? `${start} – ${end}` : end || start;
    return dates ? { ...entry, dates } : entry;
  });

  return { ...cv, experiences, education };
}

function stripNoise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNoise);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !NOISE_KEYS.has(key))
      .map(([key, entry]) => [key, stripNoise(entry)]),
  );
}

export default defineTool({
  description:
    "Write, or revise, the tailored CV for one language of an application and store it as that language's draft. Reads the master profile, the job analysis and any previous draft itself — pass nothing but the ids, and for a revision the feedback. Call once per language, in parallel for several. Then call compile_pdf for that language.",
  inputSchema: z.object({
    applicationId: z.string(),
    language: z
      .string()
      .min(2)
      .describe("ISO code of the CV to write — one of the application's target languages"),
    feedback: z
      .string()
      .optional()
      .describe(
        "For a revision only: what to change, in plain words — the compile rejection, the score report's reason, or the user's request. Omit for the first draft.",
      ),
    missingKeywords: z
      .array(z.string())
      .optional()
      .describe(
        "For a revision only: the job keywords the previous draft did not cover and the candidate's real work supports. The writer adds each one where it was genuinely used.",
      ),
    userAssertedTerms: z
      .array(z.string())
      .optional()
      .describe(
        "Terms the user has explicitly told you to put on the CV even though their profile does not list them, in their own spelling. Only ever the user's own words.",
      ),
  }),
  async execute({ applicationId, language, feedback, missingKeywords, userAssertedTerms }, ctx) {
    const userId = resolveUserId(ctx);
    const lang = language.toLowerCase();

    const application = await db.application.findFirst({ where: { id: applicationId, userId } });
    if (!application) return applicationGone(applicationId);
    if (!application.languages.includes(lang)) {
      throw new Error(
        `"${lang}" is not a target language of this application (${application.languages.join(", ")}).`,
      );
    }

    const profile = await db.profile.findUnique({
      where: { userId },
      include: {
        skills: { orderBy: { category: "asc" } },
        experiences: { orderBy: { start: "desc" } },
        projects: true,
      },
    });
    if (!profile) {
      throw new Error(
        "The user has no master profile yet. Tell them to fill it in first, and stop.",
      );
    }

    const keywords = (application.jdKeywords ?? []) as JdKeyword[];
    /*
     * Rows created before the analysis was stored carry only the keywords and
     * the title. Enough to write from — the writer's brief just has fewer
     * priorities to lean on.
     */
    const parsed = ExtractionSchema.safeParse(application.jdExtraction);
    const analysis: Extraction = parsed.success
      ? parsed.data
      : {
          role: application.jdRole ?? "",
          seniority: application.jdSeniority ?? "unspecified",
          language: "",
          domain: "",
          targetProfile: "",
          responsibilities: [],
          keywords: keywords.map((k) => ({
            term: k.term,
            weight: k.weight,
            category: "hard" as const,
            aliases: k.aliases ?? [],
          })),
        };

    /*
     * Same screening and same standing list as `compile_pdf`, so the two agree
     * on which user-named terms are vocabulary. A term screened out here never
     * reaches the page, so it never becomes a rejection later.
     */
    const loop = cvLoop.get();
    const profileTerms = allowedTerms(profile);
    const screening = await screenAssertedTerms(userAssertedTerms ?? [], {
      jdText: application.jdText,
      keywords,
      profileTerms,
      role: application.jdRole,
      abortSignal: ctx.abortSignal,
    });
    const asserted = [...new Set([...loop.assertedTerms, ...screening.accepted])];
    if (asserted.length !== loop.assertedTerms.length) {
      cvLoop.update((s) => ({ ...s, assertedTerms: asserted }));
    }

    // The draft in progress wins over the last compiled copy: a revision of a
    // rejected draft has to start from the rejected draft.
    const previous =
      readDrafts(application.drafts)[lang] ?? readVariants(application.variants)[lang]?.cvJson;
    const revising =
      previous !== undefined && (feedback !== undefined || (missingKeywords?.length ?? 0) > 0);

    const sections = [
      `TARGET LANGUAGE (ISO code — set the CV's \`language\` field to it): ${lang}`,
      `ROLE ANALYSIS:\n${JSON.stringify({ ...analysis, keywords: undefined }, null, 0)}`,
      `jdKeywords (this job's weighted keywords; term, weight 3 = must-have, aliases):\n${JSON.stringify(
        keywords.map((k) => ({ term: k.term, weight: k.weight, aliases: k.aliases ?? [] })),
      )}`,
      `allowedTerms (every skill the profile itself supports):\n${JSON.stringify(profileTerms)}`,
      asserted.length > 0
        ? `userAssertedTerms (the user insisted on these — include every one):\n${JSON.stringify(asserted)}`
        : null,
      `MASTER PROFILE JSON (the only source of truth):\n${JSON.stringify(stripNoise(profile))}`,
      revising
        ? `PREVIOUS CV JSON (revise this — change what the feedback asks for, keep the rest stable):\n${JSON.stringify(previous)}`
        : null,
      revising && feedback ? `FEEDBACK:\n${feedback}` : null,
      revising && missingKeywords?.length
        ? `MISSING KEYWORDS the profile truthfully supports — add each to the matching skill group and to one bullet where it was genuinely used:\n${JSON.stringify(missingKeywords)}`
        : null,
      revising
        ? "Return the complete revised CV JSON."
        : "Write the complete tailored CV JSON for this job.",
    ].filter((section): section is string => section !== null);

    const cv = await generateStructured({
      abortSignal: ctx.abortSignal,
      applicationId: application.id,
      /*
       * Low, not the provider default. The writer follows a long brief with
       * three permitted-vocabulary lists and a fixed bullet formula; the
       * truth checks that guarantee the result live in `compile_pdf` and the
       * scorer, not in the writer's deliberation. At the default it thought
       * for a minute and a half per draft for the same page.
       */
      effort: "low",
      kind: "application",
      model: requireModelEnv("CV_WRITER_MODEL"),
      name: "cv",
      prompt: sections.join("\n\n"),
      schema: CvSchema,
      sessionId: ctx.session.id,
      system: CV_WRITER_SYSTEM,
      userId,
    });
    cv.language = lang;
    const stamped = stampProfileDates(cv, profile);

    ctx.abortSignal.throwIfAborted();

    /*
     * Merged in the database rather than read-modify-written here: the
     * languages are written in parallel, and two writers each saving their own
     * copy of the whole map is how one of them disappears.
     */
    await db.$executeRaw`
      UPDATE "Application"
      SET "drafts" = COALESCE("drafts", '{}'::jsonb) || ${JSON.stringify({ [lang]: stamped })}::jsonb
      WHERE "id" = ${application.id}
    `;

    const isAsserted = new Set(asserted.map((term) => term.toLowerCase()));
    const borrowed = unsupportedClaims(stamped, profile).filter(
      (term) => !isAsserted.has(term.toLowerCase()),
    );

    return {
      applicationId: application.id,
      language: lang,
      draftReady: true,
      revision: revising,
      experiences: stamped.experiences.length,
      projects: stamped.projects.length,
      borrowedTerms: borrowed,
      borrowBudget: BORROW_BUDGET,
      refusedUserAsserted: screening.rejected,
      note:
        borrowed.length > BORROW_BUDGET
          ? `This draft borrows ${borrowed.length} terms the profile does not list; compile_pdf allows ${BORROW_BUDGET} and will say which to keep. Call compile_pdf now.`
          : "Draft stored. Call compile_pdf for this language now.",
    };
  },
});
