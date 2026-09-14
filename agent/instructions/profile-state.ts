import { defineDynamic, defineInstructions } from "eve/instructions";
import { principalUserId } from "../lib/auth.ts";
import { COMPLETE_THRESHOLD, profileCompleteness } from "../lib/profile-completeness.ts";

/**
 * Tells the agent, before it answers anything, that this user's master profile
 * is too thin to tailor from.
 *
 * `analyze_jd` already refuses a thin profile, but that guard only fires once
 * the tool is called — and the failure it exists for is the turn where the
 * model answers "I'll run the pipeline and get back to you" and ends without
 * calling a single tool. Nothing runs after the turn ends, so the user waits
 * for a CV that was never started and never hears that their profile is empty.
 * Stating the number up front turns that into an answer the model can give
 * immediately.
 *
 * Resolved per turn rather than per session so a user who fills the builder in
 * another tab and comes back is not told they are still blocked.
 */
export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      const { complete, percent, missing } = await profileCompleteness(principalUserId(ctx));
      if (complete) return null;

      return defineInstructions({
        markdown: [
          `# Profile status — this user cannot be tailored for yet`,
          ``,
          `Their master profile is ${percent}% complete; ${COMPLETE_THRESHOLD}% is the minimum.`,
          `Still missing: ${missing.slice(0, 3).join(", ")}.`,
          ``,
          `If this turn asks for a CV or contains a job description, do not start the`,
          `workflow and do not call \`analyze_jd\` — it would refuse anyway. Answer in two`,
          `lines in the user's own language: the percentage, what is missing, and a link`,
          `to the profile builder written as a markdown link — \`[Complete my profile](/dashboard/profile)\`,`,
          `with the label in their language. The chat renders it as a button that takes`,
          `them straight there, so never write the bare path as text. Never say you are`,
          `about to run, start or continue anything: a turn that ends is over, so promised`,
          `work never happens. Everything else — questions about the profile, about the`,
          `app — you answer as usual.`,
        ].join("\n"),
      });
    },
  },
});
