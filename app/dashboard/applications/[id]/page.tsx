import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { readReport } from "@/agent/lib/ats.ts";
import { userCan } from "@/agent/lib/billing.ts";
import { db } from "@/agent/lib/db.ts";
import { readVariants } from "@/agent/lib/variants.ts";
import { requireUser } from "@/app/lib/current-user";
import type { CvPreviewData } from "@/components/cv-preview";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApplicationWorkspace, type VariantView } from "./application-workspace";
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

/** Same tones as the applications list, so a status reads identically in both. */
const statusTone: Record<string, string> = {
  DRAFT: "bg-secondary text-muted-foreground",
  PENDING_REVIEW: "bg-warning/15 text-warning",
  APPROVED: "bg-success/15 text-success",
  APPLIED: "bg-foreground text-background",
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
      theme: true,
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

  /*
   * The gate is here, not in the panel that draws it. Blurring a number that
   * is sitting in the page source is a decoration, not a lock — on a plan
   * without the score, the score never leaves the server.
   */
  const showScore = await userCan(user.userId, "atsScore");

  const withPdf = new Set(application.pdfs.map((pdf) => pdf.language));
  const stored = readVariants(application.variants);

  // Target languages first (in requested order), then any stray variant keys.
  const orderedLanguages = [
    ...application.languages,
    ...Object.keys(stored).filter((lang) => !application.languages.includes(lang)),
  ];
  const variants: VariantView[] = orderedLanguages.map((language) => {
    const variant = stored[language];
    const report = readReport(variant?.atsReport);
    return {
      language,
      cv: toPreview(
        (variant?.cvJson as StoredCv | undefined) ?? null,
        profile?.photoUrl ?? undefined,
      ),
      /*
       * Two payloads rather than one redacted object. The total is the user's
       * own number and always travels; the keyword lists and suggestions — the
       * part that says what to *change* — only travel when the plan includes
       * them. Mangling one `AtsReport` into a half-empty copy would put the
       * lie inside the type instead.
       */
      report: showScore ? report : null,
      score:
        report === null
          ? null
          : {
              total: report.total,
              ceiling: report.ceiling,
              gate: report.gate,
              missingMustHaveCount: report.missingMustHaves.length,
            },
      template: variant?.template ?? application.template,
      theme: variant?.theme ?? application.theme,
      hasPdf: withPdf.has(language),
      compiledAt: variant?.updatedAt ?? null,
      unsupported: variant?.unsupported ?? [],
    };
  });

  const title = variants.find((v) => v.cv?.headline)?.cv?.headline ?? "Untitled draft";

  return (
    /* The workspace fills the viewport instead of the page scrolling: the
       document and the rail each scroll on their own, so neither the CV nor the
       score report ever scrolls out from under the other. */
    <div className="container flex h-full min-h-0 flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <Link
          aria-label="All applications"
          className={cn(
            buttonVariants({ size: "icon-sm", variant: "ghost" }),
            "-ml-1 shrink-0 text-muted-foreground",
          )}
          href="/dashboard/applications"
        >
          <ArrowLeftIcon className="size-4" />
        </Link>

        <h1 className="min-w-0 flex-1 truncate font-semibold text-lg tracking-tight">{title}</h1>

        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 font-medium text-xs",
            statusTone[application.status] ?? "bg-secondary text-muted-foreground",
          )}
        >
          {application.status.charAt(0) +
            application.status.slice(1).toLowerCase().replace(/_/g, " ")}
        </span>

        <StatusActions
          applicationId={application.id}
          pdfLanguages={application.languages.filter((lang) => withPdf.has(lang))}
          status={application.status}
        />
      </header>

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
