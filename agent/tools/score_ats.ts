import { defineTool } from "eve/tools";
import { z } from "zod";
import { titlesFor } from "../../lib/cv-sections";
import {
  ATS_TARGET,
  CEILING_SLACK,
  type JdKeyword,
  requiredYearsFromJd,
  scoreAts,
  totalYears,
} from "../lib/ats";
import { resolveUserId } from "../lib/auth";
import { db } from "../lib/db";
import { applicationGone } from "../lib/gone";
import { cvLoop } from "../lib/state";
import { readVariants } from "../lib/variants";

type LoopState = ReturnType<typeof cvLoop.get>;

/*
 * Stop policy, decided here rather than in the prompt: the model should not be
 * doing arithmetic on its own score to work out whether to go again.
 *
 * `ATS_TARGET` is the ambition, but a profile missing a required skill can
 * never reach it — `ceiling` is what this candidate can truthfully score for
 * this job, and grinding past it only invites padding.
 */
function decide(
  report: { total: number; ceiling: number | null; unclaimable: string[] },
  history: number[],
  loop: LoopState,
  lang: string,
) {
  /*
   * The target is the target. The ceiling is an estimate made from the terms
   * the profile happens to spell out — in the language it happens to be
   * written in — so letting it *lower* the target is how a run stopped at
   * 29/100 and told the user that was their honest best. It now only ends a
   * loop that has already tried twice and stopped moving.
   */
  const target = ATS_TARGET;
  const iterationsRemaining = loop.cap - (loop.iterations[lang] ?? 0);
  const gain =
    history.length >= 2
      ? report.total - (history[history.length - 2] as number)
      : Number.POSITIVE_INFINITY;

  if (report.total >= target) {
    return {
      target,
      iterationsRemaining,
      action: "stop" as const,
      reason: `Target of ${ATS_TARGET} reached.`,
    };
  }

  // Within touching distance of everything this profile can claim, after a
  // real attempt at it. Grinding further only invites padding.
  const atCeiling =
    report.ceiling !== null &&
    history.length >= 2 &&
    report.total >= report.ceiling - CEILING_SLACK;
  if (atCeiling) {
    return {
      target,
      iterationsRemaining,
      action: "stop" as const,
      reason: `At the best this profile can truthfully reach for this job (${report.ceiling}/100). The gap is ${report.unclaimable.join(", ") || "experience the candidate does not have"} — cover it with transferable framing where honest, and report it plainly.`,
    };
  }
  if (iterationsRemaining <= 0) {
    return {
      target,
      iterationsRemaining,
      action: "stop" as const,
      reason:
        "Compile budget for this language is spent for this turn — keep the best draft and close. It refills on the user's next message, so do not tell them revisions have run out.",
    };
  }
  if (gain < 2) {
    return {
      target,
      iterationsRemaining,
      action: "stop" as const,
      reason: `Last revision moved the score by ${gain}. Further rewrites are rearranging, not improving — keep the best draft.`,
    };
  }
  return {
    target,
    iterationsRemaining,
    action: "revise" as const,
    reason: `${report.total}/100 against a target of ${target}. Call write_cv for this language with the gaps it can truthfully close: the missing keywords the candidate's real work supports as missingKeywords, and feedback asking for transferable framing in the summary and bullets for the rest${report.unclaimable.length > 0 ? ` (the profile does not spell out ${report.unclaimable.join(", ")})` : ""}. ${iterationsRemaining} compile(s) left.`,
  };
}

