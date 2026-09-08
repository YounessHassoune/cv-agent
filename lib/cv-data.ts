import type { Cv } from "@/agent/lib/cv-schema.ts";
import type { CvPreviewData } from "@/components/cv-preview";

/**
 * The two shapes a CV takes in this app, and the pair of pure functions between
 * them.
 *
 * `Cv` is what the agent produces, what the PDF renders and what the database
 * stores; `CvPreviewData` is what the on-screen document renders and — now that
 * the preview is directly editable — what the user types into. Both the
 * application editor and the CV builder's PDF view cross that line, so the
 * mapping lives here rather than being written out a third time.
 */

/** The photo is not part of the tailored CV — it comes from the master profile. */
export function cvToPreview(cv: Cv, photoUrl?: string): CvPreviewData {
  return {
    photoUrl,
    fullName: cv.header.fullName,
    headline: cv.header.headline,
    language: cv.language,
    email: cv.header.email,
    phone: cv.header.phone,
    location: cv.header.location,
    links: cv.header.links,
    summary: cv.summary,
    skills: cv.skills,
    experiences: cv.experiences,
    projects: cv.projects,
    education: cv.education,
    languages: cv.languages,
  };
}

const clean = (value: string | undefined) => (value ?? "").trim();
const cleanList = (values: readonly string[] | undefined) =>
  (values ?? []).map((value) => value.trim()).filter(Boolean);

/**
 * Preview back to storable CV. Entries the user emptied out are dropped rather
 * than saved as blanks — an experience with no company and no role is a row
 * they deleted by clearing it, not a row they want on the document.
 */
export function previewToCv(preview: CvPreviewData, language: string): Cv {
  return {
    language,
    header: {
      fullName: clean(preview.fullName),
      headline: clean(preview.headline),
      email: clean(preview.email),
      phone: clean(preview.phone),
      location: clean(preview.location),
      links: cleanList(preview.links),
    },
    summary: clean(preview.summary),
    skills: (preview.skills ?? [])
      .map((group) => ({ category: clean(group.category), items: cleanList(group.items) }))
      .filter((group) => group.items.length > 0),
    experiences: (preview.experiences ?? [])
      .map((experience) => ({
        company: clean(experience.company),
        role: clean(experience.role),
        location: clean(experience.location),
        start: clean(experience.start),
        end: clean(experience.end),
        bullets: cleanList(experience.bullets),
        stack: cleanList(experience.stack),
      }))
      .filter((experience) => experience.company || experience.role),
    projects: (preview.projects ?? [])
      .map((project) => ({
        title: clean(project.title),
        link: clean(project.link),
        bullets: cleanList(project.bullets),
        stack: cleanList(project.stack),
      }))
      .filter((project) => project.title),
    education: (preview.education ?? [])
      .map((entry) => ({
        institution: clean(entry.institution),
        degree: clean(entry.degree),
        dates: clean(entry.dates),
      }))
      .filter((entry) => entry.institution || entry.degree),
    languages: (preview.languages ?? [])
      .map((entry) => ({ name: clean(entry.name), level: clean(entry.level) }))
      .filter((entry) => entry.name),
  };
}
