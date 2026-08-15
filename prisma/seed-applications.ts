/**
 * Sample applications so the Applications page has something to show before
 * the agent has ever run. Each one is a realistic snapshot of what the
 * pipeline produces: a JD, extracted keywords, a tailored CV and an ATS report.
 * No PDF bytes — those only exist once compile_pdf actually renders one.
 */

type SeedApplication = {
  jdText: string;
  jdKeywords: { term: string; weight: number; category: "hard" | "tool" | "domain" | "soft" }[];
  language: string;
  template: string;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "APPLIED" | "REJECTED";
  daysAgo: number;
  headline: string;
  summary: string;
  atsReport: {
    total: number;
    breakdown: { keyword: number; semantic: number | null; structure: number };
    matched: string[];
    missing: string[];
    suggestions: string[];
  };
};

const baseCv = (headline: string, summary: string) => ({
  language: "en",
  header: {
    fullName: "Sample User",
    headline,
    email: "sample.user@example.com",
    phone: "+1 555 0100",
    location: "Remote",
    links: ["github.com/sample-user", "linkedin.com/in/sample-user"],
  },
  summary,
  skills: [
    { category: "Languages", items: ["TypeScript", "JavaScript", "SQL", "Python"] },
    { category: "Frameworks", items: ["React", "Next.js", "Node.js", "Express"] },
    { category: "Data", items: ["PostgreSQL", "Redis", "Prisma"] },
    { category: "Cloud & DevOps", items: ["Docker", "AWS", "CI/CD", "Terraform"] },
  ],
  experiences: [
    {
      company: "Northwind Commerce",
      role: "Senior Software Engineer",
      location: "Remote",
      start: "Mar 2022",
      bullets: [
        "Rebuilt the checkout service, cutting p95 latency from 820ms to 460ms by adding Redis-backed pricing caches",
        "Led migration of 40+ REST endpoints to a typed Node.js/TypeScript service layer, reducing production type errors by 70%",
        "Introduced a Playwright end-to-end suite covering the top 12 revenue flows, catching 15 regressions before release in year one",
      ],
      stack: ["TypeScript", "Node.js", "React", "PostgreSQL", "Redis", "AWS"],
    },
    {
      company: "Bluepeak Analytics",
      role: "Software Engineer",
      location: "Lyon, France",
      start: "Jul 2020",
      end: "Feb 2022",
      bullets: [
        "Built an internal reporting dashboard used daily by 200+ analysts, replacing a manual spreadsheet process",
        "Cut nightly ETL runtime by 35% by rewriting aggregation queries and adding partitioned indexes in PostgreSQL",
      ],
      stack: ["Python", "PostgreSQL", "Docker", "React"],
    },
  ],
  projects: [
    {
      title: "Ledgerly",
      link: "github.com/sample-user/ledgerly",
      bullets: [
        "Designed a double-entry ledger API in TypeScript with Prisma and PostgreSQL, reaching 600+ GitHub stars",
      ],
      stack: ["TypeScript", "Prisma", "PostgreSQL"],
    },
  ],
  education: [
    { institution: "State University", degree: "BSc Computer Science", dates: "2016 — 2020" },
  ],
  languages: [
    { name: "English", level: "Fluent" },
    { name: "French", level: "Native" },
  ],
});

