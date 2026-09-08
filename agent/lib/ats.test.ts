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
  sanitizeKeywords,
  semanticToScore,
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

// --- one requirement, three spellings: the biggest source of lost points ---
assert.equal(keywordScore("Data analysis for retail clients", [kw("Data Analytics")]).score, 100);
assert.equal(keywordScore("Owned the data analytics roadmap", [kw("data analysis")]).score, 100);
assert.equal(keywordScore("Data visualisation in Power BI", [kw("Data Visualization")]).score, 100);
assert.equal(keywordScore("Data modelling in SQL", [kw("data modeling")]).score, 100);
assert.equal(keywordScore("Statistical modelling of demand", [kw("statistics")]).score, 100);
// ...without merging things that are genuinely different
assert.equal(keywordScore("Data analysis for retail", [kw("Databricks")]).score, 0);

// --- a term the CV carries is claimable, whatever language the profile is in ---
const french = await scoreAts({
  ...base,
  cvText: "Skills\nGo, Data Visualization\nExperience\nBuilt dashboards\nEducation\nBSc",
  keywords: [kw("Data Visualization", 3)],
  claimableText: "Visualisation de données et tableaux de bord",
});
assert.deepEqual(french.report.unclaimable, []);
assert.ok(
  french.report.ceiling !== null && french.report.ceiling >= french.report.total,
  `ceiling ${french.report.ceiling}`,
);

/*
 * --- the semantic scale is anchored to what this JD can actually produce ---
 *
 * Measured with text-embedding-3-small on a real ad: unrelated prose 0.09, an
 * ad from another field 0.19, a strong real CV 0.38, a recitation of the ad's
 * own requirements 0.46. A CV never approaches 1 — half a job ad is company
 * boilerplate — so a fixed 0.2–0.75 window scored a perfect CV at 35/100.
 */
const anchors = { floor: 0.17, top: 0.46 };
assert.equal(semanticToScore(0.09, anchors), 0); // unrelated prose
assert.equal(semanticToScore(0.19, anchors), 7); // another field's job ad
assert.ok(semanticToScore(0.38, anchors) > 65, "a strong on-topic CV must not read as a poor match");
assert.equal(semanticToScore(0.46, anchors), 100); // the job's own requirements
assert.equal(semanticToScore(0.9, anchors), 100); // clamped, never above 100
// anchors too close to divide by → the measured fallback window, not a blow-up
assert.equal(semanticToScore(0.38, { floor: 0.4, top: 0.41 }), semanticToScore(0.38, { floor: 0.15, top: 0.45 }));

// --- the keyword list the scorer sees is settled, not whatever came back ---
const raw: JdKeyword[] = [
  { term: "Power BI", weight: 3, category: "tool" },
  { term: "SQL", weight: 3, category: "hard" },
  { term: "Python", weight: 3, category: "hard" },
  { term: "ETL", weight: 3, category: "hard" },
  { term: "Airflow", weight: 3, category: "tool" },
  { term: "dbt", weight: 3, category: "tool" },
  { term: "German", weight: 3, category: "soft" },
  { term: "power bi", weight: 1, category: "tool" },
];
raw.push({ term: "Degree in a quantitative field", weight: 3, category: "hard" });
const settled = sanitizeKeywords(raw);
assert.deepEqual(settled.map((k) => k.term), ["Power BI", "SQL", "Python", "ETL", "Airflow", "dbt"]);
assert.equal(settled.filter((k) => k.weight === 3).length, 5);
assert.equal(settled.at(-1)?.weight, 2);

console.log("ats: all checks passed");

