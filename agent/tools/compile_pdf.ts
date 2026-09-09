import { defineTool } from "eve/tools";
import { z } from "zod";
import { CV_TEMPLATE_IDS } from "../../lib/cv-templates";
import { resolveUserId } from "../lib/auth";
import { type JdKeyword, keywordScore } from "../lib/ats";
import { withDisplayDates } from "../lib/cv-dates";
import { CvSchema } from "../lib/cv-schema";
import { db } from "../lib/db";
import { screenAssertedTerms } from "../lib/asserted";
import { allowedTerms, findFabrications, unsupportedClaims } from "../lib/guard";
import { extractPdfText, renderCvPdf } from "../lib/pdf";
import { cvLoop } from "../lib/state";
import { readVariants, sameCv } from "../lib/variants";

/**
 * How many terms a CV may claim that the profile does not list. The job's
 * keywords widen the vocabulary, but every borrowed term is something the user
 * has to stand behind — a dozen of them is padding, not tailoring.
 */
const MAX_UNSUPPORTED_CLAIMS = 6;

/**
 * The borrowed terms this job cares about most, first. A term the JD never
 * mentions is worth nothing to the screen and everything to defend, so it
 * sorts last.
 */
function rankByJdWeight(terms: string[], keywords: JdKeyword[]): string[] {
  const weights = new Map<string, number>();
  for (const keyword of keywords) {
    for (const spelling of [keyword.term, ...(keyword.aliases ?? [])]) {
      const key = spelling.toLowerCase().trim();
      weights.set(key, Math.max(weights.get(key) ?? 0, keyword.weight));
    }
  }
  return [...terms].sort(
    (a, b) =>
      (weights.get(b.toLowerCase().trim()) ?? 0) - (weights.get(a.toLowerCase().trim()) ?? 0),
  );
}

