/**
 * One definition of "how complete is this profile", shared by the CV builder's
 * live meter and the banner the rest of the app carries. Two scorers meant the
 * same profile read 13% on one screen and 10% on the other.
 *
 * Pure and dependency-free so the client editor can call it on every keystroke;
 * the database side lives in `app/lib/profile-completeness.ts`.
 */

/**
 * Below this, the app pushes the user back to the CV builder after sign-in and
 * keeps the banner up. A profile under 70% produces thin tailored CVs — the
 * agent can only draw on what the master profile holds, so an empty profile is
 * the one problem no amount of prompting fixes.
 */
export const COMPLETE_THRESHOLD = 70;

/** Five skills is the point where the keyword matcher has something to work with. */
const TARGET_SKILLS = 5;

/** The counted form of a profile — whatever shape it was stored or typed in. */
export type ProfileFacts = {
  fullName: string;
  headline: string;
  summary: string;
  phone: string;
  location: string;
  links: string[];
  skillCount: number;
  experienceCount: number;
  experienceWithBullets: number;
  educationCount: number;
  projectCount: number;
  languageCount: number;
};

export type ProfileCompleteness = {
  percent: number;
  complete: boolean;
  /** Short labels for what is still missing, biggest win first. */
  missing: string[];
};

/**
 * Weights add up to 100. They are deliberately lopsided towards experience and
 * skills: those two carry a tailored CV, while a missing location costs the
 * user almost nothing.
 */
export function scoreProfile(facts: ProfileFacts): ProfileCompleteness {
  const skillsShort = Math.max(TARGET_SKILLS - facts.skillCount, 0);

  const parts: { points: number; earned: number; label: string }[] = [
    { points: 8, earned: facts.fullName.trim() ? 8 : 0, label: "your name" },
    { points: 10, earned: facts.headline.trim() ? 10 : 0, label: "a headline" },
    { points: 15, earned: facts.summary.trim().length >= 40 ? 15 : 0, label: "a summary" },
    { points: 5, earned: facts.phone.trim() ? 5 : 0, label: "a phone number" },
    { points: 5, earned: facts.location.trim() ? 5 : 0, label: "your location" },
    {
      points: 5,
      earned: facts.links.some((link) => link.trim()) ? 5 : 0,
      label: "a link (LinkedIn, GitHub, site)",
    },
    {
      points: 15,
      earned: Math.round(15 * Math.min(facts.skillCount / TARGET_SKILLS, 1)),
      label:
        facts.skillCount === 0
          ? "your skills"
          : `${skillsShort} more skill${skillsShort === 1 ? "" : "s"}`,
    },
    { points: 12, earned: facts.experienceCount > 0 ? 12 : 0, label: "a work experience" },
    {
      points: 8,
      earned: facts.experienceWithBullets > 0 ? 8 : 0,
      label: "bullet points on your experience",
    },
    { points: 10, earned: facts.educationCount > 0 ? 10 : 0, label: "your education" },
    { points: 5, earned: facts.projectCount > 0 ? 5 : 0, label: "a project" },
    { points: 2, earned: facts.languageCount > 0 ? 2 : 0, label: "a language" },
  ];

  const percent = parts.reduce((sum, part) => sum + part.earned, 0);
  const missing = parts
    .filter((part) => part.earned < part.points)
    .sort((a, b) => b.points - a.points)
    .map((part) => part.label);

  return { percent, complete: percent >= COMPLETE_THRESHOLD, missing };
}

/** The editor's draft shape, structurally — it never leaves the browser. */
type FormShape = {
  fullName: string;
  headline: string;
  summary: string;
  contact: { phone: string; location: string; links: string[] };
  languages: { name: string }[];
  education: { institution: string }[];
  skills: { name: string }[];
  experiences: { company: string; role: string; bullets: string }[];
  projects: { title: string }[];
};

/**
 * Scores the unsaved form, so the builder's meter moves as the user types
 * instead of waiting for a round trip. Blank rows are ignored — the editor
 * keeps an empty row at the end of every list.
 */
export function scoreProfileForm(form: FormShape): ProfileCompleteness {
  return scoreProfile({
    fullName: form.fullName,
    headline: form.headline,
    summary: form.summary,
    phone: form.contact.phone,
    location: form.contact.location,
    links: form.contact.links,
    skillCount: form.skills.filter((skill) => skill.name.trim()).length,
    experienceCount: form.experiences.filter((e) => e.company.trim() && e.role.trim()).length,
    experienceWithBullets: form.experiences.filter(
      (e) => e.company.trim() && e.role.trim() && e.bullets.trim(),
    ).length,
    educationCount: form.education.filter((e) => e.institution.trim()).length,
    projectCount: form.projects.filter((p) => p.title.trim()).length,
    languageCount: form.languages.filter((l) => l.name.trim()).length,
  });
}
