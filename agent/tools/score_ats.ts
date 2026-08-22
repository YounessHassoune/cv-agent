import { defineTool } from "eve/tools";
import { z } from "zod";
import { type JdKeyword, scoreAts } from "../lib/ats";
import { resolveUserId } from "../lib/auth";
import { db } from "../lib/db";
import { titlesFor } from "../../lib/cv-sections";

export default defineTool({
  description:
    "Score the compiled CV against the job description (deterministic hybrid: weighted keywords 40%, semantic embedding similarity 40%, structure & quantified metrics 20%). Returns the total, breakdown, matched/missing keywords, and concrete suggestions. Call after every compile_pdf.",
  inputSchema: z.object({ applicationId: z.string() }),
  async execute({ applicationId }, ctx) {
    const userId = resolveUserId(ctx);
    const application = await db.application.findFirst({
      where: { id: applicationId, userId },
    });
    if (!application) throw new Error(`No application ${applicationId} for this user.`);
    if (!application.cvText) {
      throw new Error("This application has no compiled CV yet — call compile_pdf first.");
    }

    const keywords = (application.jdKeywords ?? []) as JdKeyword[];
    const language = application.language;
    const t = titlesFor(language);

    const { report, jdEmbedding } = await scoreAts({
      cvText: application.cvText,
      jdText: application.jdText,
      keywords,
      sectionTitles: [t.skills, t.experience, t.education],
      cachedJdEmbedding: (application.jdEmbedding as number[] | null) ?? undefined,
    });

    await db.application.update({
      where: { id: application.id },
      data: { atsReport: report, jdEmbedding: jdEmbedding ?? undefined },
    });

    return report;
  },
});
