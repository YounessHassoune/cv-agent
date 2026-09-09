"use client";

import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import { useState } from "react";

import type { AtsReport } from "@/agent/lib/ats.ts";
import type { CvPreviewData } from "@/components/cv-preview";
import { DEFAULT_TEMPLATE, DEFAULT_THEME } from "@/lib/cv-templates";
import { cn } from "@/lib/utils";
import { DocumentPanel } from "./document-panel";
import { ReviewPanel } from "./review-panel";

/** One language variant, serialized by the server page. */
export type VariantView = {
  language: string;
  cv: CvPreviewData | null;
  report: AtsReport | null;
  template: string;
  theme: string;
  hasPdf: boolean;
  /**
   * When this variant was last compiled. Rides in the PDF URL as a cache
   * buster: the path is otherwise identical after a recompile, so the browser
   * would keep serving the old document and the iframe would never even
   * remount.
   */
  compiledAt: string | null;
  /** Skills the CV claims that the profile does not list. The user's call. */
  unsupported: string[];
};

function scoreTone(score: number): string {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-destructive";
}

/**
 * The workspace is now one document plus one rail, rather than two competing
 * columns of dense reading. Previously the ATS report took a full column of its
 * own and the CV was one of three tabs sharing the other, so the document, the
 * report and the conversation were all fighting for the same attention and you
 * could never see the CV and ask for a change to it at the same time.
 *
 * The CV holds the main column and never moves. Everything that talks *about*
 * the CV lives in the rail beside it.
 */
export function ApplicationWorkspace({
  applicationId,
  title,
  jdText,
  variants,
  chatEvents,
  chatSession,
}: {
  readonly applicationId: string;
  readonly title: string;
  readonly jdText: string;
  readonly variants: VariantView[];
  readonly chatEvents?: readonly MessageStreamEvent[];
  readonly chatSession?: ClientSessionState;
}) {
  const [language, setLanguage] = useState(variants[0]?.language);
  const selected = variants.find((variant) => variant.language === language) ?? variants[0];

  // Template is a presentation choice, so it lives here rather than costing a
  // recompile: the preview restyles instantly and the PDF route re-renders from
  // the stored CV JSON. Overrides are keyed by language so switching variants
  // still falls back to whichever template that one was compiled with.
  const [templateByLanguage, setTemplateByLanguage] = useState<Record<string, string>>({});
  const [themeByLanguage, setThemeByLanguage] = useState<Record<string, string>>({});
  const template =
    (selected ? templateByLanguage[selected.language] : undefined) ??
    selected?.template ??
    DEFAULT_TEMPLATE;
  const theme =
    (selected ? themeByLanguage[selected.language] : undefined) ?? selected?.theme ?? DEFAULT_THEME;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Language is a property of which document you are looking at, so it sits
          on the document rather than above the whole page. */}
      {variants.length > 1 ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <span className="mr-1 text-muted-foreground text-xs">Variant</span>
          {variants.map((variant) => (
            <button
              aria-pressed={variant.language === selected?.language}
              className={cn(
                "rounded-full border px-3 py-1 font-medium text-sm uppercase transition-colors",
                variant.language === selected?.language
                  ? "border-transparent bg-accent text-foreground"
                  : "border-transparent bg-secondary text-muted-foreground hover:text-foreground",
              )}
              key={variant.language}
              onClick={() => setLanguage(variant.language)}
              type="button"
            >
              {variant.language}
              {variant.report ? (
                <span
                  className={cn(
                    "ml-1.5 font-semibold tabular-nums",
                    scoreTone(variant.report.total),
                  )}
                >
                  {variant.report.total}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {/* Below xl the rail drops under the document rather than shrinking beside
          it: a 400px rail and a full CV do not both fit on a laptop half-width. */}
      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="min-h-0 min-w-0 max-xl:h-[70dvh]">
          <DocumentPanel
            applicationId={applicationId}
            compiledAt={selected?.compiledAt ?? null}
            cv={selected?.cv ?? null}
            hasPdf={selected?.hasPdf ?? false}
            language={selected?.language}
            onTemplateChange={(next) => {
              if (selected) {
                setTemplateByLanguage((current) => ({ ...current, [selected.language]: next }));
              }
            }}
            onThemeChange={(next) => {
              if (selected) {
                setThemeByLanguage((current) => ({ ...current, [selected.language]: next }));
              }
            }}
            template={template}
            theme={theme}
            title={title}
          />
        </div>

        <div className="min-h-0 max-xl:h-[60dvh]">
          <ReviewPanel
            applicationId={applicationId}
            chatEvents={chatEvents}
            chatSession={chatSession}
            jdText={jdText}
            language={selected?.language}
            report={selected?.report ?? null}
            title={title}
            unsupported={selected?.unsupported ?? []}
          />
        </div>
      </div>
    </div>
  );
}
