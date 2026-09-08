import { defineHook } from "eve/hooks";
import { cvLoop } from "../lib/state";

/**
 * Gives every user turn its own compile budget.
 *
 * The cap in `cvLoop` is there to stop the agent revising a draft on its own
 * initiative, which it did four times for no score gain. It is not there to
 * refuse the user: when someone reads the CV and asks for it to be stronger,
 * that request has to end in a recompile, not in a paragraph explaining that
 * the budget ran out three turns ago.
 */
export default defineHook({
  events: {
    async "turn.started"(event) {
      const { turnId } = event.data;
      cvLoop.update((state) =>
        // A retried step replays the turn's events; only a genuinely new turn
        // refills the budget.
        state.turnId === turnId ? state : { ...state, turnId, iterations: {}, rejections: {} },
      );
    },
  },
});
