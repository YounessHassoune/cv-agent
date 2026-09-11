import { generateText, Output } from "ai";
import type { z } from "zod";
import { costOf } from "../../lib/model-pricing.ts";
import { db } from "./db.ts";

/**
 * One structured model call made from inside a tool, metered.
 *
 * The writer and the analyst used to be subagents. That put every result
 * through the orchestrator's mouth: a 5k-token CV came back as a tool result
 * and the orchestrator had to re-type all of it as the next tool's arguments —
 * forty to sixty seconds per step, two to four steps per run, and again when
 * eve retried a long step. Called from a tool, the result goes straight to the
 * database and the orchestrator sees a one-line receipt.
 *
 * Metered here because the `usage` hook only sees the orchestrator's own
 * steps: a model call a tool makes is invisible to it, and an unmetered call is
 * exactly the cost the usage table exists to catch.
 */
export async function generateStructured<T extends z.ZodTypeAny>({
  abortSignal,
  applicationId,
  effort,
  kind,
  model,
  name,
  prompt,
  schema,
  sessionId,
  system,
  userId,
}: {
  readonly abortSignal?: AbortSignal;
  readonly applicationId: string | null;
  /** Reasoning effort, sent only to models that accept it. */
  readonly effort: "minimal" | "low" | "medium";
  readonly kind: "application" | "chat";
  readonly model: string;
  /** Schema name the provider sees. */
  readonly name: string;
  readonly prompt: string;
  readonly schema: T;
  readonly sessionId: string;
  readonly system: string;
  readonly userId: string | null;
}): Promise<z.infer<T>> {
  const result = await generateText({
    abortSignal,
    model,
    output: Output.object({ name, schema }),
    prompt,
    system,
    // Only reasoning models take this; the others warn on every call.
    ...(isReasoningModel(model) ? { providerOptions: { openai: { reasoningEffort: effort } } } : {}),
  });

  const usage = result.totalUsage;
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const cacheReadTokens = usage.inputTokenDetails?.cacheReadTokens ?? 0;
  try {
    await db.llmUsage.create({
      data: {
        userId,
        sessionId,
        applicationId,
        kind,
        model,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        costUsd: costOf(model, { inputTokens, outputTokens, cacheReadTokens }).toFixed(8),
        costSource: "estimate",
      },
    });
  } catch {
    // Metering is not the product. Swallow and move on.
  }

  return result.output as z.infer<T>;
}

/** gpt-5*, o3, o4-mini and friends. Everything else rejects `reasoningEffort`. */
export function isReasoningModel(model: string): boolean {
  return /(^|\/)(gpt-5|o\d)/.test(model);
}
