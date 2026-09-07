import type { EveMessage } from "eve/react";
import { isToolRunning } from "../components/agent-message";

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
