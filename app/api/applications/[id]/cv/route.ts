import { NextResponse } from "next/server";
import { z } from "zod";

import {
  type JdKeyword,
  requiredYearsFromJd,
  scoreAts,
  totalYears,
} from "@/agent/lib/ats.ts";
import { EditedCvSchema } from "@/agent/lib/cv-schema.ts";
import { db } from "@/agent/lib/db.ts";
import { unsupportedClaims } from "@/agent/lib/guard.ts";
import { extractPdfText, renderCvPdf } from "@/agent/lib/pdf.ts";
import { readVariants, sameCv } from "@/agent/lib/variants.ts";
import { getCurrentUser } from "@/app/lib/current-user";
import { titlesFor } from "@/lib/cv-sections";
import { CV_TEMPLATE_IDS } from "@/lib/cv-templates";

const Body = z.object({
  language: z.string().min(2),
  cv: EditedCvSchema,
  template: z.enum(CV_TEMPLATE_IDS).optional(),
});

/**
 * Saves a hand-edited CV variant.
 *
 * The user edits the document itself, so this is the counterpart of
 * `compile_pdf` for edits that never went through the agent: it re-renders the
 * PDF, re-extracts the text an ATS would read, and re-scores it against the
 * same job description. Nothing here calls a model — the CV is already written
 * — but the score has to be recomputed, otherwise the rail would keep reporting
 * a number for a document that no longer exists.
 *
 * The fabrication guard deliberately does not run: it exists to stop a model
 * inventing experience, and these are the user's own words about their own
 * work. `unsupportedClaims` is still recomputed, because that list is shown to
 * the user as their own to defend, not as a rejection.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid CV." },
      { status: 400 },
    );
  }

  const language = parsed.data.language.toLowerCase();
  const cv = { ...parsed.data.cv, language };

  const application = await db.application.findFirst({
    where: { id, userId: user.userId },
    select: {
      id: true,
      jdText: true,
      jdKeywords: true,
      jdEmbedding: true,
      jdRole: true,
      template: true,
      variants: true,
    },
  });
  if (!application) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const variants = readVariants(application.variants);
  const variant = variants[language];
  if (!variant) {
    return NextResponse.json(
      { error: `No "${language}" variant on this application yet.` },
      { status: 404 },
    );
  }

  const template = parsed.data.template ?? variant.template ?? application.template;

  // Nothing changed — a Save on a document the user opened and closed again.
  // Re-rendering and re-embedding it would cost a model call for no difference.
  if (sameCv(variant.cvJson, cv) && template === variant.template) {
    return NextResponse.json({
      language,
      unchanged: true,
      report: variant.atsReport,
      updatedAt: variant.updatedAt,
    });
  }

  const profile = await db.profile.findUnique({
    where: { userId: user.userId },
    include: { skills: true, experiences: true, projects: true },
  });

  const pdfBytes = await renderCvPdf(cv, template);
  const { text, pageCount } = await extractPdfText(pdfBytes);

  // Everything the candidate can truthfully be said to have — the same input
  // score_ats builds, so a hand-edited variant is scored on the same terms as
  // a generated one.
  const claimableText = profile
    ? [
        profile.headline ?? "",
        profile.summary ?? "",
        ...profile.skills.map((skill) => skill.name),
        ...profile.experiences.flatMap((e) => [e.role, e.company, ...e.stack, ...e.bullets]),
        ...profile.projects.flatMap((p) => [p.title, p.description ?? "", ...p.stack, ...p.bullets]),
        JSON.stringify(profile.languages),
        JSON.stringify(profile.education),
      ].join("\n")
    : undefined;

  const { report, jdEmbedding } = await scoreAts({
    cvText: text,
    jdText: application.jdText,
    keywords: (application.jdKeywords ?? []) as JdKeyword[],
    sections: titlesFor(language),
    fit: {
      role: application.jdRole,
      cvTitles: [cv.header.headline, ...cv.experiences.map((e) => e.role)],
      requiredYears: requiredYearsFromJd(application.jdText),
      cvYears: profile ? totalYears(profile.experiences) : null,
    },
    claimableText,
    cachedJdEmbedding: (application.jdEmbedding as number[] | null) ?? undefined,
  });

  const updatedAt = new Date().toISOString();
  variants[language] = {
    ...variant,
    cvJson: cv,
    cvText: text,
    atsReport: report,
    template,
    pageCount,
    unsupported: profile ? unsupportedClaims(cv, profile) : (variant.unsupported ?? []),
    updatedAt,
  };

  await db.application.update({
    where: { id: application.id },
    data: { variants, template, jdEmbedding: jdEmbedding ?? undefined },
  });
  await db.cvPdf.upsert({
    where: { applicationId_language: { applicationId: application.id, language } },
    create: { applicationId: application.id, language, bytes: pdfBytes },
    update: { bytes: pdfBytes },
  });

  return NextResponse.json({
    language,
    report,
    pageCount,
    unsupported: variants[language].unsupported ?? [],
    updatedAt,
  });
}
