import {
  type JdKeyword,
  SEMANTIC_CONTROL_TEXT,
  cosine,
  embedText,
  idealCandidateText,
} from "./ats.ts";

/**
 * How far above the off-domain floor a term has to sit to count as belonging
 * to this job's field.
 *
 * Measured with text-embedding-3-small against a real Data Analyst ad, each
 * term compared to the job's own vocabulary: Databricks 0.49, Data Governance
 * 0.44, Excel 0.34, Apache Airflow 0.29, dbt 0.21 — against Welding 0.21,
 * Plumbing 0.19, Carpenter 0.17, Kindergarten teacher 0.16, Horse riding 0.12.
 * The control text scored 0.12, so a margin of 0.08 puts the line at 0.20:
 * every real tool of the trade is above it and every unrelated trade below.
 * Re-measure if EMBEDDING_MODEL changes.
 */
const RELEVANCE_MARGIN = 0.08;

export type AssertedScreening = {
  /** Terms the user may put on the CV. */
  readonly accepted: string[];
  /** Terms rejected as unrelated to this job, with the reason to relay. */
  readonly rejected: string[];
  /** True when no embedding provider was available to judge the leftovers. */
  readonly unscreened: boolean;
};

const normalize = (term: string) => term.toLowerCase().trim();

/**
 * Word-boundary search, so "R" does not match "Redshift" and "Excel" does not
 * match "excellent".
 */
function mentions(haystack: string, term: string): boolean {
  const escaped = normalize(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(haystack);
}

/**
 * Decides which of the terms the user demanded may go on the CV.
 *
 * The user owns their CV: told "add Databricks and Snowflake even though they
 * are not in my profile", the answer is yes — those are the tools of the job
 * they are applying for, and the profile was never a complete inventory. What
 * this screen exists for is the other case: a term from another life entirely
 * ("carpenter" on a data CV) is not tailoring, it is noise that costs the user
 * the interview it reaches.
 *
 * Cheap checks first. A term the job description or the profile already says
 * needs no model call at all, which is nearly every term a user names. Only
 * the leftovers are embedded and compared against the job's own vocabulary.
 */
export async function screenAssertedTerms(
  terms: readonly string[],
  context: {
    readonly jdText: string;
    readonly keywords: readonly JdKeyword[];
    readonly profileTerms: readonly string[];
    readonly role?: string | null;
    readonly abortSignal?: AbortSignal;
    /** Injectable for the self-check — production always uses `embedText`. */
    readonly embed?: (text: string) => Promise<number[] | null>;
  },
): Promise<AssertedScreening> {
  const embed = context.embed ?? ((text: string) => embedText(text, context.abortSignal));
  const wanted = [...new Set(terms.map((t) => t.trim()).filter(Boolean))];
  if (wanted.length === 0) return { accepted: [], rejected: [], unscreened: false };

  const known = new Set<string>();
  for (const keyword of context.keywords) {
    for (const spelling of [keyword.term, ...(keyword.aliases ?? [])]) known.add(normalize(spelling));
  }
  for (const term of context.profileTerms) known.add(normalize(term));

  const accepted: string[] = [];
  const unresolved: string[] = [];
  for (const term of wanted) {
    if (known.has(normalize(term)) || mentions(context.jdText, term)) accepted.push(term);
    else unresolved.push(term);
  }
  if (unresolved.length === 0) return { accepted, rejected: [], unscreened: false };

  /*
   * Neither the job nor the profile names these, so relevance has to be
   * measured. The scale is the same one the ATS score uses: the job's own
   * vocabulary is the top, deliberately off-domain prose is the floor.
   */
  const domain = idealCandidateText([...context.keywords], context.role);
  const [domainEmbedding, controlEmbedding] = await Promise.all([
    embed(domain),
    embed(SEMANTIC_CONTROL_TEXT),
  ]);
  if (domainEmbedding === null || controlEmbedding === null) {
    // No provider to judge with. The user asked for these by name, so they go
    // on the CV; the caller says so rather than dropping them silently.
    return { accepted: [...accepted, ...unresolved], rejected: [], unscreened: true };
  }

  const floor = cosine(controlEmbedding, domainEmbedding);
  const rejected: string[] = [];
  const scored = await Promise.all(
    unresolved.map(async (term) => {
      const embedding = await embed(term);
      return { term, embedding };
    }),
  );
  for (const { term, embedding } of scored) {
    if (embedding === null || cosine(embedding, domainEmbedding) >= floor + RELEVANCE_MARGIN) {
      accepted.push(term);
    } else {
      rejected.push(term);
    }
  }

  return { accepted, rejected, unscreened: false };
}
