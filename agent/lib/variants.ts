import type { AtsReport } from "./ats";
import type { Cv } from "./cv-schema";

/**
 * One language's tailored CV inside `Application.variants` (a JSON map keyed
 * by ISO language code). PDF bytes live in the `CvPdf` table — JSON columns
 * can't hold binary and base64 would bloat every application read.
 */
export type CvVariant = {
  cvJson: Cv;
  /** Text extracted from the compiled PDF — what score_ats actually scores. */
  cvText: string;
  atsReport: AtsReport | null;
  template: string;
  /** Colour theme, chosen independently of the layout. Absent on older rows. */
  theme?: string;
  /** Pages the compiled PDF came to, so a repeat compile can answer without rendering. */
  pageCount?: number;
  /**
   * Skills the CV claims that the master profile does not list. The job asked
   * for them and the profile is not exhaustive, so they are allowed — but they
   * are the user's word, not the profile's, and the review UI shows every one.
   */
  unsupported?: string[];
  updatedAt: string; // ISO timestamp
};

export type VariantMap = Record<string, CvVariant>;

/**
 * Drafts `write_cv` has stored and `compile_pdf` has not yet rendered, keyed
 * by ISO language code. Kept apart from `variants` because a draft is not a
 * CV the user can see: it has no PDF, no text, no score.
 */
export function readDrafts(value: unknown): Record<string, Cv> {
  return value && typeof value === "object" ? (value as Record<string, Cv>) : {};
}

export function readVariants(value: unknown): VariantMap {
  return value && typeof value === "object" ? (value as VariantMap) : {};
}

/**
 * Key-order-independent comparison of two CV drafts. The stored copy has been
 * through JSON, the incoming one through Zod, so a plain `JSON.stringify`
 * comparison would report a difference that is not there.
 */
export function sameCv(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([x], [y]) => (x < y ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
    .join(",")}}`;
}
