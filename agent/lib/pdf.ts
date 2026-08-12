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

// Single column, standard font, no tables/graphics — ATS-parseable by design.
const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: "Helvetica", color: "#111", lineHeight: 1.35 },
  name: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  headline: { fontSize: 10.5, marginTop: 2, color: "#333" },
  contact: { fontSize: 8.5, marginTop: 4, color: "#444" },
  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#999",
    paddingBottom: 2,
    marginBottom: 6,
  },
  entry: { marginBottom: 8 },
  entryHeader: { flexDirection: "row", justifyContent: "space-between" },
  entryTitle: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  entryMeta: { fontSize: 8.5, color: "#444" },
  bullet: { flexDirection: "row", marginTop: 2 },
  bulletGlyph: { width: 10 },
  bulletText: { flex: 1 },
  skillRow: { marginBottom: 2 },
});

function Section(title: string, children: React.ReactNode[]) {
  return h(
    View,
    { style: styles.section },
    h(Text, { style: styles.sectionTitle }, title),
    ...children,
  );
}

function Bullets(bullets: string[]) {
  return bullets.map((b, i) =>
    h(
      View,
      { style: styles.bullet, key: i },
      h(Text, { style: styles.bulletGlyph }, "•"),
      h(Text, { style: styles.bulletText }, b),
    ),
  );
}

function CvDocument({ cv }: { cv: Cv }) {
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
      h(Text, { style: styles.name }, cv.header.fullName),
      h(Text, { style: styles.headline }, cv.header.headline),
      h(Text, { style: styles.contact }, contactParts.join("  ·  ")),
      // Summary
      ...(cv.summary ? [Section(t.summary, [h(Text, { key: "s" }, cv.summary)])] : []),
      // Skills
      Section(
        t.skills,
        cv.skills.map((group, i) =>
          h(
            Text,
            { style: styles.skillRow, key: i },
            h(Text, { style: { fontFamily: "Helvetica-Bold" } }, `${group.category}: `),
            group.items.join(", "),
          ),
        ),
      ),
      // Experience
      Section(
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
            ...Bullets(exp.bullets),
          ),
        ),
      ),
      // Projects
      ...(cv.projects.length > 0
        ? [
            Section(
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
                  ...Bullets(p.bullets),
                ),
              ),
            ),
          ]
        : []),
      // Education
      ...(cv.education.length > 0
        ? [
            Section(
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
            Section(t.languages, [
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

export async function renderCvPdf(cv: Cv): Promise<Uint8Array<ArrayBuffer>> {
  const buffer = await renderToBuffer(
    h(CvDocument, { cv }) as unknown as React.ReactElement<DocumentProps>,
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
