import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, LightbulbIcon } from "lucide-react";

import type { AtsReport } from "@/agent/lib/ats.ts";
import { db } from "@/agent/lib/db.ts";
import { requireUser } from "@/app/lib/current-user";
import type { CvPreviewData } from "@/components/cv-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { resolveTemplate } from "@/lib/cv-templates";
import { cn } from "@/lib/utils";
import { ReviewPanel } from "./review-panel";
import { StatusActions } from "./status-actions";

export const dynamic = "force-dynamic";

type StoredCv = {
  header?: {
    fullName?: string;
    headline?: string;
    email?: string;
    phone?: string;
    location?: string;
    links?: string[];
  };
  summary?: string;
  skills?: { category: string; items: string[] }[];
  experiences?: CvPreviewData["experiences"];
  projects?: CvPreviewData["projects"];
  education?: CvPreviewData["education"];
  languages?: { name: string; level: string }[];
};

function toPreview(cv: StoredCv | null): CvPreviewData | null {
  if (!cv?.header?.fullName) return null;
  return {
    fullName: cv.header.fullName,
    headline: cv.header.headline,
    email: cv.header.email,
    phone: cv.header.phone,
    location: cv.header.location,
    links: cv.header.links,
    summary: cv.summary,
    skills: cv.skills,
    experiences: cv.experiences,
    projects: cv.projects,
    education: cv.education,
    languages: cv.languages,
  };
}

function scoreTone(score: number) {
  if (score >= 85) return { text: "text-success", bar: "bg-success" };
  if (score >= 70) return { text: "text-warning", bar: "bg-warning" };
  return { text: "text-destructive", bar: "bg-destructive" };
}

function ScoreBar({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number | null;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{value === null ? "n/a" : value}</span>
      </div>
      <Progress value={value ?? 0} />
    </div>
  );
}

export default async function ApplicationPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const application = await db.application.findFirst({
    where: { id, userId: user.userId },
    select: {
      id: true,
      language: true,
      status: true,
      template: true,
      createdAt: true,
      updatedAt: true,
      jdText: true,
      atsReport: true,
      cvJson: true,
    },
  });
  if (!application) notFound();

  const [pdfRow] = await db.application.findMany({
    where: { id, NOT: { pdfBytes: null } },
    select: { id: true },
  });
  const hasPdf = Boolean(pdfRow);

  const report = application.atsReport as AtsReport | null;
  const cv = toPreview(application.cvJson as StoredCv | null);
  const title = cv?.headline ?? "Untitled draft";
  const tone = report ? scoreTone(report.total) : null;

  return (
    <div className="mx-auto flex w-full max-w-440 flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="space-y-4">
        <Button asChild className="-ml-2 text-muted-foreground" size="sm" variant="ghost">
          <Link href="/applications">
            <ArrowLeftIcon className="size-3.5" />
            All applications
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-medium text-2xl tracking-tight">{title}</h1>
              <Badge variant="secondary">{application.status.replace(/_/g, " ")}</Badge>
            </div>
            <p className="text-muted-foreground text-xs">
              Created {application.createdAt.toLocaleString()} ·{" "}
              {application.language.toUpperCase()} · {resolveTemplate(application.template).label}{" "}
              template
            </p>
          </div>

          <StatusActions applicationId={application.id} hasPdf={hasPdf} status={application.status} />
        </div>
      </div>

      <div className="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Left: ATS insight and the job description it was scored against. */}
        <div className="scrollbar-slim space-y-4 xl:max-h-[calc(100dvh-14rem)] xl:overflow-y-auto xl:pr-1">
          {report ? (
            <section className="surface-card space-y-5 rounded-xl p-5">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-muted-foreground text-xs">ATS match</p>
                  <p className="flex items-baseline gap-1.5">
                    <span className={cn("font-medium text-4xl tabular-nums", tone?.text)}>
                      {report.total}
                    </span>
                    <span className="text-muted-foreground text-sm">/ 100</span>
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  <Badge variant="secondary">{report.matched.length} matched</Badge>
                  <Badge variant="outline">{report.missing.length} missing</Badge>
                </div>
              </div>

              <div className="space-y-3">
                <ScoreBar label="Keywords (40%)" value={report.breakdown.keyword} />
                <ScoreBar label="Semantic relevance (40%)" value={report.breakdown.semantic} />
                <ScoreBar label="Structure & metrics (20%)" value={report.breakdown.structure} />
              </div>

              {report.missing.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-medium text-xs">Missing keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {report.missing.map((term) => (
                      <span
                        className="rounded-full border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-xs"
                        key={term}
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {report.matched.length > 0 ? (
                <div className="space-y-2">
                  <p className="font-medium text-xs">Matched keywords</p>
                  <div className="flex flex-wrap gap-1.5">
                    {report.matched.map((term) => (
                      <span
                        className="rounded-full bg-success/10 px-2.5 py-1 text-success text-xs"
                        key={term}
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {report.suggestions.length > 0 ? (
                <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
                  <p className="flex items-center gap-2 font-medium text-xs">
                    <LightbulbIcon className="size-3.5 text-warning" />
                    Suggestions
                  </p>
                  <ul className="space-y-1.5 text-muted-foreground text-xs leading-relaxed">
                    {report.suggestions.map((suggestion) => (
                      <li className="flex gap-2" key={suggestion}>
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : (
            <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
              No ATS score recorded for this draft yet.
            </p>
          )}

          <section className="surface-card space-y-3 rounded-xl p-5">
            <h2 className="font-medium text-sm">Job description</h2>
            <pre className="scrollbar-slim max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-sans text-muted-foreground text-xs leading-relaxed">
              {application.jdText}
            </pre>
          </section>
        </div>

        {/* Right: the document itself, plus the chat scoped to this application. */}
        <div className="min-h-0 xl:sticky xl:top-4 xl:h-[calc(100dvh-14rem)]">
          <ReviewPanel
            applicationId={application.id}
            cv={cv}
            hasPdf={hasPdf}
            template={application.template}
            title={title}
          />
        </div>
      </div>
    </div>
  );
}
