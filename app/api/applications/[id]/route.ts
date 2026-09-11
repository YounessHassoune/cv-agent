import { NextResponse } from "next/server";
import { z } from "zod";
import { clampSkin } from "@/agent/lib/billing.ts";
import { db } from "@/agent/lib/db.ts";
import { readVariants } from "@/agent/lib/variants.ts";
import { getCurrentUser } from "@/app/lib/current-user";
import { CV_TEMPLATE_IDS, normalizeTheme } from "@/lib/cv-templates";

const Skin = z.object({
  language: z.string().min(2).optional(),
  template: z.enum(CV_TEMPLATE_IDS).optional(),
  theme: z.string().refine((value) => normalizeTheme(value) !== undefined, "Unknown theme").optional(),
});

/**
 * Remembers the layout and colour the user picked for this application.
 *
 * Template and theme are presentation choices: the preview restyles from
 * client state and the PDF route re-renders from the stored JSON, so picking
 * one never needed a recompile. But that state lived only in the page. The
 * header's Download link, built server-side, knew nothing of it and served
 * whatever the variant was compiled with — the user watched one document and
 * downloaded another. Saving the choice here, the moment it is made, is what
 * makes every download path agree with the preview.
 *
 * No re-render and no re-score: the content is unchanged, so the recorded ATS
 * text and score stay valid.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const parsed = Skin.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid skin." }, { status: 400 });
  }

  const application = await db.application.findFirst({
    where: { id, userId: user.userId },
    select: { template: true, theme: true, variants: true },
  });
  if (!application) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Clamped to the plan, as everywhere else: the picker is a lock, not a gate.
  const { template, theme } = await clampSkin(
    user.userId,
    parsed.data.template ?? application.template,
    parsed.data.theme ?? application.theme,
  );

  const variants = readVariants(application.variants);
  const language = parsed.data.language?.toLowerCase();
  const variant = language ? variants[language] : undefined;
  if (language && variant) variants[language] = { ...variant, template, theme };

  await db.application.update({
    where: { id },
    data: { template, theme, ...(variant ? { variants } : {}) },
  });

  return NextResponse.json({ template, theme });
}

/** Deletes one application, including its compiled PDF and stored chat. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  // Scoped by userId so one account can never delete another's row.
  const { count } = await db.application.deleteMany({ where: { id, userId: user.userId } });
  if (count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ deleted: id });
}
