/**
 * CV templates. Every one of these is ATS-safe by construction: a single
 * column, real text (no tables, columns, graphics or text boxes), standard
 * section headings, and a core PDF font. They differ only in typography,
 * spacing and how section titles are drawn — never in structure, because the
 * structure is what an ATS parser reads.
 */
export const CV_TEMPLATE_IDS = ["modern", "classic", "compact"] as const;

export type CvTemplateId = (typeof CV_TEMPLATE_IDS)[number];

export const DEFAULT_TEMPLATE: CvTemplateId = "modern";

export type CvTemplate = {
  id: CvTemplateId;
  label: string;
  description: string;
  /** Core PDF fonts only — embedded/exotic fonts break text extraction. */
  pdf: {
    fontFamily: "Helvetica" | "Times-Roman";
    boldFontFamily: "Helvetica-Bold" | "Times-Bold";
    fontSize: number;
    lineHeight: number;
    padding: number;
    nameSize: number;
    sectionTitleSize: number;
    /** Centred headers read as "traditional"; left as "modern". */
    centerHeader: boolean;
    uppercaseSectionTitles: boolean;
    sectionRule: boolean;
    entryGap: number;
  };
};

export const CV_TEMPLATES: Record<CvTemplateId, CvTemplate> = {
  modern: {
    id: "modern",
    label: "Modern",
    description: "Left-aligned sans-serif with ruled section headings. Safe default.",
    pdf: {
      fontFamily: "Helvetica",
      boldFontFamily: "Helvetica-Bold",
      fontSize: 9.5,
      lineHeight: 1.35,
      padding: 36,
      nameSize: 18,
      sectionTitleSize: 11,
      centerHeader: false,
      uppercaseSectionTitles: true,
      sectionRule: true,
      entryGap: 8,
    },
  },
  classic: {
    id: "classic",
    label: "Classic",
    description: "Centred serif header in the traditional style. Reads well in finance and law.",
    pdf: {
      fontFamily: "Times-Roman",
      boldFontFamily: "Times-Bold",
      fontSize: 10.5,
      lineHeight: 1.4,
      padding: 42,
      nameSize: 20,
      sectionTitleSize: 11.5,
      centerHeader: true,
      uppercaseSectionTitles: true,
      sectionRule: true,
      entryGap: 9,
    },
  },
  compact: {
    id: "compact",
    label: "Compact",
    description: "Tighter spacing that fits a longer history on one page.",
    pdf: {
      fontFamily: "Helvetica",
      boldFontFamily: "Helvetica-Bold",
      fontSize: 9,
      lineHeight: 1.25,
      padding: 28,
      nameSize: 15.5,
      sectionTitleSize: 9.5,
      centerHeader: false,
      uppercaseSectionTitles: true,
      sectionRule: false,
      entryGap: 6,
    },
  },
};

export function resolveTemplate(value: string | null | undefined): CvTemplate {
  const id = (value ?? "") as CvTemplateId;
  return CV_TEMPLATES[id] ?? CV_TEMPLATES[DEFAULT_TEMPLATE];
}

export const CV_TEMPLATE_LIST: CvTemplate[] = CV_TEMPLATE_IDS.map((id) => CV_TEMPLATES[id]);
