import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../agent/generated/prisma/client.ts";

try {
  process.loadEnvFile();
} catch {}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Matches the `local-dev` fallback in agent/lib/auth.ts, so `eve dev` picks it up.
const userId = process.env.DEV_USER_ID ?? "local-dev";

/**
 * SAMPLE profile so the tailoring pipeline can be exercised end to end.
 * Replace it with your real background via the /profile editor — the agent
 * treats whatever is in here as literal truth and may claim nothing else.
 */
async function main() {
  await db.profile.deleteMany({ where: { userId } });

  const profile = await db.profile.create({
    data: {
      userId,
      fullName: "Sample User",
      headline: "Full-Stack Engineer",
      contact: {
        email: "sample.user@example.com",
        phone: "+1 555 0100",
        location: "Remote",
        links: ["github.com/sample-user", "linkedin.com/in/sample-user"],
      },
      languages: [
        { name: "English", level: "Fluent" },
        { name: "French", level: "Native" },
      ],
      education: [
        {
          institution: "State University",
          degree: "BSc Computer Science",
          start: "2016",
          end: "2020",
        },
      ],
      skills: {
        create: [
          { name: "TypeScript", category: "Languages", level: "Advanced" },
          { name: "JavaScript", category: "Languages", level: "Advanced" },
          { name: "Python", category: "Languages", level: "Intermediate" },
          { name: "SQL", category: "Languages", level: "Advanced" },
          { name: "React", category: "Frameworks" },
          { name: "Next.js", category: "Frameworks" },
          { name: "Node.js", category: "Frameworks" },
          { name: "Express", category: "Frameworks" },
          { name: "PostgreSQL", category: "Data" },
          { name: "Redis", category: "Data" },
          { name: "Prisma", category: "Data" },
          { name: "Docker", category: "Cloud & DevOps" },
          { name: "AWS", category: "Cloud & DevOps" },
          { name: "CI/CD", category: "Cloud & DevOps" },
          { name: "Terraform", category: "Cloud & DevOps" },
          { name: "Jest", category: "Testing" },
          { name: "Playwright", category: "Testing" },
        ],
      },
      experiences: {
        create: [
          {
            company: "Northwind Commerce",
            role: "Senior Software Engineer",
            location: "Remote",
            start: new Date("2022-03-01"),
            end: null,
            bullets: [
              "Rebuilt the checkout service, cutting p95 latency from 820ms to 460ms by adding Redis-backed pricing caches",
              "Led migration of 40+ REST endpoints to a typed Node.js/TypeScript service layer, reducing production type errors by 70%",
              "Introduced Playwright end-to-end suite covering the top 12 revenue flows, catching 15 regressions before release in year one",
              "Mentored 3 mid-level engineers through code review and pairing",
            ],
            stack: ["TypeScript", "Node.js", "React", "PostgreSQL", "Redis", "AWS", "Playwright"],
          },
          {
            company: "Bluepeak Analytics",
            role: "Software Engineer",
            location: "Lyon, France",
            start: new Date("2020-07-01"),
            end: new Date("2022-02-01"),
            bullets: [
              "Built an internal reporting dashboard used daily by 200+ analysts, replacing a manual spreadsheet process",
              "Cut nightly ETL runtime by 35% by rewriting the aggregation queries and adding partitioned indexes in PostgreSQL",
              "Containerised 6 services with Docker and set up GitHub Actions CI/CD, taking deploys from weekly to daily",
            ],
            stack: ["Python", "PostgreSQL", "Docker", "CI/CD", "React", "JavaScript"],
          },
        ],
      },
      projects: {
        create: [
          {
            title: "Ledgerly",
            description: "Open-source double-entry bookkeeping API",
            link: "github.com/sample-user/ledgerly",
            bullets: [
              "Designed a double-entry ledger API in TypeScript with Prisma and PostgreSQL, reaching 600+ GitHub stars",
              "Achieved 94% test coverage with Jest across the transaction engine",
            ],
            stack: ["TypeScript", "Prisma", "PostgreSQL", "Jest", "Docker"],
          },
          {
            title: "Shiplog",
            description: "Deployment timeline visualiser",
            link: "github.com/sample-user/shiplog",
            bullets: [
              "Built a Next.js dashboard that correlates deploys with error-rate spikes across 3 environments",
              "Provisioned the AWS infrastructure with Terraform, keeping monthly hosting under $20",
            ],
            stack: ["Next.js", "React", "TypeScript", "AWS", "Terraform"],
          },
        ],
      },
    },
    include: { skills: true, experiences: true, projects: true },
  });

  console.log(
    `Seeded profile for userId="${userId}": ${profile.skills.length} skills, ` +
      `${profile.experiences.length} experiences, ${profile.projects.length} projects.`,
  );
  console.log("Replace this sample data with your real background before applying to jobs.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
