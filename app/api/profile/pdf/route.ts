import { clampSkin } from "@/agent/lib/billing.ts";
import { EditedCvSchema } from "@/agent/lib/cv-schema.ts";
import { db } from "@/agent/lib/db.ts";
import { renderCvPdf } from "@/agent/lib/pdf.ts";
import { getCurrentUser } from "@/app/lib/current-user";
import { loadPdfPhoto } from "@/app/lib/pdf-photo";
import {
  CV_TEMPLATE_IDS,
  type CvTemplateId,
  DEFAULT_TEMPLATE,
  DEFAULT_THEME,
  normalizeTheme,
} from "@/lib/cv-templates";

/**
 * Renders the CV builder's current draft as a PDF.
 *
 * A POST rather than a GET because the builder's PDF view has to show what is
 * on screen, unsaved edits included — reading the profile back from the
 * database would show the document as it was before this session's typing, next
 * to a live preview showing it as it is now.
 *
 * The photo is the one exception: it is stored on the profile as soon as it is
 * uploaded, so it is read from there rather than shipped through the request.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    cv?: unknown;
    template?: string;
    theme?: string;
    photo?: boolean;
  } | null;

  const parsed = EditedCvSchema.safeParse(body?.cv);
  if (!parsed.success) return new Response("Invalid CV", { status: 400 });

  // Clamped to the plan, same as every other surface that renders a CV.
  const { template, theme } = await clampSkin(
    user.userId,
    CV_TEMPLATE_IDS.includes(body?.template as CvTemplateId)
      ? (body?.template as CvTemplateId)
      : DEFAULT_TEMPLATE,
    normalizeTheme(body?.theme) ?? DEFAULT_THEME,
  );

  const profile = body?.photo
    ? await db.profile.findUnique({
        where: { userId: user.userId },
        select: { photoUrl: true },
      })
    : null;

  const name = (parsed.data.header.fullName || "cv").replace(/[^\w-]+/g, "_");

  const pdf = await renderCvPdf(
    parsed.data,
    template,
    await loadPdfPhoto(profile?.photoUrl),
    theme,
  );

  return new Response(pdf, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${name}_CV.pdf"`,
      "cache-control": "no-store",
    },
  });
}
