import type { AtsReport } from "@/agent/lib/ats.ts";
import { db } from "@/agent/lib/db.ts";
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

  const [applications, pdfRows] = await Promise.all([
    db.application.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        language: true,
        status: true,
        createdAt: true,
        atsReport: true,
        cvJson: true,
        jdText: true,
      },
    }),
    // Selecting pdfBytes would pull every PDF into memory just for a badge.
    db.application.findMany({
      where: { userId: user.userId, NOT: { pdfBytes: null } },
      select: { id: true },
    }),
  ]);

  const withPdf = new Set(pdfRows.map((row) => row.id));

  const rows: ApplicationRow[] = applications.map((application) => {
    const report = application.atsReport as AtsReport | null;
    const cv = application.cvJson as { header?: { headline?: string } } | null;
    const jdText = application.jdText ?? "";

    return {
      id: application.id,
      title: titleOf(cv?.header?.headline, jdText),
      jdSnippet: jdText.replace(/\s+/g, " ").slice(0, 180),
      language: application.language,
      status: application.status,
      createdAt: application.createdAt.toLocaleDateString("en", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      score: typeof report?.total === "number" ? report.total : null,
      matched: report?.matched.length ?? 0,
      missing: report?.missing.length ?? 0,
      hasPdf: withPdf.has(application.id),
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
