import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/agent/lib/db.ts";
import { isCloudinaryUrl } from "@/app/lib/cloudinary";
import { getCurrentUser } from "@/app/lib/current-user";
import { CV_TEMPLATE_IDS, DEFAULT_TEMPLATE, DEFAULT_THEME, normalizeTheme } from "@/lib/cv-templates";

/**
 * Photos now live on Cloudinary and the profile stores only the delivery URL.
 * Existing profiles may still hold an inline data URL from before that change,
 * so both are accepted — a data URL is only ever replaced, never created.
 */
const MAX_PHOTO_CHARS = 1_400_000;

/** `new Date("last summer")` is an Invalid Date, and Prisma throws on those. */
const isDate = (value: string) => !Number.isNaN(new Date(value).getTime());

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const ProfileInput = z.object({
  fullName: z.string().min(1),
  headline: z.string().optional(),
  summary: z.string().max(2000).optional(),
  template: z.enum(CV_TEMPLATE_IDS).optional(),
  // A preset id or a "#rrggbb" the user picked; anything else is dropped.
  theme: z.string().refine((value) => normalizeTheme(value) !== undefined, "Unknown theme").optional(),
  photoUrl: z
    .string()
    .max(MAX_PHOTO_CHARS, "Photo is too large — use an image under 1MB.")
    .refine(
      (value) => isCloudinaryUrl(value) || value.startsWith("data:image/"),
      "Photo must be an uploaded image URL.",
    )
    .optional(),
  contact: z.object({
    email: z.string(),
    phone: z.string().optional(),
    location: z.string().optional(),
    links: z.array(z.string()),
  }),
  languages: z.array(z.object({ name: z.string(), level: z.string() })),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      start: z.string().optional(),
      end: z.string().optional(),
    }),
  ),
  skills: z.array(z.object({ name: z.string().min(1), category: z.string().optional() })),
  experiences: z.array(
    z.object({
      company: z.string().min(1),
      role: z.string().min(1),
      location: z.string().optional(),
      start: z.string().min(4).refine(isDate, "Start date isn't a date the CV builder understands."),
      end: z
        .string()
        .optional()
        .refine((v) => !v || isDate(v), "End date isn't a date the CV builder understands."),
      bullets: z.array(z.string()),
      stack: z.array(z.string()),
    }),
  ),
  projects: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      link: z.string().optional(),
      bullets: z.array(z.string()),
      stack: z.array(z.string()),
    }),
  ),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const profile = await db.profile.findUnique({
    where: { userId: user.userId },
    include: { skills: true, experiences: { orderBy: { start: "desc" } }, projects: true },
  });
  return NextResponse.json({ profile });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = ProfileInput.safeParse(await request.json());
  if (!parsed.success) {
    // "invalid" told the editor nothing, so a rejected save looked like a bug
    // rather than a missing field. Name the first offending path instead.
    const [issue] = parsed.error.issues;
    const where = issue?.path.join(".") || "profile";
    return NextResponse.json(
      { error: `${where}: ${issue?.message ?? "invalid"}`, issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Skills/experiences/projects are fully replaced — the editor always submits
  // the complete profile, and stale rows would otherwise stay claimable.
  const data = {
    fullName: input.fullName,
    headline: input.headline ?? null,
    summary: input.summary ?? null,
    photoUrl: input.photoUrl ?? null,
    template: input.template ?? DEFAULT_TEMPLATE,
    theme: input.theme ?? DEFAULT_THEME,
    contact: input.contact,
    languages: input.languages,
    education: input.education,
    skills: {
      // `Skill` is unique per (profile, name) and CVs happily list the same
      // skill under two headings, which used to fail the whole save with a
      // constraint error the user could do nothing about. First one wins.
      create: input.skills
        .filter((s, i) => input.skills.findIndex((o) => same(o.name, s.name)) === i)
        .map((s) => ({ name: s.name, category: s.category ?? null })),
    },
    experiences: {
      create: input.experiences.map((e) => ({
        company: e.company,
        role: e.role,
        location: e.location ?? null,
        start: new Date(e.start),
        end: e.end ? new Date(e.end) : null,
        bullets: e.bullets.filter((b) => b.trim().length > 0),
        stack: e.stack.filter((t) => t.trim().length > 0),
      })),
    },
    projects: {
      create: input.projects.map((p) => ({
        title: p.title,
        description: p.description ?? null,
        link: p.link ?? null,
        bullets: p.bullets.filter((b) => b.trim().length > 0),
        stack: p.stack.filter((t) => t.trim().length > 0),
      })),
    },
  };

  const profile = await db.$transaction(async (tx) => {
    await tx.profile.deleteMany({ where: { userId: user.userId } });
    return tx.profile.create({
      data: { userId: user.userId, ...data },
      include: { skills: true, experiences: true, projects: true },
    });
  });

  return NextResponse.json({ profile });
}
