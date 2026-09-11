import { clampSkin } from "@/agent/lib/billing.ts";
import { db } from "@/agent/lib/db.ts";
import { renderCvPdf } from "@/agent/lib/pdf.ts";
import { readVariants } from "@/agent/lib/variants.ts";
import { getCurrentUser } from "@/app/lib/current-user";
import { loadPdfPhoto } from "@/app/lib/pdf-photo";
import { CV_TEMPLATE_IDS, type CvTemplateId, normalizeTheme } from "@/lib/cv-templates";

function requestedTemplate(url: URL): CvTemplateId | undefined {
  const value = url.searchParams.get("template");
  return CV_TEMPLATE_IDS.includes(value as CvTemplateId) ? (value as CvTemplateId) : undefined;
}

function requestedTheme(url: URL): string | undefined {
  return normalizeTheme(url.searchParams.get("theme"));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const application = await db.application.findFirst({
    where: { id, userId: user.userId },
    select: { languages: true, variants: true },
  });
  if (!application) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const requested = url.searchParams.get("lang")?.toLowerCase();
  const template = requestedTemplate(url);
  const theme = requestedTheme(url);
  // The photo is opt-in per request, driven by the review panel's switch, and
  // lives on the master profile rather than the tailored CV.
  const wantsPhoto = url.searchParams.get("photo") === "1";

  // Resolve the language first so only one PDF's bytes are ever loaded.
  const available = await db.cvPdf.findMany({
    where: { applicationId: id },
    select: { language: true },
  });
  const present = new Set(available.map((row) => row.language));
  // Default: the first target language that actually has a compiled PDF.
  const language = requested?.length
    ? present.has(requested)
      ? requested
      : undefined
    : (application.languages.find((lang) => present.has(lang)) ?? available[0]?.language);
  if (!language) return new Response("Not found", { status: 404 });

  const variant = readVariants(application.variants)[language];
  const name = (variant?.cvJson?.header?.fullName ?? "cv").replace(/[^\w-]+/g, "_");
  const headers = {
    "content-type": "application/pdf",
    "content-disposition": `inline; filename="${name}_CV_${language.toUpperCase()}.pdf"`,
    "cache-control": "no-store",
  };

  // Always re-render from the stored CV JSON when it is available, rather than
  // serving the bytes compiled earlier. Two reasons: it makes template
  // switching a presentation choice instead of an agent round-trip, and it
  // keeps the PDF honest against the current renderer — bytes compiled before
  // a layout fix would otherwise keep serving the old layout forever, and only
  // for whichever template the CV happened to be compiled with. Content is
  // identical either way, so the recorded ATS text and score stay valid.
  if (variant?.cvJson) {
    const profile = wantsPhoto
      ? await db.profile.findUnique({
          where: { userId: user.userId },
          select: { photoUrl: true },
        })
      : null;
    const photo = await loadPdfPhoto(profile?.photoUrl);

    // Query strings are typed by hand as easily as they are generated. A plan
    // that cannot compile a layout cannot preview it either, or the lock is
    // one URL edit deep.
    const skin = await clampSkin(
      user.userId,
      template ?? variant.template,
      theme ?? variant.theme,
    );

    return new Response(
      await renderCvPdf(variant.cvJson, skin.template, photo, skin.theme),
      { headers },
    );
  }

  // No CV JSON (a legacy row): the compiled bytes are all there is.
  const pdf = await db.cvPdf.findUnique({
    where: { applicationId_language: { applicationId: id, language } },
    select: { bytes: true },
  });
  if (!pdf) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(pdf.bytes), { headers });
}
