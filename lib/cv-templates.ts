/**
 * CV templates. Every one of these is ATS-safe by construction: a single
 * column, real text (no tables, columns, graphics or text boxes), standard
 * section headings, and a core PDF font. They differ only in typography,
 * spacing and how section titles are drawn — never in structure, because the
 * structure is what an ATS parser reads.
 *
 * The numbers below are the *single* source of layout for both renderers:
 * `components/cv-preview.tsx` (screen) and `agent/lib/pdf.ts` (print). They
 * are expressed in rem against a 46rem-wide sheet — the width the preview is
 * laid out at — and the PDF converts them with `pt()`. Keep it that way: if a
 * size only exists in one renderer, the preview and the download drift apart.
 */
export const CV_TEMPLATE_IDS = ["modern", "classic", "compact"] as const;

export type CvTemplateId = (typeof CV_TEMPLATE_IDS)[number];

export const DEFAULT_TEMPLATE: CvTemplateId = "modern";

/** Width the preview sheet is designed at, in rem. */
export const SHEET_REM = 46;

/** A4 width in PDF points. */
const A4_WIDTH_PT = 595.28;

/** Points per rem, so one rem covers the same fraction of the page in both. */
export const PT_PER_REM = A4_WIDTH_PT / SHEET_REM;

/** Convert a layout rem value to PDF points. */
export function pt(rem: number): number {
  return Math.round(rem * PT_PER_REM * 100) / 100;
}

/** Every size in rem, every gap in rem. See the file header. */
export type CvLayout = {
  /** Serif → `Times` in the PDF and `font-serif` on screen. */
  serif: boolean;
  /** Body copy. */
  base: number;
  lineHeight: number;
  padX: number;
  padY: number;
  name: number;
  headline: number;
  /**
   * Space between the name and the headline under it. An explicit token
   * because the two renderers disagree about inherited leading: CSS puts
   * half-leading above a first line and @react-pdf does not, so leaving this
   * gap implicit rendered the PDF header visibly tighter than the preview.
   * Both renderers also pin the headline's line-height, so this is the only
   * thing that moves the two apart.
   */
  headlineGap: number;
  /** Diameter of the optional header photo. */
  photoSize: number;
  /** Space between the photo and the identity block beside/below it. */
  photoGap: number;
  /** Contact strip, date chips, stack lines. */
  meta: number;
  /** Skill category labels. */
  label: number;
  sectionTitle: number;
  /** Section title letter spacing, in em of the title size. */
  sectionTracking: number;
  /** Space below a finished section. */
  sectionGap: number;
  /** Space between entries inside a section. */
  entryGap: number;
  centered: boolean;
  sectionRule: boolean;
};

export type CvTemplate = {
  id: CvTemplateId;
  label: string;
  description: string;
  layout: CvLayout;
};

export const CV_TEMPLATES: Record<CvTemplateId, CvTemplate> = {
  modern: {
    id: "modern",
    label: "Modern",
    description: "Left-aligned sans-serif with ruled section headings. Safe default.",
    layout: {
      serif: false,
      base: 0.7,
      lineHeight: 1.5,
      padX: 2.5,
      padY: 2.25,
      name: 1.35,
      headline: 0.8,
      headlineGap: 0.45,
      photoSize: 4,
      photoGap: 1.25,
      meta: 0.58,
      label: 0.6,
      sectionTitle: 0.6,
      sectionTracking: 0.14,
      sectionGap: 1.25,
      entryGap: 0.875,
      centered: false,
      sectionRule: true,
    },
  },
  classic: {
    id: "classic",
    label: "Classic",
    description: "Centred serif header in the traditional style. Reads well in finance and law.",
    layout: {
      serif: true,
      base: 0.72,
      lineHeight: 1.55,
      padX: 3,
      padY: 2.5,
      name: 1.5,
      headline: 0.82,
      headlineGap: 0.45,
      photoSize: 4,
      photoGap: 0.75,
      meta: 0.6,
      label: 0.62,
      sectionTitle: 0.62,
      sectionTracking: 0.2,
      sectionGap: 1.25,
      entryGap: 1,
      centered: true,
      sectionRule: true,
    },
  },
  compact: {
    id: "compact",
    label: "Compact",
    description: "Tighter spacing that fits a longer history on one page.",
    layout: {
      serif: false,
      base: 0.64,
      lineHeight: 1.32,
      padX: 2,
      padY: 1.5,
      name: 1.1,
      headline: 0.72,
      headlineGap: 0.34,
      photoSize: 3.5,
      photoGap: 1,
      meta: 0.56,
      label: 0.58,
      sectionTitle: 0.56,
      sectionTracking: 0.16,
      sectionGap: 0.9,
      entryGap: 0.625,
      centered: false,
      sectionRule: false,
    },
  },
};

/**
 * Shared opacities. The screen keeps them as alpha so the sheet still reads in
 * dark mode; the PDF flattens them onto white, which is what it prints on.
 */
export const CV_ALPHA = {
  /** Secondary text: headline, contact strip, chips. */
  muted: 0.7,
  /** Tertiary text: skill labels, stack lines. */
  soft: 0.6,
  /** Contact strip background. */
  strip: 0.04,
  /** Date chip background. */
  chip: 0.05,
  /** Skill pill background. */
  pill: 0.06,
  /** Section rule. */
  rule: 0.15,
  /** Section rule on templates that draw it heavier. */
  ruleStrong: 0.25,
} as const;

/** Body ink, matching `--paper-foreground`. */
export const CV_INK = "#1f1f1f";

const INK_CHANNEL = 0x1f;

function flatten(channel: number, alpha: number): string {
  const v = Math.round(channel * alpha + 255 * (1 - alpha));
  return `#${v.toString(16).padStart(2, "0").repeat(3)}`;
}

/** Ink at `alpha`, for the screen, where the paper is not always pure white. */
export function ink(alpha: number): string {
  return `rgba(31, 31, 31, ${alpha})`;
}

/** The same ink flattened onto white, for the PDF. */
export function inkFlat(alpha: number): string {
  return flatten(INK_CHANNEL, alpha);
}

/** A black wash at `alpha` — backgrounds and rules, on screen. */
export function shade(alpha: number): string {
  return `rgba(0, 0, 0, ${alpha})`;
}

/** The same wash flattened onto white, for the PDF. */
export function shadeFlat(alpha: number): string {
  return flatten(0, alpha);
}

export function resolveTemplate(value: string | null | undefined): CvTemplate {
  const id = (value ?? "") as CvTemplateId;
  return CV_TEMPLATES[id] ?? CV_TEMPLATES[DEFAULT_TEMPLATE];
}

export const CV_TEMPLATE_LIST: CvTemplate[] = CV_TEMPLATE_IDS.map((id) => CV_TEMPLATES[id]);

/** The separator between inline items ("Role · Company"), shared by both renderers. */
export const CV_SEPARATOR = " · ";
