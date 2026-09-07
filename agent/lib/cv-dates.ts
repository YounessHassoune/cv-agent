import type { Cv } from "./cv-schema.ts";

const ISO_DATE = /^\d{4}-\d{2}(?:-\d{2})?(?:T[\d:.]+Z?)?$/;

/** "2024-11-01T00:00:00.000Z" → "Nov 2024" (localized); anything else untouched. */
export function displayDate(value: string, lang: string): string {
  const trimmed = value.trim();
  if (!ISO_DATE.test(trimmed)) return value;
  const date = new Date(trimmed.length <= 7 ? `${trimmed}-01` : trimmed);
  if (Number.isNaN(date.getTime())) return value;
  const options = { month: "short", year: "numeric", timeZone: "UTC" } as const;
  try {
    return new Intl.DateTimeFormat(lang, options).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", options).format(date);
  }
}

/**
 * The writer sometimes copies the profile's ISO timestamps straight into the
 * display fields, and "2024-11-01T00:00:00.000Z — Present" then lands on the
 * PDF. Normalize once, before validation, so every renderer sees "Nov 2024".
 */
export function withDisplayDates<T extends Cv>(cv: T, lang: string): T {
  return {
    ...cv,
    experiences: cv.experiences.map((e) => ({
      ...e,
      start: displayDate(e.start, lang),
      end: displayDate(e.end, lang),
    })),
    education: cv.education.map((e) => ({
      ...e,
      // "2019-09-01T… – 2022-06-30T…" → each half formatted, joiner kept.
      dates: e.dates
        .split(/(\s*[–—]\s*|\s+-\s+|\s+to\s+)/)
        .map((part) => displayDate(part, lang))
        .join(""),
    })),
  };
}
