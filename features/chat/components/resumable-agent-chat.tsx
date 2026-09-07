"use client";

import { useResumableSession } from "../hooks/use-resumable-session";
import type { AgentChatProps } from "../types";
import { AgentChat } from "./agent-chat";

/**
 * The chat as an application page opens it: restored from eve's durable stream,
 * and still following a turn that another page started. See
 * `useResumableSession` for why the saved log alone is not enough.
 */
export function ResumableAgentChat({
  sessionId,
  initialEvents,
  initialSession,
  ...props
}: AgentChatProps & { readonly sessionId?: string }) {
  const savedEvents = initialEvents?.length ? initialEvents : undefined;
  const { following, restored, settled } = useResumableSession({
    persistUrl: props.persistUrl,
    savedEvents,
    sessionId,
  });

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
      // One remount, at the moment the followed turn ends, so the hook rebuilds
      // its store from the complete event log rather than the stale prefix.
      initialEvents={restored?.events ?? savedEvents}
      initialSession={restored?.session ?? initialSession}
      key={following === undefined ? "owned" : "following"}
      liveMessages={following}
    />
  );
}
