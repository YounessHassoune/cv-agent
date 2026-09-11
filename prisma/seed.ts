import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../agent/generated/prisma/client.ts";
import { hashPassword } from "../agent/lib/password.ts";
import { buildApplicationRows } from "./seed-applications.ts";

try {
  process.loadEnvFile();
} catch {}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * Sign-in credentials for the seeded account. The seed always (re)sets this
 * password so a fresh clone — or a forgotten dev password — never blocks you
 * out of the app. Override with SEED_EMAIL / SEED_PASSWORD.
 */
const SEED_EMAIL = process.env.SEED_EMAIL ?? "demo@wellsuited.local";
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "demo1234";

/**
 * Seeds whichever account you actually sign in as: an explicit DEV_USER_ID
 * wins, otherwise the most recently registered user. With no accounts at all
 * it creates the demo one above, so there is always something to sign in as.
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

  const created = await db.user.create({
    data: {
      email: SEED_EMAIL,
      name: "Sample User",
      passwordHash: await hashPassword(SEED_PASSWORD),
    },
    select: { id: true, email: true },
  });
  console.log(`No registered users found — created ${created.email}.`);
  return created.id;
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
      fullName: "Alex Moreau",
      headline: "Full-Stack JavaScript & Mobile Engineer",
      summary:
        "Full-stack JavaScript engineer with 6 years building product across web and mobile — React and Node.js services on the web, React Native apps shipped to both stores. Owns features end to end, from Postgres schema to App Store release, and has taken two codebases from ad-hoc scripts to typed, tested and continuously deployed.",
      template: "modern",
      contact: {
        email: "alex.moreau@example.com",
        phone: "+33 6 12 34 56 78",
        location: "Lyon, France · Open to remote",
        links: ["github.com/alex-moreau", "linkedin.com/in/alex-moreau", "alexmoreau.dev"],
      },
      languages: [
        { name: "French", level: "Native" },
        { name: "English", level: "Fluent (C1)" },
        { name: "Spanish", level: "Conversational (B1)" },
      ],
      education: [
        {
          institution: "Université Claude Bernard Lyon 1",
          degree: "BSc Computer Science",
          start: "2015",
          end: "2018",
        },
      ],
      skills: {
        create: [
          { name: "TypeScript", category: "Languages", level: "Advanced" },
          { name: "JavaScript", category: "Languages", level: "Advanced" },
          { name: "SQL", category: "Languages", level: "Intermediate" },
          { name: "React", category: "Frontend" },
          { name: "Next.js", category: "Frontend" },
          { name: "Tailwind CSS", category: "Frontend" },
          { name: "React Native", category: "Mobile" },
          { name: "Expo", category: "Mobile" },
          { name: "iOS / Android release", category: "Mobile" },
          { name: "Node.js", category: "Backend" },
          { name: "Express", category: "Backend" },
          { name: "REST / GraphQL", category: "Backend" },
          { name: "PostgreSQL", category: "Data" },
          { name: "Redis", category: "Data" },
          { name: "Prisma", category: "Data" },
          { name: "Docker", category: "Cloud & DevOps" },
          { name: "AWS", category: "Cloud & DevOps" },
          { name: "CI/CD", category: "Cloud & DevOps" },
          { name: "Jest", category: "Testing" },
          { name: "Playwright", category: "Testing" },
          { name: "Detox", category: "Testing" },
        ],
      },
      experiences: {
        create: [
          {
            company: "Northwind Commerce",
            role: "Senior Full-Stack Engineer",
            location: "Remote",
            start: new Date("2022-03-01"),
            end: null,
            bullets: [
              "Rebuilt the checkout service, cutting p95 latency from 820ms to 460ms with Redis-backed pricing caches",
              "Migrated 40+ REST endpoints to a typed Node.js/TypeScript service layer, reducing production type errors by 70%",
              "Shipped the React Native companion app to iOS and Android, reaching 45k installs in the first year",
              "Cut mobile cold-start time from 4.1s to 1.6s by trimming the JS bundle and moving to Hermes",
              "Introduced a Playwright end-to-end suite over the top 12 revenue flows, catching 15 regressions before release",
              "Mentored 3 mid-level engineers through code review and weekly pairing",
            ],
            stack: [
              "TypeScript",
              "React",
              "Next.js",
              "Node.js",
              "React Native",
              "PostgreSQL",
              "Redis",
              "AWS",
              "Playwright",
            ],
          },
          {
            company: "Bluepeak Analytics",
            role: "Mobile Engineer (React Native)",
            location: "Lyon, France",
            start: new Date("2020-07-01"),
            end: new Date("2022-02-01"),
            bullets: [
              "Built the company's first React Native app from scratch, replacing two separate native codebases",
              "Set up over-the-air updates with CodePush, taking hotfix delivery from 5 days to under 1 hour",
              "Implemented offline-first sync with SQLite and a background queue, so field analysts could work without signal",
              "Raised crash-free sessions from 97.2% to 99.6% by adding Sentry and fixing the top 10 reported crashes",
              "Automated iOS and Android builds with Fastlane and GitHub Actions, removing a manual release checklist",
            ],
            stack: [
              "React Native",
              "TypeScript",
              "Redux Toolkit",
              "SQLite",
              "Fastlane",
              "Sentry",
              "GitHub Actions",
            ],
          },
          {
            company: "Atelier Digital",
            role: "Frontend Developer",
            location: "Lyon, France",
            start: new Date("2018-09-01"),
            end: new Date("2020-06-01"),
            bullets: [
              "Delivered 11 client sites in React and Next.js, all scoring 90+ on Lighthouse performance",
              "Built a shared component library adopted by 4 project teams, cutting new-project setup from days to hours",
              "Converted a legacy jQuery dashboard to React incrementally, with no feature freeze",
            ],
            stack: ["JavaScript", "React", "Next.js", "SCSS", "Storybook", "Jest"],
          },
        ],
      },
      projects: {
        create: [
          {
            title: "Ledgerly",
            description: "Open-source double-entry bookkeeping API",
            link: "github.com/alex-moreau/ledgerly",
            bullets: [
              "Designed a double-entry ledger API in TypeScript with Prisma and PostgreSQL, now at 600+ GitHub stars",
              "Reached 94% test coverage with Jest across the transaction engine",
            ],
            stack: ["TypeScript", "Prisma", "PostgreSQL", "Jest", "Docker"],
          },
          {
            title: "Trailmark",
            description: "Offline hiking tracker (iOS & Android)",
            link: "github.com/alex-moreau/trailmark",
            bullets: [
              "Built a React Native app that records GPS tracks offline and syncs when a connection returns",
              "Published to both stores with Expo EAS; 4.6★ average across 300+ ratings",
            ],
            stack: ["React Native", "Expo", "TypeScript", "SQLite", "MapLibre"],
          },
        ],
      },
    },
    include: { skills: true, experiences: true, projects: true },
  });


  await db.application.deleteMany({ where: { userId } });
  const applications = await db.application.createMany({
    data: buildApplicationRows(userId),
  });

  /*
   * The seeded account is on Pro, and its usage counters are wiped with the
   * applications it just re-created.
   *
   * Development is not the place to be rate-limited by the free tier: the
   * sample data alone is three applications, so a free dev account starts every
   * session already over quota and nothing downstream of the paywall can be
   * worked on at all. Check the free path by setting `plan` to "free" here, or
   * by editing the `Billing` row directly.
   */
  await db.usageEvent.deleteMany({ where: { userId } });
  await db.billing.upsert({
    where: { userId },
    create: { userId, plan: "pro", status: "active" },
    update: { plan: "pro", status: "active", credits: 0 },
  });


  const account = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (account) {
    await db.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(SEED_PASSWORD) },
    });
  }

  console.log(
    `Seeded profile for userId="${userId}": ${profile.skills.length} skills, ` +
      `${profile.experiences.length} experiences, ${profile.projects.length} projects, ` +
      `${applications.count} sample applications.`,
  );
  if (account) {
    console.log(`Sign in with  ${account.email}  /  ${SEED_PASSWORD}`);
  }
  console.log("Replace this sample data with your real background before applying to jobs.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
