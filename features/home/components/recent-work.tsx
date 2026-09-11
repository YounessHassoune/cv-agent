import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { readRecentApplications } from "../api/recent-applications";

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
export async function RecentWork() {
  const rows = await readRecentApplications();

  if (rows.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h2 className="font-medium text-muted-foreground text-xs">Pick up where you left off</h2>
        <Link
          className="flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
          href="/dashboard/applications"
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
