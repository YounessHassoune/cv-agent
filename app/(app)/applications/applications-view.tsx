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

const statusTone: Record<string, string> = {
  DRAFT: "bg-secondary text-muted-foreground",
  PENDING_REVIEW: "bg-warning/15 text-warning",
  APPROVED: "bg-success/15 text-success",
  APPLIED: "bg-primary/12 text-primary",
  REJECTED: "bg-destructive/12 text-destructive",
};

const pretty = (status: string) =>
  status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");

/** Green ≥ 85, amber ≥ 70, red below — matches how the review page reads. */
function scoreTone(score: number) {
  if (score >= 85) return { text: "text-success", bar: "bg-success" };
  if (score >= 70) return { text: "text-warning", bar: "bg-warning" };
  return { text: "text-destructive", bar: "bg-destructive" };
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  readonly label: string;
  readonly value: string;
  readonly icon: typeof SparklesIcon;
  readonly accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "surface-card flex flex-col justify-between gap-3 rounded-xl p-5",
        accent && "border-l-4 border-l-primary",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-[0.7rem] text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <Icon className={cn("size-4 shrink-0", accent ? "text-primary" : "text-muted-foreground")} />
      </div>
      <span
        className={cn("font-bold text-3xl tabular-nums tracking-tight", accent && "text-primary")}
      >
        {value}
      </span>
    </div>
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
    <div className="container space-y-6 px-4 py-6 sm:px-6 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-bold text-3xl tracking-tight sm:text-4xl">Applications</h1>
          <p className="text-muted-foreground">Every CV the agent has tailored, newest first.</p>
        </div>
        <Button asChild>
          <Link href="/">
            <SparklesIcon className="size-4" />
            New optimization
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FileCheck2Icon} label="Total optimizations" value={String(stats.total)} />
        <StatCard
          icon={SparklesIcon}
          label="Average ATS score"
          value={stats.averageScore === null ? "—" : `${stats.averageScore}`}
        />
        <StatCard icon={ArrowUpRightIcon} label="Applied" value={String(stats.applied)} />
        <StatCard accent icon={BuildingIcon} label="Active drafts" value={String(stats.active)} />
      </div>

      {applications.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <FileCheck2Icon className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="font-medium">No applications yet</p>
            <p className="text-muted-foreground text-sm">
              Paste a job description in Tailor Chat to generate your first CV.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">Start tailoring</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="relative w-full lg:max-w-96">
              <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-3.5 size-4 text-muted-foreground" />
              <Input
                className="pl-10"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search roles or job descriptions…"
                value={query}
              />
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {statusFilters.map((option) => (
                <button
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-1.5 font-medium text-sm transition-colors",
                    option === status
                      ? "border-border bg-secondary text-foreground"
                      : "bg-card text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
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
                      className="group surface-card flex h-full flex-col gap-4 rounded-xl p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lift"
                      href={`/applications/${application.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1.5">
                          <p className="truncate font-semibold text-lg tracking-tight transition-colors group-hover:text-primary">
                            {application.title}
                          </p>
                          <p className="line-clamp-2 text-muted-foreground text-sm leading-relaxed">
                            {application.jdSnippet}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-1 font-bold text-[0.65rem] uppercase tracking-wider",
                            statusTone[application.status] ?? "bg-secondary text-muted-foreground",
                          )}
                        >
                          {pretty(application.status)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between text-sm">
                          <span className="text-muted-foreground">ATS score</span>
                          <span className={cn("font-bold tabular-nums", tone?.text)}>
                            {application.score === null ? "Not scored" : `${application.score}/100`}
                          </span>
                        </div>
                        <Progress indicatorClassName={tone?.bar} value={application.score ?? 0} />
                      </div>

                      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4 text-muted-foreground text-xs">
                        <span>{application.createdAt}</span>
                        <span aria-hidden="true">·</span>
                        <span className="uppercase">{application.languages.join(" / ")}</span>
                        <span aria-hidden="true">·</span>
                        {application.missing > 0 ? (
                          <span className="rounded-md border bg-field px-2 py-1">
                            {application.missing} keywords missing
                          </span>
                        ) : (
                          <span className="rounded-md border bg-field px-2 py-1">
                            No keyword gaps
                          </span>
                        )}
                        {application.pdfCount > 0 ? (
                          <Badge variant="secondary">
                            {application.pdfCount > 1
                              ? `${application.pdfCount} PDFs ready`
                              : "PDF ready"}
                          </Badge>
                        ) : null}
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
