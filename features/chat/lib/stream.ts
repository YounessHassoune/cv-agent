import type { MessageStreamEvent } from "eve/client";

/**
 * A turn spends minutes inside subagents, and every one of those gaps is
 * silence on the wire. eve's default gives up after five idle reconnects —
 * roughly seven seconds — which is shorter than a single `cv-writer` call, so
 * a stream that went quiet at the wrong moment never came back and the run
 * finished with nothing on screen. Wait as long as the work plausibly takes:
 * reconnects carry a cursor, so nothing is replayed and nothing is missed.
 */
export const PATIENT_STREAM_RECONNECT = {
  streamIdleReconnectPolicy: { baseDelayMs: 500, maxAttempts: 60, maxDelayMs: 5000 },
  streamOpenReconnectPolicy: { baseDelayMs: 500, maxAttempts: 20, maxDelayMs: 5000 },
} as const;

/**
 * How long a running turn may deliver nothing before we treat the connection
 * as gone.
 *
 * The longest genuine gap is no longer a subagent writing a CV. A reasoning
 * model deciding what to do after a tool result streams nothing at all while
 * it thinks — the recap after the score ran past the old 75s limit — and
 * every time it did, this watchdog declared the run dead, unlocked the
 * composer, and reattached to a session that then sat silent. Four minutes
 * still catches a stream that has quietly stopped without erroring.
 */
export const STALL_MS = 240_000;

/** How often the stall watchdog looks. */
export const STALL_CHECK_MS = 10_000;

/**
 * Tools whose result changes what the server already rendered. The document,
 * the preview and the score all come from a server component, so a turn that
 * compiles a PDF halfway through leaves the page beside the chat showing the
 * state from before it — the user watched "PDF ready" scroll past and still
 * had to reload to see the PDF.
 */
const SERVER_STATE_TOOLS = new Set(["analyze_jd", "compile_pdf", "score_ats"]);

/** Whether this event means the page around the chat is now out of date. */
export function changesServerState(event: MessageStreamEvent): boolean {
  if (event.type !== "action.result") return false;
  const result = (event.data as { result?: { toolName?: unknown } } | undefined)?.result;
  return typeof result?.toolName === "string" && SERVER_STATE_TOOLS.has(result.toolName);
}

/**
 * Whether the session's last lifecycle event left a turn running. `turn.started`
 * with nothing after it means work is still in flight.
 */
export function isTurnActive(events: readonly MessageStreamEvent[]): boolean {
  for (let i = events.length - 1; i >= 0; i--) {
    const type = events[i].type;
    if (isTurnBoundary(events[i]) || type.startsWith("turn.")) {
      return type === "turn.started";
    }
  }
  return false;
}

/** The events eve itself treats as the end of a turn (see `send()`'s stream). */
export function isTurnBoundary(event: MessageStreamEvent): boolean {
  return (
    event.type === "session.waiting" ||
    event.type === "session.completed" ||
    event.type === "session.failed"
  );
}

/**
 * Finds the application `analyze_jd` created, by reading the id back out of the
 * stream. An unscoped chat has no application when the turn starts — the agent
 * creates one mid-turn — so this is how the page learns about it, both to link
 * the user to it and to persist the transcript against it.
 *
 * ponytail: a regex over the serialized event, not a typed walk of the tool
 * output. The id only ever appears under this key; give it a schema if a second
 * producer ever appears.
 */
export function findApplicationId(value: unknown): string | undefined {
  try {
    return JSON.stringify(value)?.match(/"applicationId"\s*:\s*"([A-Za-z0-9_-]+)"/)?.[1];
  } catch {
    return undefined; // circular or oversized payload — history just isn't saved
  }
}

export function applicationChatUrl(events: readonly MessageStreamEvent[]): string | undefined {
  const id = findApplicationId(events);
  return id === undefined ? undefined : `/api/applications/${id}/chat`;
}

/** Best-effort snapshot save. A dropped save only ever costs history. */
export function persistSnapshot(url: string, body: Record<string, unknown>): void {
  void fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    // Survives the user navigating away the moment a turn settles.
    keepalive: true,
  }).catch(() => {
    // A dropped save only costs history, never the live conversation.
  });
}
