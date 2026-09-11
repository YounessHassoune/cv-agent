import { db } from "@/agent/lib/db.ts";
import {
  type ProfileCompleteness,
  scoreProfile,
} from "@/lib/profile-completeness";

export { COMPLETE_THRESHOLD } from "@/lib/profile-completeness";
export type { ProfileCompleteness } from "@/lib/profile-completeness";

const EMPTY: ProfileCompleteness = {
  percent: 0,
  complete: false,
  missing: ["your profile"],
};

type StoredContact = { phone?: unknown; location?: unknown; links?: unknown };

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/**
 * How far along the saved master profile is. A user with no profile row at all
 * scores zero rather than throwing — that is a brand new account, which is
 * exactly the case the redirect exists for.
 */
export async function profileCompleteness(userId: string): Promise<ProfileCompleteness> {
  const profile = await db.profile.findUnique({
    where: { userId },
    select: {
      fullName: true,
      headline: true,
      summary: true,
      contact: true,
      languages: true,
      education: true,
      _count: { select: { skills: true, projects: true } },
      experiences: { select: { bullets: true } },
    },
  });

  if (!profile) return EMPTY;

  const contact = (profile.contact ?? {}) as StoredContact;
  const links = Array.isArray(contact.links) ? contact.links.map(text) : [];
  const education = Array.isArray(profile.education) ? profile.education : [];
  const languages = Array.isArray(profile.languages) ? profile.languages : [];

  return scoreProfile({
    fullName: profile.fullName,
    headline: profile.headline ?? "",
    summary: profile.summary ?? "",
    phone: text(contact.phone),
    location: text(contact.location),
    links,
    skillCount: profile._count.skills,
    experienceCount: profile.experiences.length,
    experienceWithBullets: profile.experiences.filter((e) => e.bullets.length > 0).length,
    educationCount: education.length,
    projectCount: profile._count.projects,
    languageCount: languages.length,
  });
}

/** Where to land a user after sign-in: the builder while the profile is thin. */
export async function landingPath(userId: string): Promise<string> {
  const { complete } = await profileCompleteness(userId);
  return complete ? "/dashboard" : "/dashboard/profile?complete=1";
}
