import Link from "next/link";
import { db } from "@/agent/lib/db.ts";
import { requireUser } from "@/app/lib/current-user";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ApplicationsPage() {
  const user = await requireUser();
  const applications = await db.application.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      language: true,
      status: true,
      createdAt: true,
      atsReport: true,
      cvJson: true,
    },
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-medium text-2xl tracking-tight">Applications</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Every CV the agent has generated, newest first.
        </p>
      </div>

      {applications.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
          Nothing yet. Paste a job description on the <Link className="underline" href="/">Tailor</Link> page to
          generate your first CV.
        </p>
      ) : (
        <ul className="space-y-2">
          {applications.map((application) => {
            const report = application.atsReport as { total?: number } | null;
            const cv = application.cvJson as { header?: { headline?: string } } | null;
            return (
              <li key={application.id}>
                <Link
                  className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent"
                  href={`/applications/${application.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">
                      {cv?.header?.headline ?? "Untitled draft"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {application.createdAt.toLocaleString()} · {application.language.toUpperCase()}
                    </p>
                  </div>
                  {typeof report?.total === "number" ? (
                    <span className="font-mono text-sm tabular-nums">{report.total}</span>
                  ) : null}
                  <Badge variant="secondary">{application.status.replace("_", " ")}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
