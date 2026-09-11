/**
 * Localized section titles. The PDF, the on-screen preview and the ATS
 * structure check all read them from here, so the three can never drift apart.
 */
export type SectionTitles = {
  summary: string;
  skills: string;
  experience: string;
  projects: string;
  education: string;
  languages: string;
};

export const SECTION_TITLES: Record<string, SectionTitles> = {
  en: {
    summary: "Summary",
    skills: "Skills",
    experience: "Experience",
    projects: "Projects",
    education: "Education",
    languages: "Languages",
  },
  fr: {
    summary: "Profil",
    skills: "Compétences",
    experience: "Expérience",
    projects: "Projets",
    education: "Formation",
    languages: "Langues",
  },
  es: {
    summary: "Perfil",
    skills: "Habilidades",
    experience: "Experiencia",
    projects: "Proyectos",
    education: "Educación",
    languages: "Idiomas",
  },
  de: {
    summary: "Profil",
    skills: "Kenntnisse",
    experience: "Berufserfahrung",
    projects: "Projekte",
    education: "Ausbildung",
    languages: "Sprachen",
  },
};

export function titlesFor(language: string | null | undefined): SectionTitles {
  return SECTION_TITLES[(language ?? "").slice(0, 2).toLowerCase()] ?? SECTION_TITLES.en;
}