export default defineTool({
  description:
    "Validate one language variant of the tailored CV against the master profile, render it as an ATS-friendly single-column PDF, and store it on the application. Call once per language. Rejects any skill, stack term, or employer not present in the profile — fix the CV and retry if that happens.",
  inputSchema: z.object({
    applicationId: z.string(),
    language: z
      .string()
      .min(2)
      .describe("ISO code of the variant being compiled — must be one of the application's target languages"),
    cv: CvSchema,
    template: z
      .enum(CV_TEMPLATE_IDS)
      .optional()
      .describe(
        "Layout to render. Omit to use the template already chosen on this application or in the user's profile. All templates are ATS-safe.",
      ),
    userAssertedTerms: z
      .array(z.string())
      .optional()
      .describe(
        "Terms the user has explicitly told you to put on the CV even though their profile does not list them. Pass them exactly as the user named them. They are exempt from the borrow budget and from the fabrication check, and are still reported back for confirmation. Only ever the user's own words — never a term you or cv-writer decided to add.",
      ),
  }),
  async *execute({ applicationId, language, cv: draft, template, userAssertedTerms }, ctx) {
    const userId = resolveUserId(ctx);
    const lang = language.toLowerCase();
    const cv = withDisplayDates(draft, lang);

    const loop = cvLoop.get();
    const iteration = (loop.iterations[lang] ?? 0) + 1;
    if (iteration > loop.cap) {
      throw new Error(
        `Iteration cap (${loop.cap}) reached for the "${lang}" variant in this turn. Stop revising it now: keep the best draft and tell the user where it landed. The budget refills on the user's next message, so never tell them revisions have run out.`,
      );
    }

    yield { phase: "validating", applicationId, language: lang, iteration };

    const application = await db.application.findFirst({
      where: { id: applicationId, userId },
    });
    if (!application) throw new Error(`No application ${applicationId} for this user.`);
    if (!application.languages.includes(lang)) {
      throw new Error(
        `"${lang}" is not a target language of this application (${application.languages.join(", ")}).`,
      );
    }

    /*
     * Idempotence. The orchestrator sometimes asks for the same language twice
     * — two dispatches, one result — and re-rendering a byte-identical CV would
     * spend one of the four compiles this language gets, plus a render, for a
     * document that already exists. Answer from what is stored instead.
     */
    const existingVariants = readVariants(application.variants);
    const previous = existingVariants[lang];
    if (previous !== undefined && sameCv(previous.cvJson, cv)) {
      const compiled = await db.cvPdf.findUnique({
        where: { applicationId_language: { applicationId: application.id, language: lang } },
        select: { id: true },
      });
      if (compiled !== null) {
        yield {
          phase: "complete",
          applicationId: application.id,
          language: lang,
          iteration: iteration - 1,
          iterationsRemaining: loop.cap - (iteration - 1),
          pageCount: previous.pageCount ?? null,
          textLength: previous.cvText.length,
          unsupported: previous.unsupported ?? [],
          unchanged: true,
          note: "This exact CV was already compiled — reusing it. No revision was spent.",
        };
        return;
      }
    }

    const profile = await db.profile.findUnique({
      where: { userId },
      include: { skills: true, experiences: true, projects: true },
    });
    if (!profile) throw new Error("No master profile for this user — call get_profile first.");

    // The job's own vocabulary widens what the CV may say — see findFabrications.
    const jdVocabulary = ((application.jdKeywords ?? []) as JdKeyword[]).flatMap((keyword) => [
      keyword.term,
      ...(keyword.aliases ?? []),
    ]);
    /*
     * What the user told us to put on the page, screened for whether it
     * belongs to this field at all, then merged into the session's standing
     * list — a later recompile must not have to be told again, which is
     * exactly how a turn dropped twelve terms the user had just asked for.
     */
    const screening = await screenAssertedTerms(userAssertedTerms ?? [], {
      jdText: application.jdText,
      keywords: (application.jdKeywords ?? []) as JdKeyword[],
      profileTerms: allowedTerms(profile),
      role: application.jdRole,
      abortSignal: ctx.abortSignal,
    });
    const asserted = [...new Set([...loop.assertedTerms, ...screening.accepted])];
    if (asserted.length !== loop.assertedTerms.length) {
      cvLoop.update((s) => ({ ...s, assertedTerms: asserted }));
    }
    const isAsserted = new Set(asserted.map((t) => t.toLowerCase()));

    const violations = findFabrications(cv, profile, [...jdVocabulary, ...asserted]);
    const unsupported = unsupportedClaims(cv, profile);
    // The budget governs what the writer borrows from the job description. A
    // term the user named themselves is not borrowed, it is instructed.
    const borrowed = unsupported.filter((term) => !isAsserted.has(term.toLowerCase()));
    const assertedInCv = unsupported.filter((term) => isAsserted.has(term.toLowerCase()));

    /*
     * The job's vocabulary is a licence to speak the role's language, not a
     * licence to acquire its experience. A draft that borrows a dozen terms
     * the profile never mentions is not tailored, it is padded: it inflates
     * the keyword score, and it hands the user a page of claims to defend in
     * an interview. Cap it, and make the writer choose its best ones.
     */
    if (violations.length === 0 && borrowed.length > MAX_UNSUPPORTED_CLAIMS) {
      const rejections = (loop.rejections[lang] ?? 0) + 1;
      cvLoop.update((s) => ({ ...s, rejections: { ...s.rejections, [lang]: rejections } }));

      if (rejections < loop.rejectionCap) {
        /*
         * Naming the keepers matters: told only to cut, the writer came back
         * with a draft that borrowed *nothing*, dropped a must-have its own
         * profile supported, and scored lower than the padded one it replaced.
         */
        const keep = rankByJdWeight(borrowed, (application.jdKeywords ?? []) as JdKeyword[]).slice(
          0,
          MAX_UNSUPPORTED_CLAIMS,
        );
        const drop = borrowed.filter((term) => !keep.includes(term));
        throw new Error(
          `CV rejected — it borrows ${borrowed.length} terms the profile does not list, and ${MAX_UNSUPPORTED_CLAIMS} is the limit.\n` +
            (assertedInCv.length > 0
              ? `The ${assertedInCv.length} the user asked for by name (${assertedInCv.join(", ")}) do not count against the limit — keep every one of them.\n`
              : "") +
            `Keep these ${keep.length} (this job weights them highest, and the candidate's work must genuinely support each one): ${keep.join(", ")}\n` +
            `Remove these from skills[].items and the stack arrays: ${drop.join(", ")}\n` +
            `Keep the ones you keep — a draft that borrows nothing is not tailored, and dropping a must-have costs more than any padding gains. Cover what you removed with transferable framing in the prose, then call compile_pdf again. ${loop.rejectionCap - rejections} attempt(s) left for this language.`,
        );
      }
      // Out of attempts: compiling a padded CV still beats no CV, and the
      // staging summary lists every one of these for the user to strike.
    }

    if (violations.length > 0) {
      const rejections = (loop.rejections[lang] ?? 0) + 1;
      cvLoop.update((s) => ({
        ...s,
        rejections: { ...s.rejections, [lang]: rejections },
      }));

      if (rejections >= loop.rejectionCap) {
        throw new Error(
          `CV rejected ${rejections}× for the "${lang}" variant — these terms are not in the profile and never will be:\n- ${violations.join("\n- ")}\n` +
            "Stop trying to include them. Ask cv-writer for a draft whose skill groups and stack arrays contain ONLY terms from the profile's allowedTerms list, and report these as unclaimable in the staging summary.",
        );
      }

      throw new Error(
        `CV rejected — unsupported content detected:\n- ${violations.join("\n- ")}\n` +
          `Entries in skills[].items, experiences[].stack and projects[].stack must come from the profile's allowedTerms or from this job's own keywords. These match neither, so nothing justifies them. Remove them, then call compile_pdf again. ${loop.rejectionCap - rejections} attempt(s) left for this language.`,
      );
    }

    // The turn may have been cancelled while we were validating — stop before
    // the expensive render.
    ctx.abortSignal.throwIfAborted();

    yield { phase: "rendering", applicationId, language: lang, iteration };

    // Explicit choice wins, then the application's template, then the profile default.
    const templateId = template ?? application.template ?? profile.template;
    // Colour is the user's presentation choice, never the agent's: it takes the
    // one already on the application, or the profile default.
    const themeId = application.theme ?? profile.theme;

    const pdfBytes = await renderCvPdf(cv, templateId, undefined, themeId);
    const { text, pageCount } = await extractPdfText(pdfBytes);

    ctx.abortSignal.throwIfAborted();

    const variants = readVariants(application.variants);
    variants[lang] = {
      cvJson: cv,
      cvText: text,
      atsReport: null, // stale after a recompile — score_ats refreshes it
      template: templateId,
      theme: themeId,
      pageCount,
      unsupported,
      updatedAt: new Date().toISOString(),
    };

    await db.application.update({
      where: { id: application.id },
      data: { variants, template: templateId },
    });
    await db.cvPdf.upsert({
      where: { applicationId_language: { applicationId: application.id, language: lang } },
      create: { applicationId: application.id, language: lang, bytes: pdfBytes },
      update: { bytes: pdfBytes },
    });

    cvLoop.update((s) => ({
      ...s,
      applicationId: application.id,
      iterations: { ...s.iterations, [lang]: iteration },
    }));

    /*
     * The borrow budget, as a number the model can see. Told only "at most
     * six", drafts came back with zero — dropping must-have terms their own
     * profile supported and scoring worse than the padded draft they replaced.
     * A count and the still-absent must-haves make the next instruction to
     * cv-writer concrete instead of a warning to be cautious about.
     */
    const jdKeywords = (application.jdKeywords ?? []) as JdKeyword[];
    const missingMustHaves = keywordScore(text, jdKeywords.filter((k) => k.weight >= 3)).missing;

    yield {
      phase: "complete",
      applicationId: application.id,
      language: lang,
      iteration,
      iterationsRemaining: loop.cap - iteration,
      pageCount,
      textLength: text.length,
      unsupported,
      borrowedTerms: borrowed.length,
      borrowBudget: MAX_UNSUPPORTED_CLAIMS,
      userAsserted: assertedInCv,
      pendingUserAsserted: asserted.filter(
        (term) => !unsupported.some((claim) => claim.toLowerCase() === term.toLowerCase()),
      ),
      refusedUserAsserted: screening.rejected,
      refusedNote:
        screening.rejected.length > 0
          ? `These are not part of this job's field, so they stay off the CV: ${screening.rejected.join(", ")}. Tell the user plainly which ones and why — a term from another trade costs the interview it reaches. Everything else they asked for is in.`
          : undefined,
      unscreenedNote: screening.unscreened
        ? "No embedding provider was available to check the requested terms against the job, so they were taken on the user's word."
        : undefined,
      missingMustHaves,
      mustHaveNote:
        missingMustHaves.length > 0 && borrowed.length < MAX_UNSUPPORTED_CLAIMS
          ? `This draft claims ${borrowed.length} of the ${MAX_UNSUPPORTED_CLAIMS} terms it is allowed to borrow, and these must-haves are still absent: ${missingMustHaves.join(", ")}. Each one the candidate's real work genuinely supports must be named in the CV — a missing must-have cuts the whole score. Send them to cv-writer with the previous CV, and leave out only the ones that would be untrue.`
          : undefined,
      unsupportedNote:
        borrowed.length > 0
          ? "These come from the job description, not the profile. Name every one of them in the staging summary and tell the user to confirm or strike them before applying. The terms under `userAsserted` are not among them — the user asked for those, so report them as included, never as something to confirm again."
          : undefined,
    };
  },
});
