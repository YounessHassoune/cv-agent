/** Every layout × theme renders, and the text layer survives. ATS reads text, not ink. */
import { extractPdfText, renderCvPdf } from "../agent/lib/pdf.ts";
import {
  CV_TEMPLATE_IDS,
  CV_TEMPLATES,
  CV_THEME_IDS,
  MAX_SECTION_TRACKING,
} from "../lib/cv-templates.ts";

const cv = {
  language: "en",
  header: {
    fullName: "Youness Hassoune",
    headline: "Full-Stack Engineer",
    email: "you@example.com",
    phone: "0600000000",
    location: "Casablanca, Morocco",
    links: ["github.com/you"],
  },
  summary: "Engineer with six years building payment systems.",
  skills: [{ category: "Frontend", items: ["React", "TypeScript"] }],
  experiences: [
    {
      company: "Cora-Tech",
      role: "Lead Engineer",
      location: "Remote",
      start: "2025-06",
      end: "",
      bullets: ["Cut checkout latency by 40%."],
      stack: ["Node.js", "Postgres"],
    },
  ],
  projects: [],
  education: [{ institution: "ISGI", degree: "Specialized technician", dates: "2018 - 2021" }],
  languages: [{ name: "French", level: "Native" }],
} as never;

for (const id of CV_TEMPLATE_IDS) {
  const { sectionTracking } = CV_TEMPLATES[id].layout;
  if (sectionTracking > MAX_SECTION_TRACKING) {
    throw new Error(
      `${id}: sectionTracking ${sectionTracking} is over ${MAX_SECTION_TRACKING} — headings will extract as "E X P E R I E N C E".`,
    );
  }
}

const NEEDLES = ["Youness Hassoune", "Cora-Tech", "React", "ISGI", "Experience"];
let failed = 0;

for (const template of CV_TEMPLATE_IDS) {
  const results: string[] = [];
  for (const theme of CV_THEME_IDS) {
    const bytes = await renderCvPdf(cv, template, undefined, theme);
    const { text, pageCount } = await extractPdfText(bytes);
    // Upper-cased layouts put "YOUNESS HASSOUNE" in the text layer, and every
    // heading is upper-case in every layout. ATS matching is case-insensitive.
    const haystack = text.toLowerCase();
    const missing = NEEDLES.filter((needle) => !haystack.includes(needle.toLowerCase()));
    if (missing.length > 0 || pageCount !== 1) failed++;
    results.push(
      `${theme}${missing.length === 0 && pageCount === 1 ? "" : `(!${missing.join("/")} p${pageCount})`}`,
    );
  }
  console.log(`${template.padEnd(10)} ${results.join(" ")}`);
}

console.log(
  failed === 0
    ? `\nOK — ${CV_TEMPLATE_IDS.length * CV_THEME_IDS.length} combinations, all one page with a full text layer.`
    : `\nFAILED: ${failed}`,
);
process.exitCode = failed === 0 ? 0 : 1;
