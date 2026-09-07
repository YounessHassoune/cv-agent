import { embed } from "ai";

export type JdKeyword = {
  term: string;
  weight: number; // 1 (nice to have) .. 3 (must have)
  category: "hard" | "tool" | "domain" | "soft";
  /**
   * Other spellings of this same skill, supplied per JD by `jd-analyst` — see
   * `variantsOf`. Optional: keywords stored before this existed have none, and
   * the `heuristicKeywords` fallback never produces any.
   */
  aliases?: string[];
};

export type AtsReport = {
  total: number;
  breakdown: {
    keyword: number;
    semantic: number | null; // null when embeddings were unavailable
    structure: number;
    fit: number | null; // null when the JD gave neither a title nor a years requirement
  };
  /** Share of must-have keywords present. Multiplies the total — see `scoreAts`. */
  gate: number;
  matched: string[];
  /** Matched, but only inside the skills list — a real screen discounts these. */
  listedOnly: string[];
  missing: string[];
  /** The weight-3 terms that are absent. These are what actually rejects a CV. */
  missingMustHaves: string[];
  /**
   * The best total this profile could truthfully reach for this JD — every
   * claimable keyword matched and evidenced, structure perfect. Null when no
   * profile text was supplied to measure against.
   */
  ceiling: number | null;
  /** JD keywords the profile cannot support. No rewrite will ever match these. */
  unclaimable: string[];
  suggestions: string[];
};

/**
 * The score worth stopping at. Chosen, not measured — see the calibration note
 * on `semanticToScore`. It is a ceiling on effort, never a promise: when the
 * profile cannot truthfully reach it, `ceiling` is the real target.
 */
export const ATS_TARGET = 90;

/** Inside this of the ceiling, another revision is rearranging noise. */
export const CEILING_SLACK = 3;

/**
 * Reports are stored as JSON on the application and outlive the code that
 * wrote them, so one saved before `fit`, `gate` or `listedOnly` existed still
 * has to render. Missing fields read as "not measured", never as a failure.
 */
export function readReport(value: unknown): AtsReport | null {
  const r = value as Partial<AtsReport> | null;
  if (!r || typeof r.total !== "number") return null;
  return {
    total: r.total,
    breakdown: {
      keyword: r.breakdown?.keyword ?? 0,
      semantic: r.breakdown?.semantic ?? null,
      structure: r.breakdown?.structure ?? 0,
      fit: r.breakdown?.fit ?? null,
    },
    gate: r.gate ?? 1,
    matched: r.matched ?? [],
    listedOnly: r.listedOnly ?? [],
    missing: r.missing ?? [],
    missingMustHaves: r.missingMustHaves ?? [],
    ceiling: r.ceiling ?? null,
    unclaimable: r.unclaimable ?? [],
    suggestions: r.suggestions ?? [],
  };
}

/**
 * Component weights before redistribution. A real pipeline is three stages —
 * a parser fills fields, a keyword search filters, a match model ranks — so
 * keyword and semantic carry the most, and `fit` (title + years) stands in for
 * the structured-field filters every ATS applies before either.
 *
 * Any component that comes back null (no embedding provider, no JD title or
 * years requirement) drops out and the rest renormalize.
 */
export const ATS_WEIGHTS = {
  keyword: 0.35,
  semantic: 0.35,
  structure: 0.15,
  fit: 0.15,
} as const;

/**
 * Credit for a keyword that appears only in the skills list. Not zero — the
 * parser does index it — but a term evidenced in a bullet is worth more to
 * every screen downstream, and full credit here would let the writer farm the
 * score by padding the list.
 */
const LISTED_ONLY_CREDIT = 0.6;

// Env-only, no fallback: when EMBEDDING_MODEL is unset, semantic scoring is
// skipped and the remaining weights redistribute (see scoreAts).
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Section headings are letter-spaced, so a PDF text layer hands them back as
 * "S K I L L S". A line made of nothing but one- and two-character fragments
 * is one of those — glue it back into a word so the header check can find it.
 */
function glueSpacedHeadings(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      return parts.length >= 3 && parts.every((part) => part.length <= 2)
        ? parts.join("")
        : line;
    })
    .join("\n");
}

