import { embed } from "ai";

export type JdKeyword = {
  term: string;
  weight: number; // 1 (nice to have) .. 3 (must have)
  category: "hard" | "tool" | "domain" | "soft";
};

export type AtsReport = {
  total: number;
  breakdown: {
    keyword: number;
    semantic: number | null; // null when embeddings were unavailable
    structure: number;
  };
  matched: string[];
  missing: string[];
  suggestions: string[];
};

const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

/** Terms that should count as the same keyword during matching. */
const ALIASES: Record<string, string[]> = {
  javascript: ["js", "javascript", "ecmascript"],
  typescript: ["ts", "typescript"],
  "node.js": ["node", "nodejs", "node.js"],
  react: ["react", "reactjs", "react.js"],
  "next.js": ["next", "nextjs", "next.js"],
  postgresql: ["postgres", "postgresql"],
  kubernetes: ["k8s", "kubernetes"],
  "ci/cd": ["ci/cd", "cicd", "ci-cd", "continuous integration"],
  aws: ["aws", "amazon web services"],
  gcp: ["gcp", "google cloud"],
  "machine learning": ["ml", "machine learning"],
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function variantsOf(term: string): string[] {
  const t = normalize(term);
  for (const canon of Object.keys(ALIASES)) {
    const group = ALIASES[canon];
    if (canon === t || group.includes(t)) return [...new Set([canon, ...group])];
  }
  return [t];
}

function textContainsTerm(normalizedText: string, term: string): boolean {
  return variantsOf(term).some((v) =>
    new RegExp(`(^|[^a-z0-9])${escapeRegExp(v)}([^a-z0-9]|$)`, "i").test(normalizedText),
  );
}

export function keywordScore(
  cvText: string,
  keywords: JdKeyword[],
): { score: number; matched: string[]; missing: string[] } {
  const text = normalize(cvText);
  const matched: string[] = [];
  const missing: string[] = [];
  let hit = 0;
  let totalWeight = 0;
  for (const kw of keywords) {
    totalWeight += kw.weight;
    if (textContainsTerm(text, kw.term)) {
      hit += kw.weight;
      matched.push(kw.term);
    } else {
      missing.push(kw.term);
    }
  }
  const score = totalWeight === 0 ? 100 : Math.round((hit / totalWeight) * 100);
  return { score, matched, missing };
}

export function structureScore(
  cvText: string,
  sectionTitles: string[],
): { score: number; issues: string[] } {
  const text = normalize(cvText);
  const issues: string[] = [];
  let score = 0;

  // Section headers present (40 pts)
  const found = sectionTitles.filter((t) => text.includes(normalize(t)));
  const headerRatio = sectionTitles.length === 0 ? 1 : found.length / sectionTitles.length;
  score += Math.round(headerRatio * 40);
  if (headerRatio < 1) {
    issues.push(
      `Missing expected section headers: ${sectionTitles.filter((t) => !found.includes(t)).join(", ")}`,
    );
  }

  // Quantified bullets (40 pts): share of lines carrying a number, %, $ or €
  const lines = cvText.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 20);
  const quantified = lines.filter((l) => /(\d|%|\$|€)/.test(l)).length;
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

export async function embedText(text: string): Promise<number[] | null> {
  try {
    const { embedding } = await embed({ model: EMBEDDING_MODEL, value: text.slice(0, 24_000) });
    return embedding;
  } catch {
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

/** Map raw cosine similarity (~0.2 unrelated … ~0.75 near-duplicate) to 0–100. */
function semanticToScore(sim: number): number {
  const scaled = (sim - 0.2) / (0.75 - 0.2);
  return Math.round(Math.max(0, Math.min(1, scaled)) * 100);
}

export async function scoreAts(input: {
  cvText: string;
  jdText: string;
  keywords: JdKeyword[];
  sectionTitles: string[];
  cachedJdEmbedding?: number[] | null;
}): Promise<{ report: AtsReport; jdEmbedding: number[] | null }> {
  const kw = keywordScore(input.cvText, input.keywords);
  const structure = structureScore(input.cvText, input.sectionTitles);

  const jdEmbedding = input.cachedJdEmbedding ?? (await embedText(input.jdText));
  const cvEmbedding = jdEmbedding ? await embedText(input.cvText) : null;
  const semantic =
    jdEmbedding && cvEmbedding ? semanticToScore(cosine(jdEmbedding, cvEmbedding)) : null;

  // 40/40/20 — or 2/3 + 1/3 when embeddings are unavailable
  const total =
    semantic === null
      ? Math.round(kw.score * (2 / 3) + structure.score * (1 / 3))
      : Math.round(kw.score * 0.4 + semantic * 0.4 + structure.score * 0.2);

  const suggestions: string[] = [...structure.issues];
  if (kw.missing.length > 0) {
    suggestions.push(
      `Missing JD keywords (weave in only the ones truthfully supported by the profile): ${kw.missing.join(", ")}`,
    );
  }
  if (semantic === null) {
    suggestions.push("Semantic score unavailable (no embedding provider) — weights redistributed.");
  }

  return {
    report: {
      total,
      breakdown: { keyword: kw.score, semantic, structure: structure.score },
      matched: kw.matched,
      missing: kw.missing,
      suggestions,
    },
    jdEmbedding,
  };
}
