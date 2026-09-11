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
 * Returns every claim in the CV that nothing permits.
 *
 * The profile is the source of truth, but it is not a complete inventory: a
 * developer whose profile lists React, Next.js and Nest.js plainly writes
 * TypeScript, and refusing to say so costs a real match for no honesty gained.
 * So `permitted` widens the vocabulary to the terms *this job asked for* —
 * a computable rule that lets the CV speak the role's language without letting
 * the writer wander into tech nobody mentioned.
 *
 * Employers and projects are never widened: those are facts, not vocabulary.
 *
 * Anything permitted but absent from the profile is still a claim the user has
 * to stand behind, so `unsupportedClaims` reports it for review.
 */
export function findFabrications(
  cv: Cv,
  profile: ProfileFacts,
  permitted: readonly string[] = [],
): string[] {
  const knownTerms = new Set<string>();
  for (const skill of profile.skills) knownTerms.add(normalize(skill.name));
  for (const exp of profile.experiences) for (const t of exp.stack) knownTerms.add(normalize(t));
  for (const project of profile.projects)
    for (const t of project.stack) knownTerms.add(normalize(t));

  const knownCompanies = new Set(profile.experiences.map((e) => normalize(e.company)));
  const knownProjects = new Set(profile.projects.map((p) => normalize(p.title)));

  const violations: string[] = [];

  const claimedTerms = [
    ...cv.skills.flatMap((group) => group.items),
    ...cv.experiences.flatMap((exp) => exp.stack),
    ...cv.projects.flatMap((project) => project.stack),
  ];
  const allowed = new Set([...knownTerms, ...permitted.map(normalize)]);
  for (const term of claimedTerms) {
    if (!allowed.has(normalize(term))) {
      violations.push(
        `skill/stack term "${term}" is neither in the master profile nor asked for by this job`,
      );
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

/**
 * Terms the CV claims that the master profile does not back up. These are
 * allowed through — the job asked for them and the profile is not exhaustive —
 * but they are the user's assertion, not the profile's, so every one is shown
 * for confirmation before the application is sent.
 */
export function unsupportedClaims(cv: Cv, profile: ProfileFacts): string[] {
  const known = new Set<string>();
  for (const skill of profile.skills) known.add(normalize(skill.name));
  for (const exp of profile.experiences) for (const t of exp.stack) known.add(normalize(t));
  for (const project of profile.projects) for (const t of project.stack) known.add(normalize(t));

  const claimed = [
    ...cv.skills.flatMap((group) => group.items),
    ...cv.experiences.flatMap((exp) => exp.stack),
    ...cv.projects.flatMap((project) => project.stack),
  ];

  const unsupported = new Map<string, string>(); // normalized -> first spelling seen
  for (const term of claimed) {
    const key = normalize(term);
    if (!known.has(key) && !unsupported.has(key)) unsupported.set(key, term);
  }
  return [...unsupported.values()];
}