/** Keeps `ci/cd`, `node.js`, `c++` and `c#` whole; splits on everything else. */
const TOKEN = /[a-z0-9][a-z0-9+#./-]*/g;

function tokensOf(text: string): string[] {
  return (normalize(text).match(TOKEN) ?? [])
    .map((token) => token.replace(/[./-]+$/, ""))
    .filter(Boolean);
}

/**
 * Second comparison form with the joiners removed, so "ci/cd" meets "cicd",
 * "node.js" meets "nodejs" and "ci-cd" meets both. These are one skill spelled
 * three ways, not three skills — a mechanical rule handles the whole class,
 * where a synonym list could only ever handle the entries someone remembered
 * to add.
 */
function depunctuate(token: string): string {
  const stripped = token.replace(/[./-]/g, "");
  return stripped.length >= MIN_STEM ? stripped : token;
}

/**
 * Light suffix stripper, applied to both sides of every comparison. Real
 * parsers stem; matching raw strings made this scorer stricter than the thing
 * it models ("microservices" failing the term "microservice").
 *
 * The plural rule runs first and Porter-style, so inflections of one word
 * converge on one stem; the trailing "e" goes last so "manage"/"managing"
 * meet at "manag".
 *
 * ponytail: suffix rules, not a real stemmer. Collisions are symmetric and
 * harmless in practice ("docker" and a hypothetical "dock" both give "dock");
 * swap in a Snowball stemmer if false positives ever show up in evals.
 */
const MIN_STEM = 3;

function stem(word: string): string {
  let w = word;
  const strip = (suffix: string, replacement = ""): boolean => {
    if (!w.endsWith(suffix)) return false;
    if (w.length - suffix.length + replacement.length < MIN_STEM) return false;
    w = w.slice(0, -suffix.length) + replacement;
    return true;
  };

  // Plurals: "ies" → y, never touch a "ss" ending ("css", "business").
  if (!strip("ies", "y") && !w.endsWith("ss")) strip("s");
  // Verb and noun endings, longest first.
  // "ity" last in the chain: "security"/"secure" meet at "secur".
  void (strip("ment") || strip("ing") || strip("ions") || strip("ion") || strip("ed") || strip("er") || strip("or") || strip("ity"));
  strip("e");
  return w;
}

function stemAll(text: string): string[] {
  return tokensOf(text).map(stem);
}

/**
 * The spellings that count as this keyword. The alternatives come from the JD
 * analysis itself, because only something that read the JD knows that "RN"
 * means "Registered Nurse" in a nursing post and "Golang" means "Go" in a
 * backend one. A table here could only ever cover the fields whoever wrote it
 * happened to know.
 */
function variantsOf(keyword: JdKeyword | string): string[] {
  const term = typeof keyword === "string" ? keyword : keyword.term;
  const aliases = typeof keyword === "string" ? [] : (keyword.aliases ?? []);
  return [...new Set([term, ...aliases].map(normalize).filter(Boolean))];
}

/** Contiguous run match, so "ci/cd pipeline" needs both tokens side by side. */
function containsRun(haystack: string[], needle: string[]): boolean {
  if (needle.length === 0) return false;
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

function stemsContainTerm(stems: string[], keyword: JdKeyword | string): boolean {
  const flattened = stems.map(depunctuate);
  return variantsOf(keyword).some((variant) => {
    const needle = stemAll(variant);
    return containsRun(stems, needle) || containsRun(flattened, needle.map(depunctuate));
  });
}

/**
 * The slice of the CV between the skills heading and whatever heading follows
 * it. A term found only here was listed, not evidenced — see
 * `LISTED_ONLY_CREDIT`. Returns null when the block can't be located, which
 * simply means no discount is applied.
 */
function skillsBlock(cvText: string, sections: SectionTitles): string | null {
  const text = normalize(glueSpacedHeadings(cvText));
  const start = text.indexOf(normalize(sections.skills));
  if (start === -1) return null;

  const after = text.slice(start + sections.skills.length);
  const ends = [sections.experience, sections.education, sections.projects, sections.summary]
    .filter(Boolean)
    .map((title) => after.indexOf(normalize(title as string)))
    .filter((index) => index > 0);

  return ends.length > 0 ? after.slice(0, Math.min(...ends)) : after;
}

/** The section headings the structure and placement checks look for. */
export type SectionTitles = {
  skills: string;
  experience: string;
  education: string;
  projects?: string;
  summary?: string;
};

export function keywordScore(
  cvText: string,
  keywords: JdKeyword[],
  sections?: SectionTitles,
): { score: number; matched: string[]; listedOnly: string[]; missing: string[] } {
  const flat = normalize(glueSpacedHeadings(cvText));
  const allStems = stemAll(flat);
  const list = sections ? skillsBlock(cvText, sections) : null;
  // Everything the CV says outside its skills list — where evidence lives.
  const evidenceStems = list === null ? allStems : stemAll(flat.replace(list, " "));

  const matched: string[] = [];
  const listedOnly: string[] = [];
  const missing: string[] = [];
  let hit = 0;
  let totalWeight = 0;

  for (const kw of keywords) {
    totalWeight += kw.weight;
    if (!stemsContainTerm(allStems, kw)) {
      missing.push(kw.term);
      continue;
    }
    matched.push(kw.term);

    const onlyListed = list !== null && !stemsContainTerm(evidenceStems, kw);
    if (onlyListed) listedOnly.push(kw.term);
    hit += kw.weight * (onlyListed ? LISTED_ONLY_CREDIT : 1);
  }

  // No keywords means the JD was never analysed — that is unknown, not perfect.
  const score = totalWeight === 0 ? 0 : Math.round((hit / totalWeight) * 100);
  return { score, matched, listedOnly, missing };
}

/** A year is a date, not an achievement: "2021 – 2023" must not read as a metric. */
function hasMetric(line: string): boolean {
  // Numeric dates first: stripping the year out of "01/2017" would leave a
  // bare "01" behind and read as a metric.
  const withoutDates = line
    .replace(/\b\d{1,2}[/-]\d{2,4}\b/g, " ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ");
  return /[\d%$€£]/.test(withoutDates);
}

export function structureScore(
  cvText: string,
  sectionTitles: string[],
): { score: number; issues: string[] } {
  const text = normalize(cvText);
  const issues: string[] = [];
  let score = 0;

  // Section headers present (40 pts). Only this check reads the de-spaced
  // copy — it would corrupt the prose the other two metrics measure.
  const headings = normalize(glueSpacedHeadings(cvText));
  const found = sectionTitles.filter((t) => {
    const title = normalize(t);
    return text.includes(title) || headings.includes(title);
  });
  const headerRatio = sectionTitles.length === 0 ? 1 : found.length / sectionTitles.length;
  score += Math.round(headerRatio * 40);
  if (headerRatio < 1) {
    issues.push(
      `Missing expected section headers: ${sectionTitles.filter((t) => !found.includes(t)).join(", ")}`,
    );
  }

  // Quantified bullets (40 pts): share of lines carrying a real number
  const lines = cvText.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 20);
  const quantified = lines.filter(hasMetric).length;
  const metricRatio = lines.length === 0 ? 0 : quantified / lines.length;
  score += Math.round(Math.min(metricRatio / 0.4, 1) * 40); // 40 %+ quantified = full marks
  if (metricRatio < 0.25) {
    issues.push("Few quantified bullets — add numbers, percentages, or amounts where truthful.");
  }

  // Sane length (20 pts): 300–1100 words for a 1–2 page CV
  const words = text.split(" ").length;
  if (words >= 300 && words <= 1100) score += 20;
  else if (words >= 200 && words <= 1400) score += 10;
  else issues.push(`CV text is ${words} words — aim for 300–1100.`);

  return { score: Math.min(score, 100), issues };
}

/**
 * The years-of-experience bar the JD filters on. Takes the largest figure it
 * finds: a JD that says "5+ years backend, 2+ years Kubernetes" screens on the
 * five.
 *
 * ponytail: regex over the JD, capped at 20 to shrug off "founded 30 years
 * ago". Move it into the jd-analyst extraction if it ever misreads a real JD.
 */
export function requiredYearsFromJd(jdText: string): number | null {
  const matches = [
    ...jdText.matchAll(/(\d{1,2})\s*(?:\+|plus)?\s*(?:years?|yrs?|ans|années|jahre|años)/gi),
  ]
    .map((m) => Number(m[1]))
    .filter((n) => n > 0 && n <= 20);
  return matches.length > 0 ? Math.max(...matches) : null;
}

/** Total years worked, overlapping roles counted once. */
export function totalYears(spans: { start: Date; end: Date | null }[], now = new Date()): number {
  const ranges = spans
    .map(({ start, end }) => [start.getTime(), (end ?? now).getTime()] as const)
    .filter(([from, to]) => to > from)
    .sort((a, b) => a[0] - b[0]);

  let months = 0;
  let cursor = -Infinity;
  for (const [from, to] of ranges) {
    const begin = Math.max(from, cursor);
    if (to > begin) months += (to - begin) / (1000 * 60 * 60 * 24 * 30.44);
    cursor = Math.max(cursor, to);
  }
  return Math.round((months / 12) * 10) / 10;
}

export type FitInput = {
  /** The role title from the JD analysis. */
  role?: string | null;
  /** Titles the CV presents: its headline and the roles it lists. */
  cvTitles?: string[];
  requiredYears?: number | null;
  cvYears?: number | null;
};

/**
 * Job titles say the same thing many ways; a filter that treats "Developer"
 * and "Engineer" as different jobs is stricter than any recruiter.
 *
 * ponytail: three synonyms and a stop list, not a taxonomy. Extend when a
 * real JD title misfires.
 */
const TITLE_SYNONYMS: Record<string, string> = { develop: "engin", programm: "engin", dev: "engin" };
const TITLE_NOISE = new Set(["team", "the", "and", "of", "for", "m", "f", "d", "x", "h"]);

function titleStems(text: string): string[] {
  return stemAll(text)
    .map((s) => TITLE_SYNONYMS[s] ?? s)
    .filter((s) => !TITLE_NOISE.has(s));
}

/**
 * Title alignment and years of experience — the structured fields a
 * requisition filter reads before any text matching happens. Null when the JD
 * offered neither signal.
 */
function fitScore(fit: FitInput | undefined): { score: number | null; issues: string[] } {
  if (!fit) return { score: null, issues: [] };
  const issues: string[] = [];
  const parts: number[] = [];
  const weights: number[] = [];

  const roleStems = fit.role ? [...new Set(titleStems(fit.role))] : [];
  if (roleStems.length > 0 && (fit.cvTitles?.length ?? 0) > 0) {
    const cvStems = titleStems((fit.cvTitles ?? []).join(" "));
    const cvSet = new Set(cvStems);
    // "Fullstack" vs "Full Stack": one title's word is two of the other's.
    const compact = cvStems.join("");
    const overlap =
      roleStems.filter((s) => cvSet.has(s) || (s.length >= 4 && compact.includes(s))).length /
      roleStems.length;
    parts.push(Math.round(overlap * 100));
    weights.push(0.6);
    if (overlap < 0.5) {
      issues.push(
        `Headline and role titles barely overlap the target title "${fit.role}" — align the headline with it where truthful.`,
      );
    }
  }

  if (fit.requiredYears != null && fit.cvYears != null) {
    const ratio = Math.min(fit.cvYears / fit.requiredYears, 1);
    parts.push(Math.round(ratio * 100));
    weights.push(0.4);
    if (ratio < 1) {
      issues.push(
        `JD asks for ~${fit.requiredYears} years; the profile shows ${fit.cvYears}. Lead with the most relevant experience.`,
      );
    }
  }

  if (parts.length === 0) return { score: null, issues: [] };
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const score = Math.round(
    parts.reduce((sum, part, i) => sum + part * weights[i], 0) / totalWeight,
  );
  return { score, issues };
}

export async function embedText(text: string, abortSignal?: AbortSignal): Promise<number[] | null> {
  if (!EMBEDDING_MODEL) return null; // unset env — caller redistributes weights
  try {
    const { embedding } = await embed({
      model: EMBEDDING_MODEL,
      value: text.slice(0, 24_000),
      abortSignal,
    });
    return embedding;
  } catch (error) {
    // A cancelled turn must stop, not degrade into a partial score.
    if (abortSignal?.aborted) throw error;
    return null; // no gateway key / provider down — caller redistributes weights
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Map raw cosine similarity to 0–100.
 *
 * ponytail: the 0.2–0.75 window is a guess, not a measurement, and embedding
 * models differ widely in where they put unrelated text. Until an eval pins
 * the real distribution for EMBEDDING_MODEL, treat this component as a coarse
 * sort, which is why it no longer carries 40% on its own.
 */
function semanticToScore(sim: number): number {
  const scaled = (sim - 0.2) / (0.75 - 0.2);
  return Math.round(Math.max(0, Math.min(1, scaled)) * 100);
}

export async function scoreAts(input: {
  cvText: string;
  jdText: string;
  keywords: JdKeyword[];
  sections: SectionTitles;
  fit?: FitInput;
  /**
   * Everything the master profile truthfully says — skills, stacks, bullets,
   * titles, summary. Used only to work out which JD keywords are reachable at
   * all, so the loop can stop at what is achievable instead of grinding
   * against requirements the candidate does not have.
   */
  claimableText?: string;
  cachedJdEmbedding?: number[] | null;
  abortSignal?: AbortSignal;
}): Promise<{ report: AtsReport; jdEmbedding: number[] | null }> {
  const kw = keywordScore(input.cvText, input.keywords, input.sections);
  const structure = structureScore(input.cvText, [
    input.sections.skills,
    input.sections.experience,
    input.sections.education,
  ]);
  const fit = fitScore(input.fit);

  const jdEmbedding =
    input.cachedJdEmbedding ?? (await embedText(input.jdText, input.abortSignal));
  const cvEmbedding = jdEmbedding ? await embedText(input.cvText, input.abortSignal) : null;
  const semantic =
    jdEmbedding && cvEmbedding ? semanticToScore(cosine(jdEmbedding, cvEmbedding)) : null;

  /** Available components only; the rest of the weights renormalize over them. */
  const blend = (keyword: number, structureValue: number): number => {
    const components: [number, number][] = [
      [keyword, ATS_WEIGHTS.keyword],
      [structureValue, ATS_WEIGHTS.structure],
    ];
    if (semantic !== null) components.push([semantic, ATS_WEIGHTS.semantic]);
    if (fit.score !== null) components.push([fit.score, ATS_WEIGHTS.fit]);
    const weightSum = components.reduce((sum, [, w]) => sum + w, 0);
    return components.reduce((sum, [value, w]) => sum + value * w, 0) / weightSum;
  };
  const base = blend(kw.score, structure.score);

  /*
   * Must-haves gate rather than average. A screen drops a CV that misses a
   * required skill no matter how well it reads, so a strong semantic score
   * must not be able to cover for one. Expressed as a ratio rather than a hard
   * zero so the revise loop can still see itself getting closer.
   */
  // Soft skills never gate: no screen rejects a CV for not saying "collaboration".
  const mustHaves = input.keywords.filter((k) => k.weight >= 3 && k.category !== "soft");
  const matchedTerms = new Set(kw.matched);
  const missingMustHaves = mustHaves.filter((k) => !matchedTerms.has(k.term)).map((k) => k.term);
  const gate =
    mustHaves.length === 0 ? 1 : (mustHaves.length - missingMustHaves.length) / mustHaves.length;

  const total = Math.round(base * gate);

  /*
   * What this profile could reach if every revision landed. A keyword the
   * profile never mentions cannot be added without fabricating, so it caps the
   * score permanently — the loop needs to know that before it spends four
   * model calls discovering it. Semantic and fit are carried at their measured
   * values: rewriting moves them, but by an amount nothing here can predict.
   */
  let ceiling: number | null = null;
  let unclaimable: string[] = [];
  if (input.claimableText !== undefined) {
    const claimStems = stemAll(normalize(glueSpacedHeadings(input.claimableText)));
    const claimable = (k: JdKeyword) => stemsContainTerm(claimStems, k);
    unclaimable = input.keywords.filter((k) => !claimable(k)).map((k) => k.term);

    const totalWeight = input.keywords.reduce((sum, k) => sum + k.weight, 0);
    const claimableWeight = input.keywords
      .filter(claimable)
      .reduce((sum, k) => sum + k.weight, 0);
    const keywordCeiling = totalWeight === 0 ? 0 : Math.round((claimableWeight / totalWeight) * 100);
    const gateCeiling =
      mustHaves.length === 0 ? 1 : mustHaves.filter(claimable).length / mustHaves.length;

    ceiling = Math.max(total, Math.round(blend(keywordCeiling, 100) * gateCeiling));
  }

  const suggestions: string[] = [];
  if (missingMustHaves.length > 0) {
    suggestions.push(
      `Must-have keywords absent — these gate the whole score (${missingMustHaves.join(", ")}). Add only those the profile truthfully supports; report the rest as unclaimable.`,
    );
  }
  suggestions.push(...fit.issues, ...structure.issues);
  if (kw.listedOnly.length > 0) {
    suggestions.push(
      `Only in the skills list, so they count for ${Math.round(LISTED_ONLY_CREDIT * 100)}%: ${kw.listedOnly.join(", ")}. Evidence them in a bullet where true.`,
    );
  }
  if (unclaimable.length > 0) {
    suggestions.push(
      `Not in the profile and unreachable without inventing (${unclaimable.join(", ")}) — cover the underlying capability with transferable experience in prose, and report them as unclaimable.`,
    );
  }
  const softMissing = kw.missing.filter(
    (term) => !missingMustHaves.includes(term) && !unclaimable.includes(term),
  );
  if (softMissing.length > 0) {
    suggestions.push(
      `Other missing JD keywords (weave in only the ones truthfully supported by the profile): ${softMissing.join(", ")}`,
    );
  }
  if (input.keywords.length === 0) {
    suggestions.push("No JD keywords were analysed — the keyword score is 0 by default, not earned.");
  }
  if (semantic === null) {
    suggestions.push("Semantic score unavailable (no embedding provider) — weights redistributed.");
  }

  return {
    report: {
      total,
      breakdown: { keyword: kw.score, semantic, structure: structure.score, fit: fit.score },
      gate,
      matched: kw.matched,
      listedOnly: kw.listedOnly,
      missing: kw.missing,
      missingMustHaves,
      ceiling,
      unclaimable,
      suggestions,
    },
    jdEmbedding,
  };
}
