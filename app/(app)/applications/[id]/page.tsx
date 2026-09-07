import Link from "next/link";
import { notFound } from "next/navigation";
import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import { ArrowLeftIcon } from "lucide-react";

import { readReport } from "@/agent/lib/ats.ts";
import { db } from "@/agent/lib/db.ts";
import { readVariants } from "@/agent/lib/variants.ts";
import { requireUser } from "@/app/lib/current-user";
import type { CvPreviewData } from "@/components/cv-preview";
import { Button } from "@/components/ui/button";
import { resolveTemplate } from "@/lib/cv-templates";
import { cn } from "@/lib/utils";
import { type VariantView, ApplicationWorkspace } from "./application-workspace";
import { StatusActions } from "./status-actions";

export const dynamic = "force-dynamic";

type StoredCv = {
  language?: string;
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

/**
 * The photo is not part of the tailored CV — it lives on the master profile and
 * is a preview-only device either way — so it is threaded in here rather than
 * stored per variant.
 */
function toPreview(cv: StoredCv | null, photoUrl?: string): CvPreviewData | null {
  if (!cv?.header?.fullName) return null;
  return {
    photoUrl,
    fullName: cv.header.fullName,
    headline: cv.header.headline,
    language: cv.language,
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

const statusTone: Record<string, string> = {
  DRAFT: "bg-secondary text-muted-foreground",
  PENDING_REVIEW: "bg-warning/15 text-warning",
  APPROVED: "bg-success/15 text-success",
  APPLIED: "bg-primary/12 text-primary",
  REJECTED: "bg-destructive/12 text-destructive",
};

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
      languages: true,
      status: true,
      template: true,
      createdAt: true,
      updatedAt: true,
      jdText: true,
      variants: true,
      chatEvents: true,
      chatSession: true,
      // Only the languages — never the bytes — for the PDF badges.
      pdfs: { select: { language: true } },
    },
  });
  if (!application) notFound();

  // Preview-only, and the same photo for every variant.
  const profile = await db.profile.findUnique({
    where: { userId: user.userId },
    select: { photoUrl: true },
  });

  const withPdf = new Set(application.pdfs.map((pdf) => pdf.language));
  const stored = readVariants(application.variants);

  // Target languages first (in requested order), then any stray variant keys.
  const orderedLanguages = [
    ...application.languages,
    ...Object.keys(stored).filter((lang) => !application.languages.includes(lang)),
  ];
  const variants: VariantView[] = orderedLanguages.map((language) => {
    const variant = stored[language];
    return {
      language,
      cv: toPreview(
        (variant?.cvJson as StoredCv | undefined) ?? null,
        profile?.photoUrl ?? undefined,
      ),
      report: readReport(variant?.atsReport),
      template: variant?.template ?? application.template,
      hasPdf: withPdf.has(language),
      compiledAt: variant?.updatedAt ?? null,
      unsupported: variant?.unsupported ?? [],
    };
  });

  const title = variants.find((v) => v.cv?.headline)?.cv?.headline ?? "Untitled draft";

  return (
    <div className="container flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10">
      <div className="space-y-4">
        <Button asChild className="-ml-2 text-muted-foreground" size="sm" variant="ghost">
          <Link href="/applications">
            <ArrowLeftIcon className="size-3.5" />
            All applications
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-bold text-2xl tracking-tight">{title}</h1>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 font-bold text-[0.65rem] uppercase tracking-wider",
                  statusTone[application.status] ?? "bg-secondary text-muted-foreground",
                )}
              >
                {application.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              Created {application.createdAt.toLocaleString()} ·{" "}
              {application.languages.map((lang) => lang.toUpperCase()).join(" / ")} ·{" "}
              {resolveTemplate(application.template).label} template
            </p>
          </div>

          <StatusActions
            applicationId={application.id}
            pdfLanguages={application.languages.filter((lang) => withPdf.has(lang))}
            status={application.status}
          />
        </div>
      </div>

      <ApplicationWorkspace
        applicationId={application.id}
        chatEvents={(application.chatEvents as MessageStreamEvent[] | null) ?? undefined}
        chatSession={(application.chatSession as ClientSessionState | null) ?? undefined}
        jdText={application.jdText}
        title={title}
        variants={variants}
      />
    </div>
  );
}