export default defineTool({
  description:
    "Score one compiled language variant against the job description (deterministic hybrid: weighted keywords 35%, semantic embedding similarity 35%, structure & quantified metrics 15%, title/years fit 15% — then multiplied by the share of must-have keywords present, so a missing must-have caps the whole score). Returns the total, breakdown, matched/missing keywords, the must-haves still absent, and concrete suggestions. Call after every compile_pdf, with the same language.",
  inputSchema: z.object({
    applicationId: z.string(),
    language: z.string().min(2).describe("ISO code of the variant to score"),
  }),
  async execute({ applicationId, language }, ctx) {
    const userId = resolveUserId(ctx);
    const lang = language.toLowerCase();

    const application = await db.application.findFirst({
      where: { id: applicationId, userId },
    });
    if (!application) return applicationGone(applicationId);

    const variants = readVariants(application.variants);
    const variant = variants[lang];
    if (!variant?.cvText) {
      throw new Error(
        `No compiled "${lang}" variant on this application — call compile_pdf for that language first.`,
      );
    }

    /*
     * Idempotence. `compile_pdf` clears `atsReport` on every recompile, so a
     * report that is still here can only describe the exact text in front of
     * us. Re-scoring would re-embed the CV and push a duplicate entry into the
     * plateau history, making a repeat call look like a revision that achieved
     * nothing.
     */
    const loopState = cvLoop.get();
    if (variant.atsReport !== null) {
      return {
        language: lang,
        ...variant.atsReport,
        ...decide(variant.atsReport, loopState.scores[lang] ?? [], loopState, lang),
        unchanged: true,
      };
    }

    const keywords = (application.jdKeywords ?? []) as JdKeyword[];
    const t = titlesFor(lang);

    // Years come from the profile's real date columns, not the CV's display
    // dates ("Jan 2022"), which vary by language and would need re-parsing.
    const profile = await db.profile.findUnique({
      where: { userId },
      include: { skills: true, experiences: true, projects: true },
    });

    // Everything the candidate can truthfully be said to have. A JD keyword
    // absent from this can never appear in a compilable CV, so it fixes the
    // ceiling the revise loop is allowed to chase.
    const claimableText = profile
      ? [
          profile.headline ?? "",
          profile.summary ?? "",
          ...profile.skills.map((s) => s.name),
          ...profile.experiences.flatMap((e) => [e.role, e.company, ...e.stack, ...e.bullets]),
          ...profile.projects.flatMap((p) => [
            p.title,
            p.description ?? "",
            ...p.stack,
            ...p.bullets,
          ]),
          // "English" and a degree are claims too — they live in these columns.
          JSON.stringify(profile.languages),
          JSON.stringify(profile.education),
        ].join("\n")
      : undefined;

    const { report, jdEmbedding } = await scoreAts({
      cvText: variant.cvText,
      jdText: application.jdText,
      keywords,
      sections: t,
      fit: {
        role: application.jdRole,
        cvTitles: [
          variant.cvJson.header.headline,
          ...variant.cvJson.experiences.map((e) => e.role),
        ],
        requiredYears: requiredYearsFromJd(application.jdText),
        cvYears: profile ? totalYears(profile.experiences) : null,
      },
      claimableText,
      cachedJdEmbedding: (application.jdEmbedding as number[] | null) ?? undefined,
      abortSignal: ctx.abortSignal,
    });

    variants[lang] = { ...variant, atsReport: report };
    await db.application.update({
      where: { id: application.id },
      data: { variants, jdEmbedding: jdEmbedding ?? undefined },
    });

    /*
     * Stop policy, decided here rather than in the prompt: the model should not
     * be doing arithmetic on its own score to work out whether to go again.
     *
     * `ATS_TARGET` is the ambition, but a profile missing a required skill can
     * never reach it — `ceiling` is what this candidate can truthfully score
     * for this job, and grinding past it only invites padding.
     */
    const history = [...(loopState.scores[lang] ?? []), report.total];
    cvLoop.update((state) => ({
      ...state,
      scores: { ...state.scores, [lang]: history },
    }));

    /*
     * The whole report is stored above for the insights panel. What goes back
     * to the model is the part it acts on: the total, what is missing, what it
     * can never claim, and the stop decision. The matched-keyword lists are
     * the longest fields and drive nothing — and they sat in the context of
     * every later step, so each one paid for them again.
     */
    const { matched: _matched, listedOnly: _listedOnly, ...forModel } = report;
    return { language: lang, ...forModel, ...decide(report, history, loopState, lang) };
  },
});
