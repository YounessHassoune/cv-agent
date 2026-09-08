import { defineTool } from "eve/tools";
import { z } from "zod";
import { CV_TEMPLATE_IDS } from "../../lib/cv-templates";
import { resolveUserId } from "../lib/auth";
import type { JdKeyword } from "../lib/ats";
import { withDisplayDates } from "../lib/cv-dates";
import { CvSchema } from "../lib/cv-schema";
import { db } from "../lib/db";
import { findFabrications, unsupportedClaims } from "../lib/guard";
import { extractPdfText, renderCvPdf } from "../lib/pdf";
import { cvLoop } from "../lib/state";
import { readVariants, sameCv } from "../lib/variants";

/**
 * How many terms a CV may claim that the profile does not list. The job's
 * keywords widen the vocabulary, but every borrowed term is something the user
 * has to stand behind — a dozen of them is padding, not tailoring.
 */
const MAX_UNSUPPORTED_CLAIMS = 6;

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
  }),
  async *execute({ applicationId, language, cv: draft, template }, ctx) {
    const userId = resolveUserId(ctx);
    const lang = language.toLowerCase();
    const cv = withDisplayDates(draft, lang);

    const loop = cvLoop.get();
    const iteration = (loop.iterations[lang] ?? 0) + 1;
    if (iteration > loop.cap) {
      throw new Error(
        `Iteration cap (${loop.cap}) reached for the "${lang}" variant. Stop revising this language and call stage_application with the best drafts so far.`,
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
    const violations = findFabrications(cv, profile, jdVocabulary);
    const unsupported = unsupportedClaims(cv, profile);

    /*
     * The job's vocabulary is a licence to speak the role's language, not a
     * licence to acquire its experience. A draft that borrows a dozen terms
     * the profile never mentions is not tailored, it is padded: it inflates
     * the keyword score, and it hands the user a page of claims to defend in
     * an interview. Cap it, and make the writer choose its best ones.
     */
    if (violations.length === 0 && unsupported.length > MAX_UNSUPPORTED_CLAIMS) {
      const rejections = (loop.rejections[lang] ?? 0) + 1;
      cvLoop.update((s) => ({ ...s, rejections: { ...s.rejections, [lang]: rejections } }));

      if (rejections < loop.rejectionCap) {
        throw new Error(
          `CV rejected — it claims ${unsupported.length} terms the profile does not list, and ${MAX_UNSUPPORTED_CLAIMS} is the limit:\n- ${unsupported.join("\n- ")}\n` +
            `Keep at most ${MAX_UNSUPPORTED_CLAIMS} of these — the ones the candidate's real work makes genuinely credible — and remove the rest from skills[].items and the stack arrays. Cover what you remove with transferable framing in the prose instead, then call compile_pdf again. ${loop.rejectionCap - rejections} attempt(s) left for this language.`,
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

    const pdfBytes = await renderCvPdf(cv, templateId);
    const { text, pageCount } = await extractPdfText(pdfBytes);

    ctx.abortSignal.throwIfAborted();

    const variants = readVariants(application.variants);
    variants[lang] = {
      cvJson: cv,
      cvText: text,
      atsReport: null, // stale after a recompile — score_ats refreshes it
      template: templateId,
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

    yield {
      phase: "complete",
      applicationId: application.id,
      language: lang,
      iteration,
      iterationsRemaining: loop.cap - iteration,
      pageCount,
      textLength: text.length,
      unsupported,
      unsupportedNote:
        unsupported.length > 0
          ? "These come from the job description, not the profile. Name every one of them in the staging summary and tell the user to confirm or strike them before applying."
          : undefined,
    };
  },
});
