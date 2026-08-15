import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/agent/lib/db.ts";
import { getCurrentUser } from "@/app/lib/current-user";
import { CV_TEMPLATE_IDS, DEFAULT_TEMPLATE } from "@/lib/cv-templates";

/** ~1.4MB of base64 ≈ a 1MB image; the editor downscales well below this. */
const MAX_PHOTO_CHARS = 1_400_000;

const ProfileInput = z.object({
  fullName: z.string().min(1),
  headline: z.string().optional(),
  summary: z.string().max(2000).optional(),
  template: z.enum(CV_TEMPLATE_IDS).optional(),
  photoUrl: z
    .string()
    .max(MAX_PHOTO_CHARS, "Photo is too large — use an image under 1MB.")
    .refine(
      (value) => value.startsWith("data:image/"),
      "Photo must be an inline image data URL.",
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
      start: z.string().min(4),
      end: z.string().optional(),
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
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues }, { status: 400 });
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
    contact: input.contact,
    languages: input.languages,
    education: input.education,
    skills: {
      create: input.skills.map((s) => ({ name: s.name, category: s.category ?? null })),
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
