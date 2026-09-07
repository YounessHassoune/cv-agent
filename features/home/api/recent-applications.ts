import { type AtsReport, readReport } from "@/agent/lib/ats.ts";
import { db } from "@/agent/lib/db.ts";
import { readVariants } from "@/agent/lib/variants.ts";
import { requireUser } from "@/app/lib/current-user";

/** How many drafts the home page offers to pick back up. */
const RECENT_LIMIT = 4;

export type RecentApplication = {
  readonly id: string;
  readonly title: string;
  readonly score: number | null;
};

/** Falls back to the first meaningful line of the JD when no CV exists yet. */
function titleOf(headline: string | undefined, jdText: string): string {
  if (headline) return headline;
  const firstLine = jdText.split("\n").map((line) => line.trim()).find(Boolean);
  return firstLine ? firstLine.slice(0, 60) : "Untitled draft";
}

export async function readRecentApplications(): Promise<RecentApplication[]> {
  const user = await requireUser();

  const applications = await db.application.findMany({
    where: { userId: user.userId },
    orderBy: { updatedAt: "desc" },
    take: RECENT_LIMIT,
    select: { id: true, jdText: true, status: true, variants: true },
  });

  return applications.map((application) => {
    const variants = readVariants(application.variants);
    const reports = Object.values(variants)
      .map((variant) => readReport(variant.atsReport))
      .filter((report): report is AtsReport => report !== null);
    const best = reports.reduce<number | null>(
      (top, report) => (top === null || report.total > top ? report.total : top),
      null,
    );
    const headline = Object.values(variants)
      .map(
        (variant) => (variant.cvJson as { header?: { headline?: string } } | null)?.header?.headline,
      )
      .find(Boolean);

    return {
      id: application.id,
      title: titleOf(headline, application.jdText ?? ""),
      score: best,
    };
  });
}
