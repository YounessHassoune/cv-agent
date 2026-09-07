import type { MessageStreamEvent } from "eve/client";

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
