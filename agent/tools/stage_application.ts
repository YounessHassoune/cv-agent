import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { resolveUserId } from "../lib/auth";
import { db } from "../lib/db";
import { readVariants } from "../lib/variants";

export default defineTool({
  description:
    "Finalize the tailored CV — every language variant at once — and submit the application for the user's sign-off. Call exactly once per application, after all target languages are compiled and scored. This pauses for human approval — the approval prompt IS the review, so include an honest per-language summary. On approval the application is marked APPROVED; if the user answers with feedback instead, apply it and re-run the compile/score loop for the affected language(s).",
  inputSchema: z.object({
    applicationId: z.string(),
    summary: z
      .string()
      .min(20)
      .describe(
        "For the reviewer, covering EVERY language variant: each final ATS score, what was emphasized, and any missing JD keywords that could NOT be truthfully claimed",
      ),
  }),
  approval: always(),
  async execute({ applicationId, summary }, ctx) {
    const userId = resolveUserId(ctx);
    const application = await db.application.findFirst({
      where: { id: applicationId, userId },
      include: { pdfs: { select: { language: true } } },
    });
    if (!application) throw new Error(`No application ${applicationId} for this user.`);

    const variants = readVariants(application.variants);
    const compiled = new Set(application.pdfs.map((pdf) => pdf.language));
    const incomplete = application.languages.filter(
      (lang) => !compiled.has(lang) || !variants[lang]?.atsReport,
    );
    if (incomplete.length > 0) {
      throw new Error(
        `Not ready to stage — these target languages still need compile_pdf and score_ats: ${incomplete.join(", ")}.`,
      );
    }

    const updated = await db.application.update({
      where: { id: application.id },
      data: { status: "APPROVED" },
    });

    return {
      applicationId: updated.id,
      status: updated.status,
      languages: application.languages,
      scores: Object.fromEntries(
        application.languages.map((lang) => [lang, variants[lang]?.atsReport?.total ?? null]),
      ),
      summary,
    };
  },
});
