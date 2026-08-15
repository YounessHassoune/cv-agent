import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../agent/generated/prisma/client.ts";
import { buildApplicationRows } from "./seed-applications.ts";

try {
  process.loadEnvFile();
} catch {}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * Seeds whichever account you actually sign in as: an explicit DEV_USER_ID
 * wins, otherwise the most recently registered user, and finally the
 * `local-dev` principal that `eve dev` falls back to.
 */
async function resolveUserId(): Promise<string> {
  if (process.env.DEV_USER_ID) return process.env.DEV_USER_ID;

  const newest = await db.user.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true },
  });
  if (newest) {
    console.log(`Seeding the most recently registered account: ${newest.email}`);
    return newest.id;
  }

  console.log("No registered users found — seeding the `local-dev` principal.");
  return "local-dev";
}

/**
 * SAMPLE profile so the tailoring pipeline can be exercised end to end.
 * Replace it with your real background via the /profile editor — the agent
 * treats whatever is in here as literal truth and may claim nothing else.
 */
async function main() {
  const userId = await resolveUserId();

  await db.profile.deleteMany({ where: { userId } });

  const profile = await db.profile.create({
    data: {
      userId,
      fullName: "Sample User",
      headline: "Full-Stack Engineer",
      summary:
        "Full-stack engineer with 5 years shipping high-traffic commerce and analytics platforms in TypeScript, React and Node.js.",
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

  // Sample applications so /applications isn't empty on a fresh install.
  // Replaced wholesale on every run, like the profile above.
  await db.application.deleteMany({ where: { userId } });
  const applications = await db.application.createMany({
    data: buildApplicationRows(userId),
  });

  console.log(
    `Seeded profile for userId="${userId}": ${profile.skills.length} skills, ` +
      `${profile.experiences.length} experiences, ${profile.projects.length} projects, ` +
      `${applications.count} sample applications.`,
  );
  console.log("Replace this sample data with your real background before applying to jobs.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
