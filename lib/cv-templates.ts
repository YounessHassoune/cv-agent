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
export const CV_TEMPLATE_IDS = [
  "modern",
  "classic",
  "compact",
  "editorial",
  "impact",
  "ledger",
] as const;

export type CvTemplateId = (typeof CV_TEMPLATE_IDS)[number];

export const DEFAULT_TEMPLATE: CvTemplateId = "modern";

/**
 * Ceiling for `sectionTracking`. Measured, not guessed: at 0.14em a heading
 * extracts as "S U M M A RY", at 0.10em and below it extracts as "SUMMARY".
 */
export const MAX_SECTION_TRACKING = 0.1;

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
  /**
   * Section title letter spacing, in em of the title size.
   *
   * Keep this at or below `MAX_SECTION_TRACKING`. Past roughly 0.1em the PDF
   * text extractors — pdf.js here, and the ones real ATS software is built on —
   * read the gaps as word breaks and the heading comes out as
   * "E X P E R I E N C E", which is not a heading any parser recognises. Every
   * layout shipped above that line until it was measured; `scripts/` renders
   * each one and checks the text layer.
   */
  sectionTracking: number;
  /** Space below a finished section. */
  sectionGap: number;
  /** Space between entries inside a section. */
  entryGap: number;
  centered: boolean;
  /**
   * How a section heading is drawn. `rule` underlines it, `plain` lets a
   * lighter weight carry it, `band` sets it on a tinted bar — which is where a
   * colour theme shows most. Never anything an ATS reads as structure: it is a
   * heading followed by its section either way.
   */
  titleStyle: "rule" | "plain" | "band";
  /** Upper-cased names are a house style, not a data change. */
  nameCase: "normal" | "upper";
  /** Centre section headings inside their rule or band. */
  titleCenter: boolean;
  /**
   * Width of the left meta column, in rem, or 0 for none. Above zero, an
   * entry's dates and location move out of the line beside its title and into
   * a column of their own, with the bullets aligned to the title — the
   * two-track look. Still one column of text in reading order: the meta comes
   * first, then the role, exactly as it reads on the page.
   */
  gutter: number;
  /** Columns the skill list is laid out in. */
  skillColumns: number;
  /** Set the header on a tinted band across the top of the sheet. */
  headerBand: boolean;
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
      sectionTracking: 0.08,
      sectionGap: 1.25,
      entryGap: 0.875,
      centered: false,
      titleStyle: "rule",
      nameCase: "normal",
      titleCenter: false,
      gutter: 0,
      skillColumns: 1,
      headerBand: false,
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
      sectionTracking: 0.08,
      sectionGap: 1.25,
      entryGap: 1,
      centered: true,
      titleStyle: "rule",
      nameCase: "normal",
      titleCenter: false,
      gutter: 0,
      skillColumns: 1,
      headerBand: false,
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
      sectionTracking: 0.07,
      sectionGap: 0.9,
      entryGap: 0.625,
      centered: false,
      titleStyle: "plain",
      nameCase: "normal",
      titleCenter: false,
      gutter: 0,
      skillColumns: 1,
      headerBand: false,
    },
  },
  editorial: {
    id: "editorial",
    label: "Editorial",
    description: "Serif with a tracked, upper-case name. Unhurried and senior.",
    layout: {
      serif: true,
      base: 0.71,
      lineHeight: 1.6,
      padX: 3,
      padY: 2.5,
      name: 1.25,
      headline: 0.8,
      headlineGap: 0.5,
      photoSize: 4,
      photoGap: 1.25,
      meta: 0.58,
      label: 0.6,
      sectionTitle: 0.6,
      sectionTracking: 0.08,
      sectionGap: 1.4,
      entryGap: 1,
      centered: false,
      titleStyle: "plain",
      nameCase: "upper",
      titleCenter: false,
      gutter: 0,
      skillColumns: 1,
      headerBand: false,
    },
  },
  impact: {
    id: "impact",
    label: "Impact",
    description: "Banded headings and a heavy upper-case name. Hard to skim past.",
    layout: {
      serif: false,
      base: 0.7,
      lineHeight: 1.45,
      padX: 2.5,
      padY: 2,
      name: 1.45,
      headline: 0.78,
      headlineGap: 0.4,
      photoSize: 4,
      photoGap: 1.25,
      meta: 0.58,
      label: 0.6,
      sectionTitle: 0.58,
      sectionTracking: 0.07,
      sectionGap: 1.2,
      entryGap: 0.85,
      centered: false,
      titleStyle: "band",
      nameCase: "upper",
      titleCenter: false,
      gutter: 0,
      skillColumns: 1,
      headerBand: false,
    },
  },
  ledger: {
    id: "ledger",
    label: "Ledger",
    description:
      "Dates in a left column, centred banded headings, skills in columns. The most designed of the set.",
    layout: {
      serif: true,
      base: 0.66,
      lineHeight: 1.5,
      padX: 2.5,
      padY: 2,
      name: 1.3,
      headline: 0.78,
      headlineGap: 0.3,
      photoSize: 4.5,
      photoGap: 1.5,
      meta: 0.58,
      label: 0.6,
      sectionTitle: 0.62,
      sectionTracking: 0.04,
      sectionGap: 1.15,
      entryGap: 0.8,
      centered: false,
      titleStyle: "band",
      nameCase: "normal",
      titleCenter: true,
      gutter: 7,
      skillColumns: 3,
      headerBand: true,
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

/** "#1d4ed8" → [29, 78, 216]. */
function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** The accent at `alpha`, for the screen. */
export function accent(hex: string, alpha = 1): string {
  const [r, g, b] = channels(hex);
  return alpha === 1 ? hex : `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** The same accent flattened onto white, for the PDF, which prints on paper. */
export function accentFlat(hex: string, alpha = 1): string {
  if (alpha === 1) return hex;
  const flattened = channels(hex).map((channel) =>
    Math.round(channel * alpha + 255 * (1 - alpha))
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${flattened.join("")}`;
}

/** Tints used only by the coloured themes. */
export const CV_ACCENT_ALPHA = {
  /** Behind the contact strip when it is not painted solid. */
  strip: 0.08,
  /** Behind date chips and skill pills. */
  chip: 0.1,
  /** Section rules. */
  rule: 0.45,
} as const;

/**
 * Colour themes, the second axis. A theme never moves anything: the layout
 * decides typography and spacing, the theme decides ink. They are independent
 * because "I want the compact one, in green" is a normal thing to want, and
 * folding the two into six fixed templates makes it unsayable.
 *
 * Every theme stays ATS-safe for the same reason the layouts do — one column
 * of real text, standard headings, core fonts. Colour lands only on the name,
 * the section titles and their rules, and the tint behind the contact strip,
 * date chips and skill pills.
 */
export const CV_THEME_IDS = ["mono", "azure", "ember", "forest", "plum", "slate"] as const;

export type CvThemeId = (typeof CV_THEME_IDS)[number];

export const DEFAULT_THEME: CvThemeId = "mono";

export type CvTheme = {
  /** A preset's id, or "custom" for a colour the user picked. */
  id: CvThemeId | "custom";
  label: string;
  description: string;
  /** Hex, or null for the original monochrome document. */
  accent: string | null;
  /** Paint the contact strip solid in the accent, with white text. */
  stripSolid: boolean;
};

export const CV_THEMES: Record<CvThemeId, CvTheme> = {
  mono: {
    id: "mono",
    label: "Ink",
    description: "Black on white. The safest thing you can send anyone.",
    accent: null,
    stripSolid: false,
  },
  azure: {
    id: "azure",
    label: "Azure",
    description: "Confident blue with a solid contact band.",
    accent: "#1d4ed8",
    stripSolid: true,
  },
  ember: {
    id: "ember",
    label: "Ember",
    description: "Warm amber. Reads as designed without shouting.",
    accent: "#b45309",
    stripSolid: false,
  },
  forest: {
    id: "forest",
    label: "Forest",
    description: "Deep green, calm and unusual on a desk of grey CVs.",
    accent: "#166534",
    stripSolid: false,
  },
  plum: {
    id: "plum",
    label: "Plum",
    description: "Muted violet. Creative without the crayons.",
    accent: "#6d28d9",
    stripSolid: false,
  },
  slate: {
    id: "slate",
    label: "Slate",
    description: "Near-black blue-grey. Colour you notice only up close.",
    accent: "#334155",
    stripSolid: false,
  },
};

/**
 * Layout and theme, flattened into the one object the renderers read. They are
 * chosen separately and stored separately; only the drawing code wants them
 * together.
 */
export type CvSkin = CvLayout & Pick<CvTheme, "accent" | "stripSolid">;

export function skinFor(templateId?: string | null, themeId?: string | null): CvSkin {
  const { accent: hue, stripSolid } = resolveTheme(themeId);
  return { ...resolveTemplate(templateId).layout, accent: hue, stripSolid };
}

/** A colour the user picked themselves, rather than one of the presets. */
const HEX = /^#[0-9a-fA-F]{6}$/;

export const isCustomAccent = (value: string | null | undefined): value is string =>
  typeof value === "string" && HEX.test(value);

/**
 * Anything stored in `theme` — a preset id, or a hex the user picked. Unknown
 * values fall back to the default rather than throwing: the column is a plain
 * string and an old row may hold a theme that no longer exists.
 */
export function resolveTheme(value: string | null | undefined): CvTheme {
  if (isCustomAccent(value)) {
    return {
      id: "custom",
      label: "Custom",
      description: "A colour you picked.",
      accent: value.toLowerCase(),
      // Never solid: a user-chosen colour can be pale enough that white text on
      // it is unreadable, and nothing here measures contrast.
      stripSolid: false,
    };
  }
  const id = (value ?? "") as CvThemeId;
  return CV_THEMES[id] ?? CV_THEMES[DEFAULT_THEME];
}

/** What a request may put in `theme`: a preset id, a hex, or nothing. */
export function normalizeTheme(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (isCustomAccent(value)) return value.toLowerCase();
  return CV_THEME_IDS.includes(value as CvThemeId) ? value : undefined;
}

export const CV_THEME_LIST: CvTheme[] = CV_THEME_IDS.map((id) => CV_THEMES[id]);

export function resolveTemplate(value: string | null | undefined): CvTemplate {
  const id = (value ?? "") as CvTemplateId;
  return CV_TEMPLATES[id] ?? CV_TEMPLATES[DEFAULT_TEMPLATE];
}

export const CV_TEMPLATE_LIST: CvTemplate[] = CV_TEMPLATE_IDS.map((id) => CV_TEMPLATES[id]);

/** The separator between inline items ("Role · Company"), shared by both renderers. */
export const CV_SEPARATOR = " · ";
