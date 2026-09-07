/**
 * Self-check for the anti-fabrication boundary. `node agent/lib/guard.test.ts`.
 * If this breaks, the CV either claims things nobody asked for, or refuses
 * things the job did.
 */
import assert from "node:assert/strict";
import type { Cv } from "./cv-schema.ts";
import { findFabrications, unsupportedClaims } from "./guard.ts";

const profile = {
  skills: [{ name: "React" }, { name: "Nest.js" }],
  experiences: [{ company: "Acme", stack: ["Node.js"] }],
  projects: [{ title: "Ledger", stack: [] }],
};

const cvWith = (items: string[]): Cv =>
  ({
    skills: [{ category: "Core", items }],
    experiences: [{ company: "Acme", stack: [] }],
    projects: [{ title: "Ledger", stack: [] }],
  }) as unknown as Cv;

// Profile terms are always fine.
assert.deepEqual(findFabrications(cvWith(["React", "Node.js"]), profile), []);

// A term this job asked for is allowed even though the profile omits it.
assert.deepEqual(findFabrications(cvWith(["TypeScript"]), profile, ["TypeScript"]), []);
// ...including via the alias the JD analysis supplied.
assert.deepEqual(findFabrications(cvWith(["k8s"]), profile, ["Kubernetes", "k8s"]), []);

// A term in neither list is still an invention.
assert.equal(findFabrications(cvWith(["C#"]), profile, ["TypeScript"]).length, 1);
assert.ok(findFabrications(cvWith(["C#"]), profile).length === 1, "no JD vocabulary = old behaviour");

// Employers and projects are facts and are never widened by the JD.
const wrongEmployer = {
  ...cvWith([]),
  experiences: [{ company: "Globex", stack: [] }],
} as unknown as Cv;
assert.equal(findFabrications(wrongEmployer, profile, ["Globex"]).length, 1);

// Everything the profile does not back is reported for the user to confirm,
// whether or not the job asked for it.
assert.deepEqual(unsupportedClaims(cvWith(["React", "TypeScript"]), profile), ["TypeScript"]);
assert.deepEqual(unsupportedClaims(cvWith(["React", "Node.js"]), profile), []);
// Reported once, in the spelling the CV used.
assert.deepEqual(unsupportedClaims(cvWith(["TypeScript", "typescript"]), profile), ["TypeScript"]);

console.log("guard: all checks passed");
