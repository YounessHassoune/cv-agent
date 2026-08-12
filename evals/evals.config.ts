import { defineEvalConfig } from "eve/evals";

export default defineEvalConfig({
  // The CV agent's own scoring is deterministic, so these evals assert on tool
  // usage and text rather than LLM judgment. Add `judge` if you introduce
  // fuzzy grading later.
  timeoutMs: 300_000,
});
