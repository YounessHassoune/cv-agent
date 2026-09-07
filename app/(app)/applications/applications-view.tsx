"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRightIcon,
  BuildingIcon,
  FileCheck2Icon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type ApplicationRow = {
  id: string;
  title: string;
  jdSnippet: string;
  /** Target languages of this application (one card per job, not per language). */
  languages: string[];
  status: string;
  createdAt: string;
  /** Best score across the language variants. */
  score: number | null;
  matched: number;
  missing: number;
  /** How many language variants have a compiled PDF. */
  pdfCount: number;
};

const statusFilters = ["All", "DRAFT", "PENDING_REVIEW", "APPROVED", "APPLIED", "REJECTED"];

/**
 * Colour here means outcome, not decoration: amber is waiting on you, green is
 * cleared, red is dead. The two neutral states are separated by weight rather
 * than hue, so the coloured ones stay the things that catch the eye.
 */
const statusTone: Record<string, string> = {
  DRAFT: "bg-secondary text-muted-foreground",
  PENDING_REVIEW: "bg-warning/15 text-warning",
  APPROVED: "bg-success/15 text-success",
  APPLIED: "bg-foreground text-background",
  REJECTED: "bg-destructive/12 text-destructive",
};

const pretty = (status: string) =>
  status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");

/** Green at 85 and up, amber at 70 and up, red below. Matches the review page. */
function scoreTone(score: number) {
  if (score >= 85) return { text: "text-success", bar: "bg-success" };
  if (score >= 70) return { text: "text-warning", bar: "bg-warning" };
  return { text: "text-destructive", bar: "bg-destructive" };
}

/**
 * One bordered strip with divided cells rather than four floating cards: these
 * are four readings of the same thing, so they belong in one object. Cards here
 * would claim four separate pieces of hierarchy that do not exist.
 */
function StatStrip({
  stats,
}: {
  readonly stats: { total: number; averageScore: number | null; applied: number; active: number };
}) {
  const cells = [
    { label: "Optimizations", value: String(stats.total), icon: FileCheck2Icon, tone: "" },
    {
      label: "Average ATS",
      value: stats.averageScore === null ? "-" : String(stats.averageScore),
      icon: SparklesIcon,
      // The one coloured number in the strip, and it is coloured by what it
      // means rather than by brand.
      tone: stats.averageScore === null ? "" : scoreTone(stats.averageScore).text,
    },
    { label: "Applied", value: String(stats.applied), icon: ArrowUpRightIcon, tone: "" },
    { label: "Active drafts", value: String(stats.active), icon: BuildingIcon, tone: "" },
  ];

  return (
    <dl className="surface-card grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
      {cells.map((cell) => (
        <div className="flex flex-col gap-2 bg-card p-5" key={cell.label}>
          <dt className="flex items-center gap-2 text-muted-foreground text-xs">
            <cell.icon className="size-3.5 shrink-0" />
            {cell.label}
          </dt>
          <dd className={cn("font-semibold text-2xl tabular-nums tracking-tight", cell.tone)}>
            {cell.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ApplicationsView({
  applications,
  stats,
}: {
  readonly applications: ApplicationRow[];
  readonly stats: { total: number; averageScore: number | null; applied: number; active: number };
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return applications.filter((application) => {
      const matchesStatus = status === "All" || application.status === status;
      const matchesQuery =
        needle.length === 0 ||
        application.title.toLowerCase().includes(needle) ||
        application.jdSnippet.toLowerCase().includes(needle);
      return matchesStatus && matchesQuery;
    });
  }, [applications, query, status]);

  return (
    <div className="container space-y-6 px-4 py-8 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-semibold text-2xl tracking-tight">Applications</h1>
          <p className="text-muted-foreground text-sm">
            Every CV the agent has tailored, newest first.
          </p>
        </div>
        <Button render={<Link href="/" />}>
          <SparklesIcon className="size-4" />
          New optimization
        </Button>
      </div>

      <StatStrip stats={stats} />

      {applications.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <FileCheck2Icon className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="font-medium">No applications yet</p>
            <p className="max-w-sm text-muted-foreground text-sm leading-relaxed">
              Paste a job description in the chat and the agent tailors your first CV from your
              master profile.
            </p>
          </div>
          <Button render={<Link href="/" />} variant="outline">
            Start tailoring
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-80">
              <SearchIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3.5 size-4 text-muted-foreground" />
              <Input
                aria-label="Search applications"
                className="pl-10"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search roles or job descriptions"
                value={query}
              />
            </div>
            <div className="scrollbar-slim flex gap-1.5 overflow-x-auto pb-1 lg:justify-end lg:pb-0">
              {statusFilters.map((option) => (
                <button
                  aria-pressed={option === status}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 font-medium text-sm transition-colors",
                    option === status
                      ? "border-transparent bg-accent text-foreground"
                      : "border-transparent bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                  key={option}
                  onClick={() => setStatus(option)}
                  type="button"
                >
                  {option === "All" ? "All" : pretty(option)}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
              Nothing matches that search.
            </p>
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {visible.map((application) => {
                const tone = application.score === null ? null : scoreTone(application.score);
                return (
                  <li key={application.id}>
                    <Link
                      className="surface-card flex h-full flex-col gap-4 rounded-xl p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lift"
                      href={`/applications/${application.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1.5">
                          <p className="truncate font-semibold tracking-tight">
                            {application.title}
                          </p>
                          <p className="line-clamp-2 text-muted-foreground text-sm leading-relaxed">
                            {application.jdSnippet}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 font-medium text-xs",
                            statusTone[application.status] ?? "bg-secondary text-muted-foreground",
                          )}
                        >
                          {pretty(application.status)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="text-muted-foreground">ATS score</span>
                          <span className={cn("font-semibold tabular-nums", tone?.text)}>
                            {application.score === null ? "Not scored" : `${application.score}/100`}
                          </span>
                        </div>
                        <Progress indicatorClassName={tone?.bar} value={application.score ?? 0} />
                      </div>

                      {/* Two aligned columns rather than a run of dot-separated
                          fragments: the date and language belong together, the
                          keyword state and PDF state are the actionable half. */}
                      <div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 border-t pt-4 text-muted-foreground text-xs">
                        <span className="truncate">{application.createdAt}</span>
                        <span className="truncate text-right uppercase">
                          {application.languages.join(" / ")}
                        </span>
                        <span className="truncate">
                          {application.missing > 0
                            ? `${application.missing} keywords missing`
                            : "No keyword gaps"}
                        </span>
                        <span className="flex justify-end">
                          {application.pdfCount > 0 ? (
                            <Badge variant="secondary">
                              {application.pdfCount > 1
                                ? `${application.pdfCount} PDFs ready`
                                : "PDF ready"}
                            </Badge>
                          ) : null}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
