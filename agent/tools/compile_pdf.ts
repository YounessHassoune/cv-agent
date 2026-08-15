import { defineTool } from "eve/tools";
import { z } from "zod";
import { CV_TEMPLATE_IDS } from "../../lib/cv-templates";
import { resolveUserId } from "../lib/auth";
import { CvSchema } from "../lib/cv-schema";
import { db } from "../lib/db";
import { findFabrications } from "../lib/guard";
import { extractPdfText, renderCvPdf } from "../lib/pdf";
import { cvLoop } from "../lib/state";

export default defineTool({
  description:
    "Validate the tailored CV against the master profile, render it as an ATS-friendly single-column PDF, and store it on the application draft. Rejects any skill, stack term, or employer not present in the profile — fix the CV and retry if that happens.",
  inputSchema: z.object({
    applicationId: z.string(),
    cv: CvSchema,
    template: z
      .enum(CV_TEMPLATE_IDS)
      .optional()
      .describe(
        "Layout to render. Omit to use the template already chosen on this application or in the user's profile. All templates are ATS-safe.",
      ),
  }),
  async *execute({ applicationId, cv, template }, ctx) {
    const userId = resolveUserId(ctx);

    const loop = cvLoop.get();
    if (loop.iterations >= loop.cap) {
      throw new Error(
        `Iteration cap (${loop.cap}) reached for this application. Stop revising and call stage_application with the best draft so far.`,
      );
    }

    yield { phase: "validating", applicationId, iteration: loop.iterations + 1 };

    const application = await db.application.findFirst({
      where: { id: applicationId, userId },
    });
    if (!application) throw new Error(`No application ${applicationId} for this user.`);

    const profile = await db.profile.findUnique({
      where: { userId },
      include: { skills: true, experiences: true, projects: true },
    });
    if (!profile) throw new Error("No master profile for this user — call get_profile first.");

    const violations = findFabrications(cv, profile);
    if (violations.length > 0) {
      throw new Error(
        `CV rejected — fabricated content detected:\n- ${violations.join("\n- ")}\nRemove or replace these with items that exist in the profile, then call compile_pdf again.`,
      );
    }

    yield { phase: "rendering", applicationId, iteration: loop.iterations + 1 };

    // Explicit choice wins, then whatever this application already used, then
    // the profile default.
    const templateId = template ?? application.template ?? profile.template;

    const pdfBytes = await renderCvPdf(cv, templateId);
    const { text, pageCount } = await extractPdfText(pdfBytes);

    await db.application.update({
      where: { id: application.id },
      data: { cvJson: cv, cvText: text, pdfBytes, template: templateId, atsReport: undefined },
    });

    cvLoop.update((s) => ({ ...s, applicationId: application.id, iterations: s.iterations + 1 }));

    yield {
      phase: "complete",
      applicationId: application.id,
      iteration: loop.iterations + 1,
      iterationsRemaining: loop.cap - loop.iterations - 1,
      pageCount,
      textLength: text.length,
    };
  },
});
