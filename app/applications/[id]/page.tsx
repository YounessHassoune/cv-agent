import { notFound } from "next/navigation";
import type { AtsReport } from "@/agent/lib/ats.ts";
import { db } from "@/agent/lib/db.ts";
import { requireUser } from "@/app/lib/current-user";
import { Badge } from "@/components/ui/badge";
import { StatusActions } from "./status-actions";

export const dynamic = "force-dynamic";

function ScoreBar({ label, value }: { readonly label: string; readonly value: number | null }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">{value === null ? "n/a" : value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/70"
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
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
  });
  if (!application) notFound();

  const report = application.atsReport as AtsReport | null;
  const hasPdf = application.pdfBytes !== null;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-medium text-xl tracking-tight">Review</h1>
            <p className="mt-1 text-muted-foreground text-xs">
              {application.createdAt.toLocaleString()} · {application.language.toUpperCase()}
            </p>
          </div>
          <Badge variant="secondary">{application.status.replace("_", " ")}</Badge>
        </div>

        <StatusActions applicationId={application.id} status={application.status} />

        {report ? (
          <section className="space-y-4 rounded-lg border p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-3xl tabular-nums">{report.total}</span>
              <span className="text-muted-foreground text-sm">/ 100 ATS match</span>
            </div>
            <div className="space-y-3">
              <ScoreBar label="Keywords (40%)" value={report.breakdown.keyword} />
              <ScoreBar label="Semantic relevance (40%)" value={report.breakdown.semantic} />
              <ScoreBar label="Structure & metrics (20%)" value={report.breakdown.structure} />
            </div>

            {report.missing.length > 0 ? (
              <div>
                <p className="mb-2 font-medium text-xs">Missing keywords</p>
                <div className="flex flex-wrap gap-1">
                  {report.missing.map((term) => (
                    <Badge key={term} variant="outline">
                      {term}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {report.matched.length > 0 ? (
              <div>
                <p className="mb-2 font-medium text-xs">Matched keywords</p>
                <div className="flex flex-wrap gap-1">
                  {report.matched.map((term) => (
                    <Badge key={term} variant="secondary">
                      {term}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {report.suggestions.length > 0 ? (
              <div>
                <p className="mb-1 font-medium text-xs">Suggestions</p>
                <ul className="list-disc space-y-1 pl-4 text-muted-foreground text-xs">
                  {report.suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
            No ATS score recorded for this draft yet.
          </p>
        )}

        <section className="space-y-2">
          <h2 className="font-medium text-sm">Job description</h2>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-xs">
            {application.jdText}
          </pre>
        </section>
      </div>

      <div className="lg:sticky lg:top-6 lg:h-[calc(100dvh-8rem)]">
        {hasPdf ? (
          <iframe
            className="h-[70vh] w-full rounded-lg border lg:h-full"
            src={`/api/applications/${application.id}/pdf`}
            title="Generated CV preview"
          />
        ) : (
          <div className="flex h-full min-h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
            No PDF compiled yet.
          </div>
        )}
      </div>
    </div>
  );
}
