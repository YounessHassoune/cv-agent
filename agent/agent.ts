import { defineAgent } from "eve";
import { requireModelEnv } from "./lib/model-env";

export default defineAgent({
  model: requireModelEnv("AGENT_MODEL"),
  /*
   * This agent routes: it calls tools in the order the instructions give and
   * obeys the `action` that `score_ats` hands back. Every judgement that
   * needs thought lives in a tool-side model call (analyze_jd, write_cv) or in
   * deterministic code (the scorer, the fabrication check, the stop policy).
   * At the provider default the model spent a minute or more reasoning before
   * a six-line recap, with nothing on screen — the run looked finished.
   */
  reasoning: "low",
});
