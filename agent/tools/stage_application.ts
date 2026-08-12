import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import { resolveUserId } from "../lib/auth";
import { db } from "../lib/db";

export default defineTool({
  description:
    "Finalize the tailored CV and submit it for the user's sign-off. This pauses for human approval — the approval prompt IS the review, so include an honest summary. On approval the application is marked APPROVED; if the user answers with feedback instead, apply it and re-run the compile/score loop.",
  inputSchema: z.object({
    applicationId: z.string(),
    summary: z
      .string()
      .min(20)
      .describe(
        "2-4 sentences for the reviewer: final ATS score, what was emphasized, and any missing JD keywords that could NOT be truthfully claimed",
      ),
  }),
  approval: always(),
  async execute({ applicationId, summary }, ctx) {
    const userId = resolveUserId(ctx);
    const application = await db.application.findFirst({
      where: { id: applicationId, userId },
    });
    if (!application) throw new Error(`No application ${applicationId} for this user.`);
    if (!application.pdfBytes) throw new Error("Nothing staged — compile_pdf has not produced a PDF.");

    const updated = await db.application.update({
      where: { id: application.id },
      data: { status: "APPROVED" },
    });

    return { applicationId: updated.id, status: updated.status, summary };
  },
});
