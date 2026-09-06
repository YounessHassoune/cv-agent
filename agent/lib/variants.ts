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
  updatedAt: string; // ISO timestamp
};

export type VariantMap = Record<string, CvVariant>;

export function readVariants(value: unknown): VariantMap {
  return value && typeof value === "object" ? (value as VariantMap) : {};
}
