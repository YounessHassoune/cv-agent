"use client";

import { useState } from "react";
import { CheckIcon, ChevronDownIcon, LightbulbIcon } from "lucide-react";

import { type AtsReport, ATS_WEIGHTS } from "@/agent/lib/ats.ts";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * The old panel showed four flat clouds of keyword pills (matched, missing,
 * listed-only, unsupported) at equal weight, which left the reader to work out
 * for themselves which ones actually cost them the job. This one answers that
 * directly: it sorts every term into what it means for the reader and what they
 * can do about it, blocking problems first, and hides the things that need no
 * action behind a count.
 */

function scoreTone(score: number): string {
  if (score >= 85) return "text-success";
  if (score >= 70) return "text-warning";
  return "text-destructive";
}

function scoreBar(score: number): string {
  if (score >= 85) return "bg-success";
  if (score >= 70) return "bg-warning";
  return "bg-destructive";
}

/** "Keywords (35%)" - read off the weights so the labels can never drift. */
function pct(label: string, key: keyof typeof ATS_WEIGHTS): string {
  return `${label} (${Math.round(ATS_WEIGHTS[key] * 100)}%)`;
}

type Severity = "blocking" | "weak" | "optional" | "impossible";

const severityStyle: Record<Severity, { dot: string; chip: string }> = {
  blocking: {
    dot: "bg-destructive",
    chip: "border-destructive/25 bg-destructive/8 text-destructive",
  },
  weak: { dot: "bg-warning", chip: "border-warning/30 bg-warning/8 text-warning" },
  optional: { dot: "bg-muted-foreground/40", chip: "border-border bg-field text-muted-foreground" },
  impossible: { dot: "bg-muted-foreground/40", chip: "border-border bg-field text-muted-foreground" },
};

function GapGroup({
  terms,
  title,
  body,
  severity,
}: {
  readonly terms: string[];
  readonly title: string;
  readonly body: string;
  readonly severity: Severity;
}) {
  if (terms.length === 0) return null;
  const style = severityStyle[severity];

  return (
    <div className="space-y-2.5 px-5 py-4">
      <div className="flex items-baseline gap-2">
        <span className={cn("size-1.5 shrink-0 translate-y-[-2px] rounded-full", style.dot)} />
        <h3 className="font-medium text-sm">{title}</h3>
        <span className="ml-auto shrink-0 text-muted-foreground text-xs tabular-nums">
          {terms.length}
        </span>
      </div>
      <p className="pl-3.5 text-muted-foreground text-xs leading-relaxed">{body}</p>
      <div className="flex flex-wrap gap-1.5 pl-3.5">
        {terms.map((term) => (
          <span
            className={cn("rounded-full border px-2.5 py-1 font-medium text-xs", style.chip)}
            key={term}
          >
            {term}
          </span>
        ))}
      </div>
    </div>
  );
}

