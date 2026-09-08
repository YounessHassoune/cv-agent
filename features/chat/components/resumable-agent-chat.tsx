"use client";

import { useCallback, useState } from "react";
import { useResumableSession } from "../hooks/use-resumable-session";
import type { AgentChatProps } from "../types";
import { AgentChat } from "./agent-chat";

/**
 * A chat bound to one eve session, wherever that session is being driven from.
 *
 * The same conversation is open in two places — the landing chat and the
 * application page its run created — so this keeps watching the live stream
 * even while idle, and hands the completed log back to the chat below at every
 * turn boundary. See `useResumableSession`.
 */
export function ResumableAgentChat({
  sessionId,
  initialEvents,
  initialSession,
  onSessionId,
  ...props
}: AgentChatProps & { readonly sessionId?: string }) {
  const savedEvents = initialEvents?.length ? initialEvents : undefined;
  /** True while the chat below is streaming a turn it started itself. */
  const [ownsTurn, setOwnsTurn] = useState(false);
  /*
   * Set only after a dropped stream. It carries the id of the session that was
   * running — which, on the landing page, this component learns from the chat
   * itself rather than from the server — plus a counter, so a second drop
   * re-attaches again instead of being deduped away.
   */
  const [recovery, setRecovery] = useState<{ attempt: number; sessionId: string }>();

  const { following, generation, restored, settled } = useResumableSession({
    attempt: recovery?.attempt ?? 0,
    paused: ownsTurn,
    persistUrl: props.persistUrl,
    savedEvents,
    sessionId: recovery?.sessionId ?? sessionId,
  });

  const handleStreamDropped = useCallback((dropped: string) => {
    setRecovery((current) => ({ attempt: (current?.attempt ?? 0) + 1, sessionId: dropped }));
  }, []);

  if (!settled) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading conversation…
      </div>
    );
  }

  return (
    <AgentChat
      {...props}
      // Remounted at each handback, so the store is rebuilt from the complete
      // event log rather than the prefix it was created with.
      initialEvents={restored?.events ?? savedEvents}
      initialSession={restored?.session ?? initialSession}
      key={`${following === undefined ? "owned" : "following"}:${recovery?.attempt ?? 0}:${generation}`}
      liveMessages={following}
      onBusyChange={setOwnsTurn}
      onSessionId={onSessionId}
      onStreamDropped={handleStreamDropped}
    />
  );
}
