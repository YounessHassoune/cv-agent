import { defineAgent } from "eve";
import { requireModelEnv } from "./lib/model-env";

export default defineAgent({
  model: requireModelEnv("AGENT_MODEL"),
});
