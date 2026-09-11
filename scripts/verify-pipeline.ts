/**
 * Exercises the deterministic half of the pipeline with fixtures — no model
 * calls, so it runs offline and in CI: hallucination guard → PDF render →
 * text extraction → ATS scoring.
 *
 *   node scripts/verify-pipeline.ts
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../agent/generated/prisma/client.ts";
import { type JdKeyword, scoreAts } from "../agent/lib/ats.ts";
import type { Cv } from "../agent/lib/cv-schema.ts";
import { findFabrications } from "../agent/lib/guard.ts";
import { extractPdfText, renderCvPdf, titlesFor } from "../agent/lib/pdf.ts";

try {
  process.loadEnvFile();
} catch {}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const JD_TEXT = `Senior Full-Stack Engineer

We are looking for a senior engineer to own our commerce platform.

Requirements:
- Strong TypeScript and React experience, ideally with Next.js
- Node.js backend services at scale
- PostgreSQL, including query optimization and indexing
- Redis or similar caching layers
- Docker and CI/CD pipelines; AWS experience preferred
- Automated testing (Playwright or Cypress) and a quality-first mindset
- Experience mentoring engineers and leading migrations

Nice to have: Terraform, Kubernetes, GraphQL.`;

const KEYWORDS: JdKeyword[] = [
  { term: "TypeScript", weight: 3, category: "hard" },
  { term: "React", weight: 3, category: "hard" },
  { term: "Next.js", weight: 2, category: "hard" },
  { term: "Node.js", weight: 3, category: "hard" },
  { term: "PostgreSQL", weight: 3, category: "hard" },
  { term: "Redis", weight: 2, category: "tool" },
  { term: "Docker", weight: 2, category: "tool" },
  { term: "CI/CD", weight: 2, category: "tool" },
  { term: "AWS", weight: 2, category: "tool" },
  { term: "Playwright", weight: 2, category: "tool" },
  { term: "Terraform", weight: 1, category: "tool" },
  { term: "Kubernetes", weight: 1, category: "tool" },
  { term: "GraphQL", weight: 1, category: "hard" },
];

let failures = 0;
function check(label: string, passed: boolean, detail?: string) {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures++;
}

async function main() {
  const userId = process.env.DEV_USER_ID ?? "local-dev";
  const profile = await db.profile.findUnique({
    where: { userId },
    include: { skills: true, experiences: { orderBy: { start: "desc" } }, projects: true },
  });
  if (!profile) throw new Error(`No profile for "${userId}". Run: pnpm db:seed`);

  const contact = profile.contact as {
    email: string;
    phone?: string;
    location?: string;
    links?: string[];
  };

  // A CV built strictly from profile facts, the way the agent is instructed to.
  const cv: Cv = {
    language: "en",
    header: {
      fullName: profile.fullName,
      headline: "Senior Full-Stack Engineer",
      email: contact.email,
      phone: contact.phone,
      location: contact.location,
      links: contact.links ?? [],
    },
    summary:
      "Senior full-stack engineer with 5+ years building TypeScript and React products on Node.js and PostgreSQL. Cut checkout p95 latency by 44% with Redis caching and led a 40-endpoint migration to a typed service layer.",
    skills: [
      { category: "Languages", items: ["TypeScript", "JavaScript", "SQL", "Python"] },
      { category: "Frameworks", items: ["React", "Next.js", "Node.js", "Express"] },
      { category: "Data", items: ["PostgreSQL", "Redis", "Prisma"] },
      { category: "Cloud & DevOps", items: ["Docker", "AWS", "CI/CD", "Terraform"] },
      { category: "Testing", items: ["Playwright", "Jest"] },
    ],
    experiences: profile.experiences.map((exp) => ({
      company: exp.company,
      role: exp.role,
      location: exp.location ?? undefined,
      start: exp.start.toLocaleDateString("en", { month: "short", year: "numeric" }),
      end: exp.end?.toLocaleDateString("en", { month: "short", year: "numeric" }),
      bullets: exp.bullets,
      stack: exp.stack,
    })),
    projects: profile.projects.map((project) => ({
      title: project.title,
      link: project.link ?? undefined,
      bullets: project.bullets,
      stack: project.stack,
    })),
    education: (
      profile.education as { institution: string; degree: string; start?: string; end?: string }[]
    ).map((entry) => ({
      institution: entry.institution,
      degree: entry.degree,
      dates: [entry.start, entry.end].filter(Boolean).join(" – "),
    })),
    languages: profile.languages as { name: string; level: string }[],
  };

  // 1. Guard accepts a truthful CV.
  const clean = findFabrications(cv, profile);
  check("truthful CV passes the hallucination guard", clean.length === 0, clean.join("; "));

  // 2. Guard rejects invented skills, employers, and projects.
  const fabricated: Cv = {
    ...cv,
    skills: [...cv.skills, { category: "Data", items: ["Kubernetes", "GraphQL"] }],
    experiences: [{ ...cv.experiences[0], company: "Google" }, ...cv.experiences.slice(1)],
  };
  const caught = findFabrications(fabricated, profile);
  check(
    "guard catches fabricated skills and employers",
    caught.length === 3 &&
      caught.some((v) => v.includes("Kubernetes")) &&
      caught.some((v) => v.includes("GraphQL")) &&
      caught.some((v) => v.includes("Google")),
    `${caught.length} violations: ${caught.join(" | ")}`,
  );

  // 3. PDF renders and its text layer is extractable.
  const started = Date.now();
  const pdf = await renderCvPdf(cv);
  const { text, pageCount } = await extractPdfText(pdf);
  check(
    "PDF renders with an extractable text layer",
    pdf.byteLength > 1000 && text.length > 500,
    `${(pdf.byteLength / 1024).toFixed(0)} KB, ${pageCount} page(s), ${text.length} chars, ${Date.now() - started}ms`,
  );
  check("CV fits on one page", pageCount === 1, `${pageCount} page(s)`);

  // 4. Scoring produces a sane report.
  const t = titlesFor(cv.language);
  const { report } = await scoreAts({
    cvText: text,
    jdText: JD_TEXT,
    keywords: KEYWORDS,
    sections: t,
  });
  // EMBEDDING_MODEL is optional; without it the semantic half is skipped.

  console.log("\nATS report");
  console.log(`  total      ${report.total}`);
  console.log(`  keyword    ${report.breakdown.keyword}`);
  console.log(`  semantic   ${report.breakdown.semantic ?? "n/a (no embedding provider)"}`);
  console.log(`  structure  ${report.breakdown.structure}`);
  console.log(`  fit        ${report.breakdown.fit ?? "n/a (JD states no title or years)"}`);
  console.log(`  gate       ${report.gate} (share of must-have keywords present)`);
  console.log(`  matched    ${report.matched.join(", ") || "—"}`);
  console.log(`  listed     ${report.listedOnly.join(", ") || "—"}`);
  console.log(`  missing    ${report.missing.join(", ") || "—"}`);
  for (const suggestion of report.suggestions) console.log(`  · ${suggestion}`);
  console.log("");

  check(
    "keyword matcher finds the profile-backed terms",
    report.matched.length >= 10,
    `${report.matched.length}/${KEYWORDS.length} matched`,
  );
  check(
    "keyword matcher reports genuinely absent terms as missing",
    report.missing.includes("Kubernetes") && report.missing.includes("GraphQL"),
    report.missing.join(", "),
  );
  check(
    "structure score is healthy",
    report.breakdown.structure >= 70,
    `${report.breakdown.structure}`,
  );
  check(
    "total lands in a plausible band",
    report.total > 0 && report.total <= 100,
    `${report.total}`,
  );
}

main()
  .then(() => {
    console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
