import type { AtsReport } from "@/agent/lib/ats.ts";
import { db } from "@/agent/lib/db.ts";
import { readVariants } from "@/agent/lib/variants.ts";
import { requireUser } from "@/app/lib/current-user";
import { type ApplicationRow, ApplicationsView } from "./applications-view";

export const dynamic = "force-dynamic";

/** Falls back to the first meaningful line of the JD when no CV exists yet. */
function titleOf(headline: string | undefined, jdText: string): string {
  if (headline) return headline;
  const firstLine = jdText.split("\n").map((line) => line.trim()).find(Boolean);
  if (!firstLine) return "Untitled draft";
  return firstLine.length > 70 ? `${firstLine.slice(0, 70)}…` : firstLine;
}

export default async function ApplicationsPage() {
  const user = await requireUser();

  const applications = await db.application.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      languages: true,
      status: true,
      createdAt: true,
      variants: true,
      jdText: true,
      // Only the languages — never the bytes — for the PDF badge.
      pdfs: { select: { language: true } },
    },
  });

  const rows: ApplicationRow[] = applications.map((application) => {
    const variants = readVariants(application.variants);
    const reports = Object.values(variants)
      .map((variant) => variant.atsReport as AtsReport | null)
      .filter((report): report is AtsReport => typeof report?.total === "number");
    // The card shows the strongest variant; the detail page breaks it down.
    const best = reports.reduce<AtsReport | null>(
      (top, report) => (top === null || report.total > top.total ? report : top),
      null,
    );
    const headline = Object.values(variants)
      .map((variant) => (variant.cvJson as { header?: { headline?: string } } | null)?.header?.headline)
      .find(Boolean);
    const jdText = application.jdText ?? "";

    return {
      id: application.id,
      title: titleOf(headline, jdText),
      jdSnippet: jdText.replace(/\s+/g, " ").slice(0, 180),
      languages: application.languages,
      status: application.status,
      createdAt: application.createdAt.toLocaleDateString("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      score: best?.total ?? null,
      matched: best?.matched.length ?? 0,
      missing: best?.missing.length ?? 0,
      pdfCount: application.pdfs.length,
    };
  });

  const scored = rows.filter((row) => row.score !== null);
  const stats = {
    total: rows.length,
    averageScore:
      scored.length === 0
        ? null
        : Math.round(scored.reduce((sum, row) => sum + (row.score ?? 0), 0) / scored.length),
    applied: rows.filter((row) => row.status === "APPLIED").length,
    active: rows.filter((row) => row.status === "DRAFT" || row.status === "PENDING_REVIEW").length,
  };

  return <ApplicationsView applications={rows} stats={stats} />;
}
