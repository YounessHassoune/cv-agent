import { defineTool } from "eve/tools";
import { z } from "zod";
import { titlesFor } from "../../lib/cv-sections";
import { type JdKeyword, scoreAts } from "../lib/ats";
import { resolveUserId } from "../lib/auth";
import { db } from "../lib/db";
import { readVariants } from "../lib/variants";

export default defineTool({
  description:
    "Score one compiled language variant against the job description (deterministic hybrid: weighted keywords 40%, semantic embedding similarity 40%, structure & quantified metrics 20%). Returns the total, breakdown, matched/missing keywords, and concrete suggestions. Call after every compile_pdf, with the same language.",
  inputSchema: z.object({
    applicationId: z.string(),
    language: z.string().min(2).describe("ISO code of the variant to score"),
  }),
  async execute({ applicationId, language }, ctx) {
    const userId = resolveUserId(ctx);
    const lang = language.toLowerCase();

    const application = await db.application.findFirst({
      where: { id: applicationId, userId },
    });
    if (!application) throw new Error(`No application ${applicationId} for this user.`);

    const variants = readVariants(application.variants);
    const variant = variants[lang];
    if (!variant?.cvText) {
      throw new Error(
        `No compiled "${lang}" variant on this application — call compile_pdf for that language first.`,
      );
    }

    const keywords = (application.jdKeywords ?? []) as JdKeyword[];
    const t = titlesFor(lang);

    const { report, jdEmbedding } = await scoreAts({
      cvText: variant.cvText,
      jdText: application.jdText,
      keywords,
      sectionTitles: [t.skills, t.experience, t.education],
      cachedJdEmbedding: (application.jdEmbedding as number[] | null) ?? undefined,
      abortSignal: ctx.abortSignal,
    });

    variants[lang] = { ...variant, atsReport: report };
    await db.application.update({
      where: { id: application.id },
      data: { variants, jdEmbedding: jdEmbedding ?? undefined },
    });

    return { language: lang, ...report };
  },
});
