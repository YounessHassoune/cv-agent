import React from "react";
import {
  Document,
  type DocumentProps,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { extractText, getDocumentProxy } from "unpdf";
import { type CvTemplate, resolveTemplate } from "../../lib/cv-templates";
import type { Cv } from "./cv-schema";

const h = React.createElement;

/**
 * Localized section titles. The ATS structure check verifies these same
 * strings, so template and scorer can never drift apart.
 */
export const SECTION_TITLES: Record<
  string,
  { summary: string; skills: string; experience: string; projects: string; education: string; languages: string }
> = {
  en: { summary: "Summary", skills: "Skills", experience: "Experience", projects: "Projects", education: "Education", languages: "Languages" },
  fr: { summary: "Profil", skills: "Compétences", experience: "Expérience", projects: "Projets", education: "Formation", languages: "Langues" },
  es: { summary: "Perfil", skills: "Habilidades", experience: "Experiencia", projects: "Proyectos", education: "Educación", languages: "Idiomas" },
  de: { summary: "Profil", skills: "Kenntnisse", experience: "Berufserfahrung", projects: "Projekte", education: "Ausbildung", languages: "Sprachen" },
};

export function titlesFor(language: string) {
  return SECTION_TITLES[language.slice(0, 2).toLowerCase()] ?? SECTION_TITLES.en;
}

/**
 * Every template is single column, plain text, standard headings and a core PDF
 * font — the parts an ATS actually parses. Only typography and spacing vary.
 */
function stylesFor(template: CvTemplate) {
  const t = template.pdf;
  return StyleSheet.create({
    page: {
      padding: t.padding,
      fontSize: t.fontSize,
      fontFamily: t.fontFamily,
      color: "#111",
      lineHeight: t.lineHeight,
    },
    header: { marginBottom: 2, textAlign: t.centerHeader ? "center" : "left" },
    name: { fontSize: t.nameSize, fontFamily: t.boldFontFamily },
    headline: { fontSize: t.fontSize + 1, marginTop: 2, color: "#333" },
    contact: { fontSize: t.fontSize - 1, marginTop: 4, color: "#444" },
    section: { marginTop: t.entryGap + 4 },
    sectionTitle: {
      fontSize: t.sectionTitleSize,
      fontFamily: t.boldFontFamily,
      textTransform: t.uppercaseSectionTitles ? "uppercase" : "none",
      borderBottomWidth: t.sectionRule ? 1 : 0,
      borderBottomColor: "#999",
      paddingBottom: t.sectionRule ? 2 : 0,
      marginBottom: 6,
      letterSpacing: t.uppercaseSectionTitles ? 0.5 : 0,
    },
    entry: { marginBottom: t.entryGap },
    entryHeader: { flexDirection: "row", justifyContent: "space-between" },
    entryTitle: { fontFamily: t.boldFontFamily, fontSize: t.fontSize + 0.5 },
    entryMeta: { fontSize: t.fontSize - 1, color: "#444" },
    bullet: { flexDirection: "row", marginTop: 2 },
    bulletGlyph: { width: 10 },
    bulletText: { flex: 1 },
    skillRow: { marginBottom: 2 },
    bold: { fontFamily: t.boldFontFamily },
  });
}

type Styles = ReturnType<typeof stylesFor>;

function Section(styles: Styles, title: string, children: React.ReactNode[]) {
  return h(
    View,
    { style: styles.section },
    h(Text, { style: styles.sectionTitle }, title),
    ...children,
  );
}

function Bullets(styles: Styles, bullets: string[]) {
  return bullets.map((b, i) =>
    h(
      View,
      { style: styles.bullet, key: i },
      h(Text, { style: styles.bulletGlyph }, "•"),
      h(Text, { style: styles.bulletText }, b),
    ),
  );
}

function CvDocument({ cv, templateId }: { cv: Cv; templateId?: string }) {
  const styles = stylesFor(resolveTemplate(templateId));
  const t = titlesFor(cv.language);
  const contactParts = [
    cv.header.email,
    cv.header.phone,
    cv.header.location,
    ...cv.header.links,
  ].filter((p): p is string => Boolean(p));

  return h(
    Document,
    { title: `${cv.header.fullName} — CV`, author: cv.header.fullName },
    h(
      Page,
      { size: "A4", style: styles.page },
      // Header
      h(
        View,
        { style: styles.header },
        h(Text, { style: styles.name }, cv.header.fullName),
        h(Text, { style: styles.headline }, cv.header.headline),
        h(Text, { style: styles.contact }, contactParts.join("  ·  ")),
      ),
      // Summary
      ...(cv.summary ? [Section(styles, t.summary, [h(Text, { key: "s" }, cv.summary)])] : []),
      // Skills
      Section(
        styles,
        t.skills,
        cv.skills.map((group, i) =>
          h(
            Text,
            { style: styles.skillRow, key: i },
            h(Text, { style: styles.bold }, `${group.category}: `),
            group.items.join(", "),
          ),
        ),
      ),
      // Experience
      Section(
        styles,
        t.experience,
        cv.experiences.map((exp, i) =>
          h(
            View,
            { style: styles.entry, key: i },
            h(
              View,
              { style: styles.entryHeader },
              h(Text, { style: styles.entryTitle }, `${exp.role} — ${exp.company}`),
              h(
                Text,
                { style: styles.entryMeta },
                [exp.start, exp.end].filter(Boolean).join(" – ") +
                  (exp.location ? `  ·  ${exp.location}` : ""),
              ),
            ),
            ...Bullets(styles, exp.bullets),
          ),
        ),
      ),
      // Projects
      ...(cv.projects.length > 0
        ? [
            Section(
              styles,
              t.projects,
              cv.projects.map((p, i) =>
                h(
                  View,
                  { style: styles.entry, key: i },
                  h(
                    View,
                    { style: styles.entryHeader },
                    h(Text, { style: styles.entryTitle }, p.title),
                    ...(p.link ? [h(Text, { style: styles.entryMeta }, p.link)] : []),
                  ),
                  ...Bullets(styles, p.bullets),
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
              cv.education.map((e, i) =>
                h(
                  View,
                  { style: [styles.entryHeader, { marginBottom: 2 }], key: i },
                  h(Text, { style: styles.entryTitle }, `${e.degree} — ${e.institution}`),
                  ...(e.dates ? [h(Text, { style: styles.entryMeta }, e.dates)] : []),
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
                cv.languages.map((l) => `${l.name} (${l.level})`).join("  ·  "),
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
): Promise<Uint8Array<ArrayBuffer>> {
  const buffer = await renderToBuffer(
    h(CvDocument, { cv, templateId }) as unknown as React.ReactElement<DocumentProps>,
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
