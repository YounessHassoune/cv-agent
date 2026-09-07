/**
 * Self-check for the scoring rules. `node agent/lib/ats.test.ts` — no
 * framework, no fixtures. Each assertion pins one behaviour the score depends
 * on; if one fails the number the user sees is wrong.
 */
import assert from "node:assert/strict";
import {
  type JdKeyword,
  keywordScore,
  requiredYearsFromJd,
  scoreAts,
  structureScore,
  totalYears,
} from "./ats.ts";

const SECTIONS = { skills: "Skills", experience: "Experience", education: "Education" };
const kw = (term: string, weight = 1): JdKeyword => ({ term, weight, category: "hard" });

const CV = `Skills
Go, Kubernetes, Terraform, GraphQL
Experience
Senior Backend Engineer, Acme GmbH — Jan 2020 to Mar 2023
Built microservices in Go handling 12k requests per second
Managing a team of four through the migration to Kubernetes
Education
BSc Computer Science, TU Berlin`;

// --- matching survives inflection (real parsers stem; we must too) ---
assert.equal(keywordScore("Built microservices in Go", [kw("microservice")]).score, 100);
assert.equal(keywordScore("Managing a team of six", [kw("management")]).score, 100);
assert.equal(keywordScore("Developed internal tools", [kw("developer")]).score, 100);
assert.equal(keywordScore("Ran CI/CD pipelines daily", [kw("ci/cd pipeline")]).score, 100);
// ...but does not match things that are absent
assert.equal(keywordScore("Built microservices in Go", [kw("rust")]).score, 0);

// --- joiners are spelling, not meaning ---
assert.equal(keywordScore("Shipped a Node.js service", [kw("nodejs")]).score, 100);
assert.equal(keywordScore("Owned the CICD pipeline", [kw("ci/cd")]).score, 100);
assert.equal(keywordScore("Owned the CI-CD pipeline", [kw("ci/cd")]).score, 100);

// --- synonyms come from the JD analysis, not a table in this file ---
const golang: JdKeyword = { term: "Go", weight: 3, category: "hard", aliases: ["Golang"] };
assert.equal(keywordScore("Backend services written in Golang", [golang]).score, 100);
const nurse: JdKeyword = {
  term: "Registered Nurse",
  weight: 3,
  category: "hard",
  aliases: ["RN"],
};
assert.equal(keywordScore("RN, six years on a cardiac ward", [nurse]).score, 100);
// a keyword with no aliases still only matches itself
assert.equal(keywordScore("Backend services written in Golang", [kw("Go", 3)]).score, 0);

// --- a term only in the skills list is discounted, not free ---
const listed = keywordScore(CV, [kw("terraform", 1)], SECTIONS);
assert.deepEqual(listed.listedOnly, ["terraform"]);
assert.equal(listed.score, 60);
const evidenced = keywordScore(CV, [kw("kubernetes", 1)], SECTIONS);
assert.deepEqual(evidenced.listedOnly, []);
assert.equal(evidenced.score, 100);

// --- an unanalysed JD is unknown, never a perfect score ---
assert.equal(keywordScore(CV, []).score, 0);

// --- dates are not achievements ---
const datesOnly = [
  "Software Engineer, Acme Corp, Berlin — 2021 to 2023",
  "Senior Engineer, Globex GmbH, Munich — 2019 to 2021",
  "Junior Developer, Initech SARL, Lyon — 01/2017 to 12/2018",
  "Worked on the platform team and helped colleagues ship things",
].join("\n");
assert.equal(structureScore(datesOnly, []).score, 40); // headers only, no metric credit
assert.ok(structureScore("Cut p95 latency by 40% across the fleet of services", []).score > 40);

// --- years of experience, overlapping roles counted once ---
const y = (iso: string) => new Date(iso);
assert.equal(
  totalYears([
    { start: y("2018-01-01"), end: y("2022-01-01") },
    { start: y("2020-01-01"), end: y("2021-01-01") }, // fully inside the first
  ]),
  4,
);
assert.equal(requiredYearsFromJd("You have 5+ years backend and 2 years with Kubernetes"), 5);
assert.equal(requiredYearsFromJd("Founded 30 years ago"), null); // capped, not a requirement
assert.equal(requiredYearsFromJd("A great place to work"), null);

