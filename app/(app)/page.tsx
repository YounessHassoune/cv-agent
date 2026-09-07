import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { type AtsReport, readReport } from "@/agent/lib/ats.ts";
import { db } from "@/agent/lib/db.ts";
import { readVariants } from "@/agent/lib/variants.ts";
import { AgentChat } from "@/app/(app)/_components/agent-chat";
import { requireUser } from "@/app/lib/current-user";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function scoreTone(score: number): string {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-destructive";
}

/**
 * Landing on a bare prompt gave no sense of where you were or what was already
 * in flight. The composer is still the point of the page, but what you were
 * last working on now sits under it, one click from being picked back up.
 */
async function RecentWork() {
  const user = await requireUser();

  const applications = await db.application.findMany({
    where: { userId: user.userId },
    orderBy: { updatedAt: "desc" },
    take: 4,
    select: { id: true, jdText: true, status: true, variants: true },
  });

  if (applications.length === 0) return null;

  const rows = applications.map((application) => {
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
    const firstLine = (application.jdText ?? "")
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean);

    return {
      id: application.id,
      title: headline ?? (firstLine ? firstLine.slice(0, 60) : "Untitled draft"),
      score: best,
    };
  });

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-medium text-muted-foreground text-xs">Pick up where you left off</h2>
        <Link
          className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
          href="/applications"
        >
          All applications
          <ArrowRightIcon className="size-3" />
        </Link>
      </div>

      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary"
              href={`/applications/${row.id}`}
            >
              <span className="min-w-0 flex-1 truncate text-sm">{row.title}</span>
              <span
                className={cn(
                  "shrink-0 font-semibold text-sm tabular-nums",
                  row.score === null ? "text-muted-foreground" : scoreTone(row.score),
                )}
              >
                {row.score === null ? "-" : row.score}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Page() {
  return (
    <AgentChat
      footer={<RecentWork />}
      heading="Tailor a CV"
      subheading="Paste a job description and say which language(s) you want the CV in. One application covers them all, and your master profile is the only source of facts."
      suggestions={[
        "Tailor my CV to this job description",
        "Tailor my CV in English and French",
        "Which keywords am I missing for this role?",
        "Score my last draft against the JD",
      ]}
    />
  );
}