export const SEED_APPLICATIONS: SeedApplication[] = [
  {
    headline: "Senior Full-Stack Engineer",
    summary:
      "Full-stack engineer with 5 years building high-traffic commerce systems in TypeScript and React. Cut checkout latency 44% at Northwind and led a 40-endpoint migration to a typed service layer.",
    jdText: `Senior Full-Stack Engineer — TechFlow Systems (Remote, US)

We are looking for a senior full-stack engineer to own our customer-facing platform end to end.

Responsibilities:
- Build and maintain React/Next.js interfaces backed by Node.js services
- Design PostgreSQL schemas and optimise slow queries
- Own deployments through our CI/CD pipeline on AWS
- Mentor mid-level engineers and lead code review

Requirements:
- 5+ years of professional TypeScript and JavaScript
- Strong React and Next.js experience
- Comfortable with PostgreSQL, Redis and caching strategies
- Docker, AWS, CI/CD
- Experience with automated testing (Playwright or Cypress)
- GraphQL experience is a plus
- Kubernetes exposure is a plus`,
    jdKeywords: [
      { term: "TypeScript", weight: 3, category: "hard" },
      { term: "React", weight: 3, category: "tool" },
      { term: "Next.js", weight: 3, category: "tool" },
      { term: "Node.js", weight: 3, category: "tool" },
      { term: "PostgreSQL", weight: 3, category: "tool" },
      { term: "Redis", weight: 2, category: "tool" },
      { term: "AWS", weight: 2, category: "tool" },
      { term: "Docker", weight: 2, category: "tool" },
      { term: "CI/CD", weight: 2, category: "hard" },
      { term: "Playwright", weight: 2, category: "tool" },
      { term: "GraphQL", weight: 1, category: "tool" },
      { term: "Kubernetes", weight: 1, category: "tool" },
      { term: "mentoring", weight: 1, category: "soft" },
    ],
    language: "en",
    template: "modern",
    status: "APPLIED",
    daysAgo: 2,
    atsReport: {
      total: 92,
      breakdown: { keyword: 94, semantic: 91, structure: 90 },
      matched: [
        "TypeScript",
        "React",
        "Next.js",
        "Node.js",
        "PostgreSQL",
        "Redis",
        "AWS",
        "Docker",
        "CI/CD",
        "Playwright",
        "mentoring",
      ],
      missing: ["GraphQL", "Kubernetes"],
      suggestions: [
        "GraphQL and Kubernetes are listed as nice-to-haves and are absent from your profile — leave them off rather than claiming them.",
        "The checkout latency bullet is your strongest metric; it already leads the experience section.",
      ],
    },
  },
  {
    headline: "Backend Engineer, Payments",
    summary:
      "Backend engineer focused on transactional systems: built a double-entry ledger API in TypeScript and cut nightly ETL runtime 35% through query and index work in PostgreSQL.",
    jdText: `Backend Engineer, Payments — Global Finance Bank (New York, Hybrid)

Join the payments platform team building the ledger behind our card products.

What you will do:
- Design and operate transactional services in Node.js
- Model financial data in PostgreSQL with strict consistency guarantees
- Work with double-entry accounting concepts and reconciliation
- Instrument services with metrics, tracing and alerting

What we look for:
- Strong Node.js and TypeScript
- Deep PostgreSQL knowledge, including transactions and isolation levels
- Experience with payment systems, ledgers or accounting domains
- Kafka or another event streaming platform
- Familiarity with PCI DSS compliance`,
    jdKeywords: [
      { term: "Node.js", weight: 3, category: "tool" },
      { term: "TypeScript", weight: 3, category: "hard" },
      { term: "PostgreSQL", weight: 3, category: "tool" },
      { term: "transactions", weight: 2, category: "domain" },
      { term: "double-entry", weight: 2, category: "domain" },
      { term: "ledger", weight: 2, category: "domain" },
      { term: "reconciliation", weight: 2, category: "domain" },
      { term: "Kafka", weight: 2, category: "tool" },
      { term: "PCI DSS", weight: 1, category: "domain" },
      { term: "observability", weight: 1, category: "hard" },
    ],
    language: "en",
    template: "classic",
    status: "PENDING_REVIEW",
    daysAgo: 5,
    atsReport: {
      total: 78,
      breakdown: { keyword: 74, semantic: 82, structure: 80 },
      matched: ["Node.js", "TypeScript", "PostgreSQL", "double-entry", "ledger", "transactions"],
      missing: ["Kafka", "PCI DSS", "reconciliation", "observability"],
      suggestions: [
        "Kafka and PCI DSS are must-have adjacent terms you cannot claim — consider whether this role is a fit before applying.",
        "Your Ledgerly project maps directly onto the double-entry requirement; it is worth promoting above the second role.",
      ],
    },
  },
  {
    headline: "Ingénieur Full-Stack",
    summary:
      "Ingénieur full-stack avec 5 ans d'expérience sur des plateformes e-commerce à fort trafic en TypeScript et React.",
    jdText: `Ingénieur Full-Stack — RetailNova (Paris, France)

Nous recherchons un ingénieur full-stack pour renforcer l'équipe plateforme.

Missions :
- Développer des interfaces React et des services Node.js
- Concevoir et optimiser des schémas PostgreSQL
- Participer aux revues de code et au mentorat

Profil recherché :
- 4+ ans d'expérience en TypeScript
- Maîtrise de React et Node.js
- Connaissance de Docker et des pipelines CI/CD
- Français courant`,
    jdKeywords: [
      { term: "TypeScript", weight: 3, category: "hard" },
      { term: "React", weight: 3, category: "tool" },
      { term: "Node.js", weight: 3, category: "tool" },
      { term: "PostgreSQL", weight: 2, category: "tool" },
      { term: "Docker", weight: 2, category: "tool" },
      { term: "CI/CD", weight: 2, category: "hard" },
      { term: "Français", weight: 3, category: "soft" },
    ],
    language: "fr",
    template: "compact",
    status: "DRAFT",
    daysAgo: 9,
    atsReport: {
      total: 66,
      breakdown: { keyword: 71, semantic: 64, structure: 62 },
      matched: ["TypeScript", "React", "Node.js", "PostgreSQL", "Docker", "CI/CD"],
      missing: ["Français"],
      suggestions: [
        "The CV is in French but the summary still reads as a translation — tighten it to two sentences.",
        "Your profile lists French as a native language; make sure the Langues section stays on page one.",
      ],
    },
  },
];

export function buildApplicationRows(userId: string) {
  const now = Date.now();
  return SEED_APPLICATIONS.map((application) => {
    const createdAt = new Date(now - application.daysAgo * 24 * 60 * 60 * 1000);
    const cv = {
      ...baseCv(application.headline, application.summary),
      language: application.language,
    };

    return {
      userId,
      jdText: application.jdText,
      jdKeywords: application.jdKeywords,
      language: application.language,
      template: application.template,
      status: application.status,
      cvJson: cv,
      cvText: `${cv.header.fullName}\n${cv.header.headline}\n${application.summary}`,
      atsReport: application.atsReport,
      createdAt,
      updatedAt: createdAt,
    };
  });
}
