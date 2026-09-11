/**
 * What a running step says while it runs. A single frozen line ("Tailoring
 * your CV…") sitting there for forty seconds reads as a hung app; walking
 * through what the step is actually doing reads as progress.
 *
 * The sequences are truthful, ordered by what the step does first, and the
 * last line is a holding line — reached only when the step really is taking
 * longer than usual, and never replaced by a fake later stage.
 */
export const TOOL_PROGRESS: Record<string, readonly string[]> = {
  getprofile: ["Reading your profile…", "Collecting your experience and skills…"],
  jdanalyst: [
    "Analyzing the job offer…",
    "Pulling out the must-have skills…",
    "Weighing what this employer cares about most…",
    "Still reading the offer closely…",
  ],
  analyzejd: ["Setting up your application…", "Saving the job analysis…"],
  cvwriter: [
    "Tailoring your CV…",
    "Matching your experience to the job's wording…",
    "Rewriting your summary and top bullets…",
    "Ordering skills the way this employer reads them…",
    "Checking every claim against your profile…",
    "Still writing — a good draft is worth the wait…",
  ],
  compilepdf: [
    "Building the PDF…",
    "Fact-checking the draft against your profile…",
    "Laying out the pages…",
    "Still building the document…",
  ],
  scoreats: [
    "Checking the match with the job…",
    "Counting the keywords the CV covers…",
    "Comparing meaning, not only wording…",
    "Scoring structure and title fit…",
    "Almost done with the match check…",
  ],
  askquestion: ["Waiting for your answer…"],
};

/**
 * The gap between steps, where the model is deciding what to do next and the
 * transcript has nothing to show. "Thinking…" alone for half a minute is the
 * emptiest thing in the run.
 */
export const THINKING_PROGRESS: readonly string[] = [
  "Thinking…",
  "Reading what came back…",
  "Deciding the next step…",
  "Working through it…",
  "Still on it…",
];

/** How long each line holds before the next one takes over. */
export const PROGRESS_STEP_MS = 3500;

/** Tool names arrive in several shapes; the copy tables use one. */
export function progressKey(toolName: string): string {
  return toolName.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function progressFor(toolName: string, fallback: string): readonly string[] {
  return TOOL_PROGRESS[progressKey(toolName)] ?? [fallback];
}
