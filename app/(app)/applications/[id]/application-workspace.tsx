"use client";

import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import { LightbulbIcon } from "lucide-react";
import { useState } from "react";

import type { AtsReport } from "@/agent/lib/ats.ts";
import type { CvPreviewData } from "@/components/cv-preview";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ReviewPanel } from "./review-panel";

/** One language variant, serialized by the server page. */
export type VariantView = {
  language: string;
  cv: CvPreviewData | null;
  report: AtsReport | null;
  template: string;
  hasPdf: boolean;
};

function ScoreBar({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value === null ? "n/a" : value}</span>
      </div>
      <Progress className="h-2" value={value ?? 0} />
    </div>
  );
}

/**
 * Everything below the application header: the per-language ATS insight on the
 * left and the Preview/PDF/Chat panel on the right, sharing one language
 * selection. The chat is application-scoped, so it stays mounted across
 * language switches.
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
  const report = selected?.report ?? null;

  // Template is a presentation choice, so it lives here rather than costing a
  // recompile: the preview restyles instantly and the PDF route re-renders from
  // the stored CV JSON. Overrides are keyed by language so switching variants
  // still falls back to whichever template that one was compiled with.
  const [templateByLanguage, setTemplateByLanguage] = useState<Record<string, string>>({});
  const template =
    (selected ? templateByLanguage[selected.language] : undefined) ??
    selected?.template ??
    "modern";

  return (
    <div className="space-y-4">
      {variants.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => (
            <button
              className={cn(
                "rounded-full border px-4 py-1.5 font-semibold text-sm uppercase transition-colors",
                variant.language === selected?.language
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "bg-card text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
              key={variant.language}
              onClick={() => setLanguage(variant.language)}
              type="button"
            >
              {variant.language}
              {variant.report ? (
                <span className="ml-1.5 font-bold tabular-nums">{variant.report.total}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid min-h-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Left: ATS insight for the selected language, and the job description. */}
        <div className="scrollbar-slim space-y-6 xl:max-h-[calc(100dvh-14rem)] xl:overflow-y-auto xl:pr-1">
          {report ? (
            <>
              <section className="surface-card space-y-6 rounded-xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">
                      ATS match{" "}
                      <span className="text-muted-foreground uppercase">
                        · {selected?.language}
                      </span>
                    </p>
                    <p className="flex items-baseline gap-1.5">
                      <span className="font-bold text-4xl text-primary tracking-tighter">
                        {report.total}
                      </span>
                      <span className="text-muted-foreground text-sm">/ 100</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full border bg-field px-2.5 py-1 font-medium text-xs">
                      {report.matched.length} matched
                    </span>
                    <span className="rounded-full border bg-field px-2.5 py-1 font-medium text-xs">
                      {report.missing.length} missing
                    </span>
                  </div>
                </div>

                <div className="space-y-5">
                  <ScoreBar label="Keywords (40%)" value={report.breakdown.keyword} />
                  <ScoreBar label="Semantic relevance (40%)" value={report.breakdown.semantic} />
                  <ScoreBar label="Structure & metrics (20%)" value={report.breakdown.structure} />
                </div>
              </section>

              {report.missing.length + report.matched.length + report.suggestions.length > 0 ? (
                <section className="surface-card space-y-6 rounded-xl p-6">
                  {report.missing.length > 0 ? (
                    <div className="space-y-3">
                      <h2 className="font-semibold text-sm">Missing keywords</h2>
                      <div className="flex flex-wrap gap-2">
                        {report.missing.map((term) => (
                          <span
                            className="rounded-full border border-destructive/25 bg-destructive/8 px-3 py-1.5 font-medium text-destructive text-xs"
                            key={term}
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {report.matched.length > 0 ? (
                    <div className="space-y-3">
                      <h2 className="font-semibold text-sm">Matched keywords</h2>
                      <div className="flex flex-wrap gap-2">
                        {report.matched.map((term) => (
                          <span
                            className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1.5 font-medium text-primary text-xs"
                            key={term}
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {report.suggestions.length > 0 ? (
                    <div className="space-y-2 rounded-lg border bg-field/70 p-4">
                      <h2 className="flex items-center gap-1.5 font-semibold text-sm">
                        <LightbulbIcon className="size-4 text-warning" />
                        Suggestions
                      </h2>
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
              ) : null}
            </>
          ) : (
            <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
              No ATS score recorded for this {selected ? `${selected.language.toUpperCase()} ` : ""}
              draft yet.
            </p>
          )}

          <section className="surface-card space-y-3 rounded-xl p-5">
            <h2 className="font-semibold text-sm">Job description</h2>
            <pre className="scrollbar-slim max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-sans text-muted-foreground text-xs leading-relaxed">
              {jdText}
            </pre>
          </section>
        </div>

        {/* Right: the selected variant's document, plus the application chat.
            Needs an explicit height below xl too, where it is no longer a
            full-height grid column and `h-full` would collapse it. */}
        <div className="h-[75dvh] min-h-0 xl:sticky xl:top-4 xl:h-[calc(100dvh-14rem)]">
          <ReviewPanel
            applicationId={applicationId}
            chatEvents={chatEvents}
            chatSession={chatSession}
            cv={selected?.cv ?? null}
            hasPdf={selected?.hasPdf ?? false}
            language={selected?.language}
            onTemplateChange={(next) => {
              if (selected) {
                setTemplateByLanguage((current) => ({ ...current, [selected.language]: next }));
              }
            }}
            template={template}
            title={title}
          />
        </div>
      </div>
    </div>
  );
}