// --- a missing must-have gates the whole score ---
const jd = "Backend role. 3+ years. Go, Kubernetes and GraphQL in production.";
const base = { cvText: CV, jdText: jd, sections: SECTIONS };
const withAll = await scoreAts({ ...base, keywords: [kw("go", 3), kw("kubernetes", 3)] });
const withGap = await scoreAts({
  ...base,
  keywords: [kw("go", 3), kw("kubernetes", 3), kw("rust", 3)],
});
assert.equal(withAll.report.gate, 1);
assert.equal(withGap.report.gate, 2 / 3);
assert.deepEqual(withGap.report.missingMustHaves, ["rust"]);
assert.ok(
  withGap.report.total < withAll.report.total * 0.8,
  "a missing must-have must visibly cap the total",
);
assert.ok(withGap.report.suggestions[0].includes("Must-have"));

// --- title and years fit ---
const fitted = await scoreAts({
  ...base,
  keywords: [kw("go", 3)],
  fit: {
    role: "Senior Backend Engineer",
    cvTitles: ["Senior Backend Engineer"],
    requiredYears: 3,
    cvYears: 6,
  },
});
assert.equal(fitted.report.breakdown.fit, 100);
const misfit = await scoreAts({
  ...base,
  keywords: [kw("go", 3)],
  fit: { role: "Machine Learning Researcher", cvTitles: ["Senior Backend Engineer"], requiredYears: 10, cvYears: 2 },
});
assert.ok(misfit.report.breakdown.fit !== null && misfit.report.breakdown.fit < 30);
assert.ok(fitted.report.total > misfit.report.total);
// no JD signal at all → the component drops out instead of scoring zero
assert.equal((await scoreAts({ ...base, keywords: [kw("go", 3)] })).report.breakdown.fit, null);

// --- the ceiling is what the profile can truthfully reach, not 100 ---
const jdKeywords = [kw("go", 3), kw("kubernetes", 3), kw("rust", 3), kw("elixir", 1)];
const capped = await scoreAts({
  ...base,
  keywords: jdKeywords,
  claimableText: "Go, Kubernetes, Terraform, GraphQL, Postgres",
});
assert.deepEqual(capped.report.unclaimable, ["rust", "elixir"]);
// one of three must-haves is unreachable, so the ceiling is gated to 2/3 as well
assert.ok(
  capped.report.ceiling !== null && capped.report.ceiling < 70,
  `a profile missing a must-have cannot reach the target (ceiling ${capped.report.ceiling})`,
);
assert.ok(capped.report.ceiling! >= capped.report.total, "ceiling is never below the actual score");

const reachable = await scoreAts({
  ...base,
  keywords: [kw("go", 3), kw("kubernetes", 3)],
  claimableText: "Go, Kubernetes, Terraform",
});
assert.equal(reachable.report.unclaimable.length, 0);
assert.ok(reachable.report.ceiling! > capped.report.ceiling!);
// no profile text supplied → no ceiling claimed
assert.equal((await scoreAts({ ...base, keywords: jdKeywords })).report.ceiling, null);

// --- "security" and "secure" are one word to a parser ---
assert.equal(keywordScore("Built secure payment flows", [kw("security")]).score, 100);

// --- soft skills never gate the score ---
const soft: JdKeyword = { term: "collaboration", weight: 3, category: "soft" };
assert.equal((await scoreAts({ ...base, keywords: [kw("go", 3), soft] })).report.gate, 1);

// --- "Full Stack Developer" is the "Fullstack Engineer" every recruiter thinks it is ---
const spelled = await scoreAts({
  ...base,
  keywords: [kw("go", 3)],
  fit: { role: "Fullstack Engineer - IAM Team", cvTitles: ["Full Stack Developer"] },
});
assert.ok(spelled.report.breakdown.fit !== null && spelled.report.breakdown.fit >= 60, `fit ${spelled.report.breakdown.fit}`);
console.log("ats: all checks passed");

