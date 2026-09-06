import type { Cv } from "./cv-schema.ts";

export type ProfileFacts = {
  skills: { name: string }[];
  experiences: { company: string; stack: string[] }[];
  projects: { title: string; stack: string[] }[];
};

const normalize = (term: string) => term.toLowerCase().trim();

/**
 * Every term the CV is allowed to put in a skill group or a stack array, in
 * the profile's own spelling. `findFabrications` accepts exactly these, so
 * handing the list to the writer up front is what keeps drafts compilable.
 */
export function allowedTerms(profile: ProfileFacts): string[] {
  const terms = new Set<string>();
  for (const skill of profile.skills) terms.add(skill.name);
  for (const exp of profile.experiences) for (const t of exp.stack) terms.add(t);
  for (const project of profile.projects) for (const t of project.stack) terms.add(t);
  return [...terms].sort((a, b) => a.localeCompare(b));
}

/**
 * Returns every claim in the CV that the master profile does not support.
 * This is the hard anti-hallucination boundary: the model can phrase things
 * however it likes, but it cannot introduce a skill, employer, or project.
 */
export function findFabrications(cv: Cv, profile: ProfileFacts): string[] {
  const knownTerms = new Set<string>();
  for (const skill of profile.skills) knownTerms.add(normalize(skill.name));
  for (const exp of profile.experiences) for (const t of exp.stack) knownTerms.add(normalize(t));
  for (const project of profile.projects) for (const t of project.stack) knownTerms.add(normalize(t));

  const knownCompanies = new Set(profile.experiences.map((e) => normalize(e.company)));
  const knownProjects = new Set(profile.projects.map((p) => normalize(p.title)));

  const violations: string[] = [];

  const claimedTerms = [
    ...cv.skills.flatMap((group) => group.items),
    ...cv.experiences.flatMap((exp) => exp.stack),
    ...cv.projects.flatMap((project) => project.stack),
  ];
  for (const term of claimedTerms) {
    if (!knownTerms.has(normalize(term))) {
      violations.push(`skill/stack term "${term}" is not in the master profile`);
    }
  }
  for (const exp of cv.experiences) {
    if (!knownCompanies.has(normalize(exp.company))) {
      violations.push(`employer "${exp.company}" is not in the master profile`);
    }
  }
  for (const project of cv.projects) {
    if (!knownProjects.has(normalize(project.title))) {
      violations.push(`project "${project.title}" is not in the master profile`);
    }
  }

  return [...new Set(violations)];
}
