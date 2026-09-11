import type { EveMessage } from "eve/react";
import { isToolRunning } from "../components/agent-message";
import { progressKey } from "./activity-copy";

/**
 * The last step that came back with a result, as a copy-table key. Read from
 * the end so the answer is the step the model is reacting to right now.
 */
export function lastFinishedTool(message: EveMessage | undefined): string | undefined {
  if (message === undefined || message.role !== "assistant") return undefined;
  for (let index = message.parts.length - 1; index >= 0; index--) {
    const part = message.parts[index];
    if (part?.type === "dynamic-tool" && part.state === "output-available") {
      return progressKey(part.toolMetadata?.eve?.name ?? part.toolName);
    }
  }
  return undefined;
}

/**
 * Whether the agent is thinking rather than doing: no assistant message yet,
 * or its most recent part is already finished. Reading only the tail is what
 * makes this catch the pauses *between* steps — the message is full of
 * completed activity lines, and none of it means anything is happening now.
 */
export function isBetweenSteps(message: EveMessage | undefined): boolean {
  if (message === undefined || message.role !== "assistant") return true;

  const tail = message.parts[message.parts.length - 1];
  if (tail === undefined) return true;
  if (tail.type === "step-start") return true;
  if (tail.type === "text") return tail.text.trim().length === 0;
  return !isToolRunning(tail);
}
