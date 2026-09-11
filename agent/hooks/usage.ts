import { defineHook } from "eve/hooks";
import { costOf } from "../../lib/model-pricing.ts";
import { db } from "../lib/db.ts";
import { cvLoop } from "../lib/state.ts";

/**
 * Writes down what every model step cost.
 *
 * Pricing a plan on estimated token counts is guesswork: the estimate knows
 * nothing about retries, reasoning tokens, or a user who pastes a forty-page
 * job ad. This table is the only honest input to "what is one application
 * worth", and it has to exist from the first paying customer — added later, it
 * has nothing to say about the month that mattered.
 *
 * Two things the event does not carry, and how each is recovered:
 *
 * - **Who.** A hook's context is `{ agent, channel, session }` with no auth, so
 *   the principal comes from session state, stamped by `resolveUserId` on the
 *   first tool call of the turn. A turn that never calls a tool leaves it null
 *   rather than guessing; `sessionId` is always written, and an application
 *   records the session that created it, so those rows stay traceable.
 * - **Which model.** `step.completed` carries no model id. When the gateway
 *   reports a cost the id does not matter, because that figure is already
 *   authoritative. When it does not, the fallback prices the step as the main
 *   agent model and says so in `costSource`, so an estimate is never mistaken
 *   for a measurement.
 *
 * Best-effort throughout: a metering failure must never take down a turn the
 * user is waiting on.
 */
export default defineHook({
  events: {
    async "step.completed"(event, ctx) {
      const usage = event.data.usage;
      if (!usage) return;

      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;
      const cacheReadTokens = usage.cacheReadTokens ?? 0;

      // Unset in eve's own env-only convention, which is the same reason the
      // agent fails loudly at build time rather than running the wrong model.
      const model = process.env.AGENT_MODEL ?? "unknown";

      const reported = usage.costUsd;
      const measured = typeof reported === "number" && Number.isFinite(reported);
      const costUsd = measured
        ? reported
        : costOf(model, { inputTokens, outputTokens, cacheReadTokens });

      const loop = cvLoop.get();

      try {
        await db.llmUsage.create({
          data: {
            userId: loop.userId,
            sessionId: ctx.session.id,
            applicationId: loop.applicationId,
            // A step that belongs to an open application is work on that CV;
            // anything else is a conversation that has not become one yet.
            kind: loop.applicationId === null ? "chat" : "application",
            model,
            inputTokens,
            outputTokens,
            cacheReadTokens,
            costUsd: costUsd.toFixed(8),
            costSource: measured ? "gateway" : "estimate",
          },
        });
      } catch {
        // Metering is not the product. Swallow and move on.
      }
    },
  },
});
