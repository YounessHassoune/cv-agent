import React from "react";
import {
  Document,
  type DocumentProps,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { extractText, getDocumentProxy } from "unpdf";
import { titlesFor } from "../../lib/cv-sections.ts";
import {
  accentFlat,
  CV_ACCENT_ALPHA,
  CV_ALPHA,
  CV_INK,
  type CvTheme,
  resolveTheme,
  CV_SEPARATOR,
  type CvTemplate,
  inkFlat,
  pt,
  resolveTemplate,
  shadeFlat,
} from "../../lib/cv-templates.ts";
import type { Cv } from "./cv-schema.ts";

export { SECTION_TITLES, titlesFor } from "../../lib/cv-sections.ts";

const h = React.createElement;

/**
 * The print half of the CV renderer, and a deliberate mirror of
 * `components/cv-preview.tsx`: same sections in the same order, same contact
 * strip, chips and pills, sized from the same shared template layout. What the
 * user approves on screen is what downloads.
 *
 * Every template stays single column, plain text, standard headings and a core
 * PDF font — the parts an ATS actually parses. Only typography and spacing vary.
 */
function stylesFor(template: CvTemplate, theme: CvTheme) {
  const l = template.layout;
  const { accent: hue, stripSolid } = theme;
  const bold = l.serif ? "Times-Bold" : "Helvetica-Bold";
  const textAlign = l.centered ? ("center" as const) : ("left" as const);
  // Templates that skip the rule lean on a lighter title instead, and the serif
  // template draws its rule heavier. Both match the preview skins.
  const ruleAlpha = l.serif ? CV_ALPHA.ruleStrong : CV_ALPHA.rule;
  const chipPadY = pt(0.125);
  // The accented templates colour the same four things the preview does: the
  // name, the section titles and their rules, and the tint behind the strip,
  // chips and pills. Everything else is ink, on paper, as before.
  const tint = hue ? accentFlat(hue, CV_ACCENT_ALPHA.chip) : null;
  const ruled = l.titleStyle === "rule";
  const banded = l.titleStyle === "band";

  return StyleSheet.create({
    page: {
      paddingHorizontal: pt(l.padX),
      paddingTop: pt(l.padY),
      paddingBottom: pt(l.padY),
      fontSize: pt(l.base),
      fontFamily: l.serif ? "Times-Roman" : "Helvetica",
      lineHeight: l.lineHeight,
      color: CV_INK,
    },
    bold: { fontFamily: bold },
    muted: { color: inkFlat(CV_ALPHA.muted) },
    soft: { color: inkFlat(CV_ALPHA.soft) },

    // Full-bleed contact strip: the page padding is pulled back so the band
    // reaches the paper edge, the way the preview's does.
    strip: {
      marginTop: -pt(l.padY),
      marginHorizontal: -pt(l.padX),
      marginBottom: pt(l.padY),
      paddingHorizontal: pt(l.padX),
      paddingVertical: pt(0.3),
      backgroundColor: hue
        ? stripSolid
          ? hue
          : accentFlat(hue, CV_ACCENT_ALPHA.strip)
        : shadeFlat(CV_ALPHA.strip),
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: l.centered ? "center" : "flex-start",
      columnGap: pt(1),
      rowGap: pt(0.15),
    },
    stripItem: {
      fontSize: pt(l.meta),
      color: stripSolid ? "#ffffff" : inkFlat(CV_ALPHA.muted),
      lineHeight: 1.2,
    },

    header: l.headerBand
      ? {
          marginTop: -pt(l.padY),
          marginHorizontal: -pt(l.padX),
          marginBottom: pt(l.sectionGap),
          paddingHorizontal: pt(l.padX),
          paddingVertical: pt(l.padY * 0.8),
          backgroundColor: hue ? accentFlat(hue, CV_ACCENT_ALPHA.strip) : shadeFlat(CV_ALPHA.strip),
        }
      : { marginBottom: pt(l.sectionGap) },
    // Mirrors the preview's header: a row beside the identity block, or a
    // centred column above it on centred templates.
    headerWithPhoto: {
      marginBottom: pt(l.sectionGap),
      flexDirection: l.centered ? "column" : "row",
      alignItems: "center",
      gap: pt(l.photoGap),
      ...(l.headerBand
        ? {
            marginTop: -pt(l.padY),
            marginHorizontal: -pt(l.padX),
            paddingHorizontal: pt(l.padX),
            paddingVertical: pt(l.padY * 0.8),
            backgroundColor: hue
              ? accentFlat(hue, CV_ACCENT_ALPHA.strip)
              : shadeFlat(CV_ALPHA.strip),
          }
        : {}),
    },
    photo: {
      width: pt(l.photoSize),
      height: pt(l.photoSize),
      borderRadius: pt(l.photoSize) / 2,
      objectFit: "cover",
    },
    /**
     * Beside the photo (row templates) this has to shrink so a long headline
     * wraps instead of pushing the block off the page. Stacked *under* the
     * photo (centred templates) the main axis is vertical, where flexShrink
     * would squash the block's height instead of its width and `alignItems:
     * center` would size it to its own content — so it takes the full width
     * and lets textAlign centre the text across the page, exactly as the
     * photo-free header does.
     */
    identity: l.centered ? { width: "100%" } : { flexShrink: 1 },
    name: {
      fontSize: pt(l.name),
      fontFamily: bold,
      color: hue ?? CV_INK,
      textTransform: l.nameCase === "upper" ? "uppercase" : undefined,
      letterSpacing: l.nameCase === "upper" ? pt(l.name * 0.08) : -pt(l.name * 0.02),
      textAlign,
      // Display leading, matching the preview's name. Without it the name
      // inherits the tall body line-height, and its box grows enough to sit on
      // the headline's — which glues the two together in the PDF text layer
      // ("Youness HassouneSenior Engineer") and skews the ATS keyword scan.
      lineHeight: 1.15,
    },
    headline: {
      fontSize: pt(l.headline),
      color: inkFlat(CV_ALPHA.muted),
      marginTop: pt(l.headlineGap),
      textAlign,
      // Pinned, like every other paired element: inheriting the body leading
      // here is what let the preview and the PDF drift apart.
      lineHeight: 1.2,
    },

    section: { marginBottom: pt(l.sectionGap) },
    sectionTitle: {
      fontSize: pt(l.sectionTitle),
      fontFamily: bold,
      color: hue ?? (ruled || banded ? CV_INK : inkFlat(CV_ALPHA.muted)),
      textTransform: "uppercase",
      letterSpacing: pt(l.sectionTitle * l.sectionTracking),
      textAlign: l.titleCenter ? "center" : textAlign,
      // The rule hugs the title, so the tall body line-height is dropped here.
      lineHeight: 1.2,
      borderBottomWidth: ruled ? 0.75 : 0,
      borderBottomColor: hue ? accentFlat(hue, CV_ACCENT_ALPHA.rule) : shadeFlat(ruleAlpha),
      paddingBottom: ruled ? pt(0.25) : banded ? pt(0.22) : 0,
      backgroundColor: banded
        ? (hue ? accentFlat(hue, CV_ACCENT_ALPHA.strip) : shadeFlat(CV_ALPHA.chip))
        : undefined,
      paddingTop: banded ? pt(0.22) : 0,
      paddingHorizontal: banded ? pt(0.4) : 0,
      borderRadius: banded ? pt(0.15) : 0,
      marginBottom: pt(0.5),
    },

    /** Gaps sit *between* entries, never after the last one. */
    entryGap: { marginBottom: pt(l.entryGap) },
    eduGap: { marginBottom: pt(0.375) },
    entryHeader:
      l.gutter > 0
        ? { flexDirection: "row", columnGap: pt(0.75) }
        : { flexDirection: "row", justifyContent: "space-between", columnGap: pt(0.75) },
    /** The left meta column, and the indent that keeps bullets under the title. */
    gutterCol: { width: pt(l.gutter), flexShrink: 0 },
    gutterText: { fontSize: pt(l.meta), color: inkFlat(CV_ALPHA.muted), lineHeight: 1.25 },
    entryBody: l.gutter > 0 ? { paddingLeft: pt(l.gutter + 0.75) } : {},
    // No column gap on the row: the gap lives inside each column as padding,
    // so N columns always come to exactly 100% and the last one never wraps
    // onto a line of its own, orphaned from its category.
    skillColumns: l.skillColumns > 1 ? { flexDirection: "row", flexWrap: "wrap" } : {},
    skillColumn:
      l.skillColumns > 1 ? { width: `${100 / l.skillColumns}%`, paddingRight: pt(0.75) } : {},

    entryTitle: { flexShrink: 1 },

    chip: {
      backgroundColor: tint ?? shadeFlat(CV_ALPHA.chip),
      borderRadius: pt(0.5),
      paddingHorizontal: pt(0.375),
      paddingVertical: chipPadY,
    },
    chipText: {
      fontSize: pt(l.meta),
      color: hue ?? inkFlat(CV_ALPHA.muted),
      lineHeight: 1.2,
    },

    skillGroup: { marginBottom: pt(0.5) },
    skillLabel: {
      fontSize: pt(l.label),
      fontFamily: bold,
      color: inkFlat(CV_ALPHA.soft),
      marginBottom: pt(0.2),
    },
    pillRow: { flexDirection: "row", flexWrap: "wrap", columnGap: pt(0.25), rowGap: pt(0.2) },
    pill: {
      backgroundColor: tint ?? shadeFlat(CV_ALPHA.pill),
      borderRadius: pt(0.5),
      paddingHorizontal: pt(0.375),
      paddingVertical: chipPadY,
    },
    pillText: { fontSize: pt(l.label), lineHeight: 1.2 },

    bullet: { flexDirection: "row", marginTop: pt(0.1) },
    bulletDot: {
      width: pt(0.19),
      height: pt(0.19),
      borderRadius: pt(0.1),
      backgroundColor: inkFlat(CV_ALPHA.soft),
      marginTop: pt(l.base) * 0.55,
      marginRight: pt(0.375),
    },
    bulletText: { flex: 1 },

    stack: { fontSize: pt(l.meta), color: inkFlat(CV_ALPHA.soft), marginTop: pt(0.2) },
    link: { fontSize: pt(l.meta), color: inkFlat(CV_ALPHA.soft) },
  });
}

type Styles = ReturnType<typeof stylesFor>;

/** `space-y-*` semantics: the gap goes on every item but the last. */
function spaced(gap: Styles[keyof Styles], i: number, length: number, base?: Styles[keyof Styles]) {
  const rest = i < length - 1 ? [gap] : [];
  return base ? [base, ...rest] : rest;
}

function Section(styles: Styles, title: string, children: React.ReactNode[]) {
  return h(
    View,
    { style: styles.section, key: title },
    h(Text, { style: styles.sectionTitle }, title),
    ...children,
  );
}

function Chip(styles: Styles, label: string) {
  return h(View, { style: styles.chip }, h(Text, { style: styles.chipText }, label));
}

/** Groups side by side on a multi-column layout, stacked otherwise. */
function wrapColumns(
  groups: React.ReactElement[],
  styles: Styles,
  columns: boolean,
): React.ReactElement[] {
  return columns ? [h(View, { style: styles.skillColumns }, ...groups)] : groups;
}

/**
 * An entry header. On a gutter layout the meta leads, in its own column, and
 * the title sits beside it; otherwise they share a line. The text layer reads
 * the same way the page does either way.
 */
function EntryHead(styles: Styles, gutter: boolean, title: unknown, parts: string[]) {
  const shown = parts.filter(Boolean);

  if (gutter) {
    // Stacked, not joined: one line of "Oct 2017 - Jul 2019 · Casablanca" is
    // wider than the column and overruns the role beside it.
    return h(
      View,
      { style: styles.entryHeader },
      h(
        View,
        { style: styles.gutterCol },
        ...shown.map((part, i) => h(Text, { key: i, style: styles.gutterText }, part)),
      ),
      h(View, { style: styles.entryTitle }, title as never),
    );
  }

  const meta = shown.join(CV_SEPARATOR);
  return h(
    View,
    { style: styles.entryHeader },
    title as never,
    ...(meta ? [Chip(styles, meta)] : []),
  );
}

function Bullets(styles: Styles, bullets: string[]) {
  return bullets.map((bullet, i) =>
    h(
      View,
      { style: styles.bullet, key: i },
      h(View, { style: styles.bulletDot }),
      h(Text, { style: styles.bulletText }, bullet),
    ),
  );
}

function Stack(styles: Styles, stack: string[] | undefined) {
  if (!stack || stack.length === 0) return [];
  return [h(Text, { style: styles.stack, key: "stack" }, stack.join(CV_SEPARATOR))];
}

function dateRange(start?: string, end?: string) {
  if (!start && !end) return null;
  return `${start ?? ""} - ${end || "Present"}`;
}

/**
 * Raw bytes of the header photo, already cropped and sized by the caller.
 * Bytes rather than a URL on purpose: @react-pdf would otherwise fetch the
 * image mid-render, putting a network round trip (and its failure modes)
 * inside PDF generation.
 */
export type CvPhoto = { data: Buffer; format: "jpg" | "png" };

function CvDocument({
  cv,
  templateId,
  themeId,
  photo,
}: {
  cv: Cv;
  templateId?: string;
  themeId?: string;
  photo?: CvPhoto;
}) {
  const template = resolveTemplate(templateId);
  const theme = resolveTheme(themeId);
  const styles = stylesFor(template, theme);
  const { gutter, skillColumns } = template.layout;
  const t = titlesFor(cv.language);
  const contact = [cv.header.email, cv.header.phone, cv.header.location, ...cv.header.links].filter(
    (part): part is string => Boolean(part),
  );

  return h(
    Document,
    { title: `${cv.header.fullName} — CV`, author: cv.header.fullName },
    h(
      Page,
      { size: "A4", style: styles.page },

      // Contact strip, above the identity block
      ...(contact.length > 0
        ? [
            h(
              View,
              { style: styles.strip, key: "strip" },
              ...contact.map((item, i) => h(Text, { style: styles.stripItem, key: i }, item)),
            ),
          ]
        : []),

      // Identity, with the optional header photo beside or above it
      h(
        View,
        { style: photo ? styles.headerWithPhoto : styles.header },
        ...(photo
          ? [
              h(Image, {
                key: "photo",
                src: { data: photo.data, format: photo.format },
                style: styles.photo,
              }),
            ]
          : []),
        h(
          View,
          { style: styles.identity, key: "identity" },
          h(Text, { style: styles.name }, cv.header.fullName),
          ...(cv.header.headline ? [h(Text, { style: styles.headline }, cv.header.headline)] : []),
        ),
      ),

      // Summary
      ...(cv.summary ? [Section(styles, t.summary, [h(Text, { key: "s" }, cv.summary)])] : []),

      // Skills — a labelled row of pills per category
      ...(cv.skills.length > 0
        ? [
            Section(
              styles,
              t.skills,
              // Multi-column layouts wrap the groups into a row; single-column
              // ones stack them exactly as before.
              wrapColumns(
              cv.skills.map((group, i) =>
                h(
                  View,
                  {
                    style: spaced(
                      styles.skillGroup,
                      i,
                      cv.skills.length,
                      skillColumns > 1 ? styles.skillColumn : undefined,
                    ),
                    key: i,
                    wrap: false,
                  },
                  h(Text, { style: styles.skillLabel }, group.category),
                  h(
                    View,
                    { style: styles.pillRow },
                    ...group.items.map((item, j) =>
                      h(
                        View,
                        { style: styles.pill, key: j },
                        h(Text, { style: styles.pillText }, item),
                      ),
                    ),
                  ),
                ),
              ),
              styles,
              skillColumns > 1,
              ),
            ),
          ]
        : []),

      // Experience
      ...(cv.experiences.length > 0
        ? [
            Section(
              styles,
              t.experience,
              cv.experiences.map((exp, i) => {
                const meta = [dateRange(exp.start, exp.end), exp.location ?? ""].filter(
                  (part): part is string => Boolean(part),
                );
                return h(
                  View,
                  { style: spaced(styles.entryGap, i, cv.experiences.length), key: i, wrap: false },
                  EntryHead(
                    styles,
                    gutter > 0,
                    h(
                      Text,
                      { style: styles.entryTitle },
                      h(Text, { style: styles.bold }, exp.role),
                      h(Text, { style: styles.muted }, `${CV_SEPARATOR}${exp.company}`),
                    ),
                    meta,
                  ),
                  h(
                    View,
                    { style: styles.entryBody },
                    ...Bullets(styles, exp.bullets),
                    ...Stack(styles, exp.stack),
                  ),
                );
              }),
            ),
          ]
        : []),

      // Projects
      ...(cv.projects.length > 0
        ? [
            Section(
              styles,
              t.projects,
              cv.projects.map((project, i) =>
                h(
                  View,
                  { style: spaced(styles.entryGap, i, cv.projects.length), key: i, wrap: false },
                  EntryHead(
                    styles,
                    gutter > 0,
                    h(
                      Text,
                      { style: [styles.entryTitle, styles.bold] },
                      project.title,
                      ...(project.link
                        ? [h(Text, { style: styles.link }, `${CV_SEPARATOR}${project.link}`)]
                        : []),
                    ),
                    [],
                  ),
                  h(
                    View,
                    { style: styles.entryBody },
                    ...Bullets(styles, project.bullets),
                    ...Stack(styles, project.stack),
                  ),
                ),
              ),
            ),
          ]
        : []),

      // Education
      ...(cv.education.length > 0
        ? [
            Section(
              styles,
              t.education,
              cv.education.map((entry, i) =>
                h(
                  View,
                  {
                    style: spaced(styles.eduGap, i, cv.education.length, styles.entryHeader),
                    key: i,
                    wrap: false,
                  },
                  ...(gutter > 0
                    ? [
                        h(
                          View,
                          { style: styles.gutterCol },
                          h(Text, { style: styles.gutterText }, entry.dates ?? ""),
                        ),
                      ]
                    : []),
                  h(
                    Text,
                    { style: styles.entryTitle },
                    h(Text, { style: styles.bold }, entry.degree),
                    h(Text, { style: styles.muted }, `${CV_SEPARATOR}${entry.institution}`),
                  ),
                  ...(gutter === 0 && entry.dates ? [Chip(styles, entry.dates)] : []),
                ),
              ),
            ),
          ]
        : []),

      // Languages
      ...(cv.languages.length > 0
        ? [
            Section(styles, t.languages, [
              h(
                Text,
                { key: "l" },
                cv.languages.map((lang) => `${lang.name} (${lang.level})`).join(CV_SEPARATOR),
              ),
            ]),
          ]
        : []),
    ),
  );
}

export async function renderCvPdf(
  cv: Cv,
  templateId?: string,
  photo?: CvPhoto,
  themeId?: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const buffer = await renderToBuffer(
    h(CvDocument, { cv, templateId, themeId, photo }) as unknown as React.ReactElement<DocumentProps>,
  );
  return Uint8Array.from(buffer);
}

export async function extractPdfText(
  pdfBytes: Uint8Array,
): Promise<{ text: string; pageCount: number }> {
  const doc = await getDocumentProxy(new Uint8Array(pdfBytes));
  const { text, totalPages } = await extractText(doc, { mergePages: true });
  return { text, pageCount: totalPages };
}