export function InsightsPanel({
  report,
  language,
  unsupported,
}: {
  readonly report: AtsReport | null;
  readonly language?: string;
  /** Skills the CV claims that the master profile does not list. */
  readonly unsupported: string[];
}) {
  const [showMatched, setShowMatched] = useState(false);

  if (!report) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="max-w-xs text-center text-muted-foreground text-sm leading-relaxed">
          No ATS score recorded for this{language ? ` ${language.toUpperCase()}` : ""} draft yet.
          Ask the agent to score it.
        </p>
      </div>
    );
  }

  // A must-have the profile cannot support is a different problem from one it
  // can: the first needs the experience, the second only needs rewriting. They
  // were previously shown as one undifferentiated list.
  const unclaimable = new Set(report.unclaimable);
  const blockingGaps = report.missingMustHaves.filter((term) => !unclaimable.has(term));
  const mustHaves = new Set(report.missingMustHaves);
  const optionalGaps = report.missing.filter(
    (term) => !mustHaves.has(term) && !unclaimable.has(term),
  );

  const actionable =
    blockingGaps.length + unsupported.length + report.listedOnly.length + optionalGaps.length;

  return (
    <div className="scrollbar-slim h-full overflow-y-auto">
      {/* Headline number, with the honest ceiling beside it rather than buried. */}
      <div className="space-y-3 border-b px-5 py-5">
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "font-semibold text-4xl tabular-nums tracking-tight",
                scoreTone(report.total),
              )}
            >
              {report.total}
            </span>
            <span className="text-muted-foreground text-sm">/ 100</span>
          </div>
          {report.ceiling !== null && report.ceiling < 100 ? (
            <p className="text-right text-muted-foreground text-xs leading-relaxed">
              Best this profile
              <br />
              can truthfully reach: <span className="tabular-nums">{report.ceiling}</span>
            </p>
          ) : null}
        </div>
        <Progress indicatorClassName={scoreBar(report.total)} value={report.total} />

        {report.gate < 1 ? (
          <p className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-destructive text-xs leading-relaxed">
            <span className="font-medium">
              {report.missingMustHaves.length} must-have{" "}
              {report.missingMustHaves.length === 1 ? "keyword is" : "keywords are"} missing.
            </span>{" "}
            A real screen filters on these, so the score is capped at{" "}
            {Math.round(report.gate * 100)}% of what the rest of the CV earned.
          </p>
        ) : null}
      </div>

      {/* What to do, in the order it matters. */}
      <div className="divide-y border-b">
        {actionable === 0 && report.unclaimable.length === 0 ? (
          <div className="flex items-center gap-2.5 px-5 py-4 text-sm">
            <CheckIcon className="size-4 shrink-0 text-success" />
            Nothing left to close. Every keyword this profile can support is covered.
          </div>
        ) : null}

        <GapGroup
          body="These are the terms a screen filters on. The profile can support them, so this is a rewrite job."
          severity="blocking"
          terms={blockingGaps}
          title="Fix first"
        />
        <GapGroup
          body="Your CV claims these but your master profile does not list them. Keep only the ones that are true: an interviewer will assume every word here is yours."
          severity="weak"
          terms={unsupported}
          title="Confirm before you apply"
        />
        <GapGroup
          body="These appear only in the skills list. A term backed by a bullet scores higher with both a recruiter and a match model."
          severity="weak"
          terms={report.listedOnly}
          title="Back these with a bullet"
        />
        <GapGroup
          body="Worth covering if they are genuinely true of your experience, but they will not get the CV rejected on their own."
          severity="optional"
          terms={optionalGaps}
          title="Optional gains"
        />
        <GapGroup
          body="Nothing in your profile supports these, so no rewrite can honestly add them. They are the gap between your score and its ceiling."
          severity="impossible"
          terms={report.unclaimable}
          title="Out of reach for this profile"
        />
      </div>

      {/* Score composition, kept below the actions because it explains rather
          than instructs. */}
      <div className="space-y-4 border-b px-5 py-5">
        <h3 className="font-medium text-sm">How the score is made up</h3>
        <ScoreRow label={pct("Keywords", "keyword")} value={report.breakdown.keyword} />
        <ScoreRow label={pct("Semantic relevance", "semantic")} value={report.breakdown.semantic} />
        <ScoreRow label={pct("Title and years fit", "fit")} value={report.breakdown.fit} />
        <ScoreRow label={pct("Structure and metrics", "structure")} value={report.breakdown.structure} />
      </div>

      {report.suggestions.length > 0 ? (
        <div className="space-y-2.5 border-b px-5 py-5">
          <h3 className="flex items-center gap-2 font-medium text-sm">
            <LightbulbIcon className="size-4 text-warning" />
            Suggestions
          </h3>
          <ul className="space-y-2 text-muted-foreground text-xs leading-relaxed">
            {report.suggestions.map((suggestion) => (
              <li className="flex gap-2" key={suggestion}>
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Matched terms need no action, so they are a count until asked for. */}
      {report.matched.length > 0 ? (
        <div className="px-5 py-4">
          <button
            aria-expanded={showMatched}
            className="flex w-full items-center gap-2 text-left text-muted-foreground text-sm transition-colors hover:text-foreground"
            onClick={() => setShowMatched((open) => !open)}
            type="button"
          >
            <CheckIcon className="size-4 shrink-0 text-success" />
            <span className="font-medium">{report.matched.length} keywords matched</span>
            <ChevronDownIcon
              className={cn("ml-auto size-4 transition-transform", showMatched && "rotate-180")}
            />
          </button>
          {showMatched ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {report.matched.map((term) => (
                <span
                  className="rounded-full border border-success/25 bg-success/8 px-2.5 py-1 font-medium text-success text-xs"
                  key={term}
                >
                  {term}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ScoreRow({ label, value }: { readonly label: string; readonly value: number | null }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value === null ? "n/a" : value}</span>
      </div>
      <Progress
        className="h-1"
        indicatorClassName={value === null ? undefined : scoreBar(value)}
        value={value ?? 0}
      />
    </div>
  );
}

/** Derives one-tap chat prompts from what the report actually says is wrong. */
export function gapSuggestions(report: AtsReport | null, unsupported: string[]): string[] {
  if (!report) return ["Score this CV against the job description"];

  const unclaimable = new Set(report.unclaimable);
  const blocking = report.missingMustHaves.filter((term) => !unclaimable.has(term));
  const prompts: string[] = [];

  if (blocking.length > 0) {
    prompts.push(`Rewrite my bullets to cover ${blocking.slice(0, 3).join(", ")}`);
  }
  if (report.listedOnly.length > 0) {
    prompts.push(`Back ${report.listedOnly.slice(0, 3).join(", ")} with real bullet evidence`);
  }
  if (unsupported.length > 0) {
    prompts.push(`Remove any claim my profile does not support`);
  }
  if (report.total < 85) {
    prompts.push("Why is the ATS score not higher?");
  }
  prompts.push("Make the summary shorter and more specific");

  return prompts.slice(0, 4);
}
