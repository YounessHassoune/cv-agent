import { defineTool } from "eve/tools";
import { z } from "zod";
import { CV_TEMPLATE_IDS } from "../../lib/cv-templates";
import { resolveUserId } from "../lib/auth";
import { CvSchema } from "../lib/cv-schema";
import { db } from "../lib/db";
import { findFabrications } from "../lib/guard";
import { extractPdfText, renderCvPdf } from "../lib/pdf";
import { cvLoop } from "../lib/state";
import { readVariants } from "../lib/variants";

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
  async *execute({ applicationId, language, cv, template }, ctx) {
    const userId = resolveUserId(ctx);
    const lang = language.toLowerCase();

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

    const profile = await db.profile.findUnique({
      where: { userId },
      include: { skills: true, experiences: true, projects: true },
    });
    if (!profile) throw new Error("No master profile for this user — call get_profile first.");

    const violations = findFabrications(cv, profile);
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
        `CV rejected — fabricated content detected:\n- ${violations.join("\n- ")}\n` +
          `Every entry in skills[].items, experiences[].stack and projects[].stack must be copied verbatim from the profile's allowedTerms. Remove these terms (do not substitute variants), then call compile_pdf again. ${loop.rejectionCap - rejections} attempt(s) left for this language.`,
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
    };
  },
});
