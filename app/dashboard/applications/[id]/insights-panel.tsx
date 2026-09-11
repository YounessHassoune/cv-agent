"use client";

import { AlertTriangleIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { ATS_WEIGHTS, type AtsReport } from "@/agent/lib/ats.ts";
import { LockedCard } from "@/components/plan-provider";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/**
 * The score, and what would move it.
 *
 * The previous panel put five term lists, four bars and the engine's raw
 * suggestion strings on one page at equal weight, and left the reader to work
 * out which of them mattered. This one is built around the only question the
 * reader actually has — "what do I fix?" — so each of the four things the
 * score is made of gets its own line, its own number, and one sentence saying
 * how to raise it. The terms behind that sentence stay folded away until
 * asked for.
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

function weightOf(key: keyof typeof ATS_WEIGHTS): string {
  return `${Math.round(ATS_WEIGHTS[key] * 100)}%`;
}

/** One labelled group of keyword chips, shown only inside an opened row. */
function Terms({
  terms,
  tone,
  title,
  hint,
}: {
  readonly terms: string[];
  readonly tone: "bad" | "warn" | "muted";
  readonly title: string;
  readonly hint: string;
}) {
  if (terms.length === 0) return null;

  const chip = {
    bad: "border-destructive/25 bg-destructive/8 text-destructive",
    warn: "border-warning/30 bg-warning/8 text-warning",
    muted: "border-border bg-field text-muted-foreground",
  }[tone];

  return (
    <div className="space-y-1.5">
      <p className="font-medium text-xs">
        {title} <span className="text-muted-foreground">— {hint}</span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {terms.map((term) => (
          <span
            className={cn("rounded-full border px-2 py-0.5 font-medium text-xs", chip)}
            key={term}
          >
            {term}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * The score without the advice.
 *
 * Everything a plan cannot read is withheld on the server, so what arrives here
 * is a handful of numbers and no keywords at all. That is also the product
 * argument: a score on its own tells you where you stand and nothing about what
 * to do, which is exactly the itch the paid tier scratches.
 *
 * The header is the real thing, unblurred — it is the user's own score and
 * there is no reason to hide it. Below it sits a decoy breakdown under a blur,
 * whose numbers are invented and never the user's. The overlay says so, so
 * nothing pretends the smudge is real data.
 */
export type ScoreSummary = {
  total: number;
  ceiling: number | null;
  gate: number;
  missingMustHaveCount: number;
};

export function LockedInsights({
  score,
  language,
  onUpgrade,
}: {
  /** Null when nothing has been scored yet — not the same as "not your plan". */
  readonly score: ScoreSummary | null;
  readonly language?: string;
  readonly onUpgrade: () => void;
}) {
  if (!score) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="max-w-xs text-center text-muted-foreground text-sm leading-relaxed">
          No ATS score recorded for this{language ? ` ${language.toUpperCase()}` : ""} draft yet.
          Ask the agent to score it.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Identical markup to the unlocked header, because it is the same fact. */}
      <div className="shrink-0 space-y-3 border-b px-5 py-5">
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "font-semibold text-4xl tabular-nums tracking-tight",
                scoreTone(score.total),
              )}
            >
              {score.total}
            </span>
            <span className="text-muted-foreground text-sm">/ 100</span>
          </div>
          {score.ceiling !== null && score.ceiling > score.total ? (
            <p className="text-right text-muted-foreground text-xs">
              Reachable with this profile:{" "}
              <span className="tabular-nums text-foreground">{score.ceiling}</span>
            </p>
          ) : null}
        </div>
        <Progress indicatorClassName={scoreBar(score.total)} value={score.total} />

        {score.gate < 1 ? (
          <p className="text-destructive text-xs leading-relaxed">
            {score.missingMustHaveCount} must-have{" "}
            {score.missingMustHaveCount === 1 ? "keyword is" : "keywords are"} missing, so the score
            is held at {Math.round(score.gate * 100)}% of what the rest of the CV earned.
          </p>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div aria-hidden="true" className="select-none blur-[6px]">
          <p className="px-5 pt-4 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            What the score is made of
          </p>
          {[
            { label: "Keyword coverage", value: 71 },
            { label: "Semantic fit", value: 84 },
            { label: "Structure", value: 92 },
            { label: "Role fit", value: 63 },
          ].map((row) => (
            <div className="px-5 py-4" key={row.label}>
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-sm">{row.label}</span>
                <span
                  className={cn("ml-auto font-semibold text-sm tabular-nums", scoreTone(row.value))}
                >
                  {row.value}
                </span>
              </div>
              <Progress
                className="mt-2 h-1"
                indicatorClassName={scoreBar(row.value)}
                value={row.value}
              />
              <p className="mt-2 text-muted-foreground text-xs">
                Add the terms this job names most often, in the roles where you used them.
              </p>
            </div>
          ))}
        </div>

        {/* Sits over the decoy rather than replacing it: the shape underneath
            is what says there is something specific to unlock. */}
        <div className="absolute inset-0 flex items-center justify-center bg-linear-to-b from-card/70 via-card/90 to-card">
          <LockedCard
            action="Unlock the breakdown"
            body="Which keywords this job screens for that your CV is missing, which of them your profile can actually back up, and the one change that moves each number."
            onUpgrade={onUpgrade}
            title="How to raise this score"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * One component of the score: its number, and the single sentence that says
 * how to raise it. Detail is behind the row, not in front of it.
 */
function ScoreRow({
  action,
  children,
  label,
  value,
  weight,
}: {
  /** The one thing that would raise this number. */
  readonly action: string;
  readonly children?: React.ReactNode;
  readonly label: string;
  readonly value: number | null;
  readonly weight: string;
}) {
  const [open, setOpen] = useState(false);
  const hasDetail = children !== undefined && children !== null && children !== false;

  const head = (
    <>
      <div className="flex items-baseline gap-2">
        <span className="font-medium text-sm">{label}</span>
        <span className="text-muted-foreground text-xs">{weight}</span>
        <span
          className={cn(
            "ml-auto font-semibold text-sm tabular-nums",
            value === null ? "text-muted-foreground" : scoreTone(value),
          )}
        >
          {value === null ? "n/a" : value}
        </span>
        {hasDetail ? (
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        ) : null}
      </div>
      <Progress
        className="mt-2 h-1"
        indicatorClassName={value === null ? undefined : scoreBar(value)}
        value={value ?? 0}
      />
      <p className="mt-2 text-left text-muted-foreground text-xs leading-relaxed">{action}</p>
    </>
  );

  return (
    <div className="px-5 py-4">
      {hasDetail ? (
        <button
          aria-expanded={open}
          className="w-full cursor-pointer"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {head}
        </button>
      ) : (
        head
      )}
      {open && hasDetail ? <div className="mt-3 space-y-3">{children}</div> : null}
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

  /*
   * A must-have the profile can support is a rewrite; one it cannot is a gap
   * in the candidate's experience. Same list in the report, opposite advice.
   */
  const unclaimable = new Set(report.unclaimable);
  const blocking = report.missingMustHaves.filter((term) => !unclaimable.has(term));
  const mustHaves = new Set(report.missingMustHaves);
  const optional = report.missing.filter((term) => !mustHaves.has(term) && !unclaimable.has(term));

  return (
    <div className="scrollbar-slim h-full overflow-y-auto">
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
          {report.ceiling !== null && report.ceiling > report.total ? (
            <p className="text-right text-muted-foreground text-xs">
              Reachable with this profile:{" "}
              <span className="tabular-nums text-foreground">{report.ceiling}</span>
            </p>
          ) : null}
        </div>
        <Progress indicatorClassName={scoreBar(report.total)} value={report.total} />

        {report.gate < 1 ? (
          <p className="text-destructive text-xs leading-relaxed">
            {report.missingMustHaves.length} must-have{" "}
            {report.missingMustHaves.length === 1 ? "keyword is" : "keywords are"} missing, so the
            score is held at {Math.round(report.gate * 100)}% of what the rest of the CV earned.
          </p>
        ) : null}
      </div>

      {/* The one thing that is about the user rather than the score. */}
      {unsupported.length > 0 ? (
        <div className="space-y-2 border-b bg-warning/5 px-5 py-4">
          <p className="flex items-center gap-2 font-medium text-sm">
            <AlertTriangleIcon className="size-4 shrink-0 text-warning" />
            Check {unsupported.length} claim{unsupported.length === 1 ? "" : "s"} before applying
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            The CV says these; your profile does not. Keep only what is true — an interviewer will
            assume every word is yours.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unsupported.map((term) => (
              <span
                className="rounded-full border border-warning/30 bg-warning/8 px-2 py-0.5 font-medium text-warning text-xs"
                key={term}
              >
                {term}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="divide-y border-b">
        <p className="px-5 pt-4 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
          What the score is made of
        </p>

        <ScoreRow
          action={keywordAction(blocking, report.listedOnly, optional, report.unclaimable)}
          label="Keywords"
          value={report.breakdown.keyword}
          weight={weightOf("keyword")}
        >
          <Terms
            hint="the profile supports these, so it is a rewrite"
            terms={blocking}
            title="Fix first"
            tone="bad"
          />
          <Terms
            hint="listed but never evidenced, so they count 60%"
            terms={report.listedOnly}
            title="Back with a bullet"
            tone="warn"
          />
          <Terms
            hint="worth adding where genuinely true"
            terms={optional}
            title="Nice to have"
            tone="muted"
          />
          <Terms
            hint="nothing in the profile supports them"
            terms={report.unclaimable}
            title="Out of reach"
            tone="muted"
          />
        </ScoreRow>

        <ScoreRow
          action={
            report.breakdown.semantic === null
              ? "Not measured — no embedding provider is configured."
              : "Measures how closely the whole CV reads like this job ad. Ask the agent to rewrite your summary and bullets in the job's own words, leading with the work closest to the role."
          }
          label="Reads like the job"
          value={report.breakdown.semantic}
          weight={weightOf("semantic")}
        />

        <ScoreRow
          action={
            report.breakdown.fit === null
              ? "The ad gave no job title or years requirement, so this is not scored."
              : report.breakdown.fit >= 85
                ? "Your headline and job titles line up with the role."
                : "Your headline and past titles barely overlap the advertised one. Ask the agent to align the headline with the job title where that is truthful."
          }
          label="Title and experience"
          value={report.breakdown.fit}
          weight={weightOf("fit")}
        />

        <ScoreRow
          action={
            report.breakdown.structure >= 85
              ? "Sections and formatting parse cleanly."
              : "Mostly about numbers: bullets with a figure in them score higher. Ask the agent to quantify more bullets — only where you have a real number."
          }
          label="Layout and numbers"
          value={report.breakdown.structure}
          weight={weightOf("structure")}
        />
      </div>

      {report.matched.length > 0 ? (
        <div className="px-5 py-4">
          <button
            aria-expanded={showMatched}
            className="flex w-full items-center gap-2 text-left text-muted-foreground text-sm transition-colors hover:text-foreground"
            onClick={() => setShowMatched((open) => !open)}
            type="button"
          >
            <CheckIcon className="size-4 shrink-0 text-success" />
            <span className="font-medium">{report.matched.length} keywords already matched</span>
            <ChevronDownIcon
              className={cn("ml-auto size-4 transition-transform", showMatched && "rotate-180")}
            />
          </button>
          {showMatched ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {report.matched.map((term) => (
                <span
                  className="rounded-full border border-success/25 bg-success/8 px-2 py-0.5 font-medium text-success text-xs"
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

/** The one sentence under the keyword bar: the biggest lever, named. */
function keywordAction(
  blocking: string[],
  listedOnly: string[],
  optional: string[],
  unclaimable: string[],
): string {
  if (blocking.length > 0) {
    return `${blocking.length} required term${blocking.length === 1 ? "" : "s"} the profile can support ${blocking.length === 1 ? "is" : "are"} missing — ask the agent to work ${blocking.slice(0, 2).join(" and ")} into a bullet.`;
  }
  if (listedOnly.length > 0) {
    return `${listedOnly.join(", ")} appear only in the skills list. A term evidenced in a bullet counts for more.`;
  }
  if (optional.length > 0) {
    return `Optional gains left: ${optional.slice(0, 3).join(", ")}. Add them only where they are genuinely true.`;
  }
  if (unclaimable.length > 0) {
    return `Everything the profile supports is already in. The rest (${unclaimable.length} term${unclaimable.length === 1 ? "" : "s"}) needs experience you do not have yet.`;
  }
  return "Every keyword this job asked for is covered.";
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
