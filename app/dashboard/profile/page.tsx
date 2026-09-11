import { db } from "@/agent/lib/db.ts";
import { requireUser } from "@/app/lib/current-user";
import { DEFAULT_TEMPLATE, DEFAULT_THEME } from "@/lib/cv-templates";
import { ProfileEditor, type ProfileForm } from "./profile-editor";

export const dynamic = "force-dynamic";

const isoDate = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : "");

const empty: ProfileForm = {
  fullName: "",
  headline: "",
  summary: "",
  photoUrl: "",
  template: DEFAULT_TEMPLATE,
  theme: DEFAULT_THEME,
  contact: { email: "", phone: "", location: "", links: [] },
  languages: [],
  education: [],
  skills: [],
  experiences: [],
  projects: [],
};

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await db.profile.findUnique({
    where: { userId: user.userId },
    include: { skills: true, experiences: { orderBy: { start: "desc" } }, projects: true },
  });

  if (!profile) {
    return (
      <ProfileEditor initial={{ ...empty, contact: { ...empty.contact, email: user.email } }} />
    );
  }

  const contact = (profile.contact ?? {}) as Partial<ProfileForm["contact"]>;

  const initial: ProfileForm = {
    fullName: profile.fullName,
    headline: profile.headline ?? "",
    summary: profile.summary ?? "",
    photoUrl: profile.photoUrl ?? "",
    template: profile.template ?? DEFAULT_TEMPLATE,
    theme: profile.theme ?? DEFAULT_THEME,
    contact: {
      email: contact.email ?? user.email,
      phone: contact.phone ?? "",
      location: contact.location ?? "",
      links: contact.links ?? [],
    },
    languages: (profile.languages ?? []) as ProfileForm["languages"],
    education: (profile.education ?? []) as ProfileForm["education"],
    skills: profile.skills.map((s) => ({ name: s.name, category: s.category ?? "" })),
    experiences: profile.experiences.map((e) => ({
      company: e.company,
      role: e.role,
      location: e.location ?? "",
      start: isoDate(e.start),
      end: isoDate(e.end),
      bullets: e.bullets.join("\n"),
      stack: e.stack.join(", "),
    })),
    projects: profile.projects.map((p) => ({
      title: p.title,
      description: p.description ?? "",
      link: p.link ?? "",
      bullets: p.bullets.join("\n"),
      stack: p.stack.join(", "),
    })),
  };

  return <ProfileEditor initial={initial} />;
}
