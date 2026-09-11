/**
 * What a model step costs, in USD.
 *
 * These are provider list prices in dollars per million tokens, as routed by
 * the Vercel AI Gateway. They are a local copy of somebody else's pricing page
 * and they go stale: `PRICES_CHECKED_ON` says when they were last confirmed.
 * Re-check it whenever a margin number matters, and treat the gateway's own
 * spend report as the authority if the two ever disagree.
 *
 * A missing model is priced at zero rather than guessed. An unknown id means a
 * model was added without adding its price, and the honest report of that is a
 * visible zero in the usage table — not a made-up number that quietly poisons
 * the margin maths.
 */

/** ISO date these rates were last verified against the provider's pricing page. */
export const PRICES_CHECKED_ON = "2026-09-11";

type Rate = {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens, reasoning tokens included. */
  output: number;
  /** USD per 1M cached-prompt-prefix reads. */
  cachedInput: number;
};

const RATES: Record<string, Rate> = {
  "openai/gpt-5": { input: 1.25, output: 10.0, cachedInput: 0.125 },
  "openai/gpt-5-mini": { input: 0.25, output: 2.0, cachedInput: 0.025 },
  "openai/gpt-5-nano": { input: 0.05, output: 0.4, cachedInput: 0.005 },
  "openai/text-embedding-3-small": { input: 0.02, output: 0, cachedInput: 0.02 },
  "openai/text-embedding-3-large": { input: 0.13, output: 0, cachedInput: 0.13 },
};

export type StepUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
};

export function rateFor(model: string): Rate | null {
  return RATES[model] ?? RATES[model.replace(/^[^/]+\//, "openai/")] ?? null;
}

/**
 * Cost of one step. Cached reads are billed at their own rate and subtracted
 * from the full-price input, since providers report them inside `inputTokens`
 * rather than beside it — counting both would overstate every cached step.
 */
export function costOf(model: string, usage: StepUsage): number {
  const rate = rateFor(model);
  if (!rate) return 0;

  const cached = Math.min(usage.cacheReadTokens ?? 0, usage.inputTokens);
  const fresh = usage.inputTokens - cached;

  return (
    (fresh * rate.input) / 1_000_000 +
    (cached * rate.cachedInput) / 1_000_000 +
    (usage.outputTokens * rate.output) / 1_000_000
  );
}
