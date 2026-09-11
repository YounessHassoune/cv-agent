"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { ChatLockedNotice } from "@/components/chat-locked-notice";
import { usePlan } from "@/components/plan-provider";
import { ResumableAgentChat } from "@/features/chat";

type Props = {
  /** Scoped per user, so signing in as someone else never inherits a thread. */
  readonly storageKey: string;
  readonly heading: string;
  readonly subheading: string;
  readonly suggestions: string[];
  readonly footer?: ReactNode;
};

function readStored(key: string): string | undefined {
  try {
    return window.localStorage.getItem(key) ?? undefined;
  } catch {
    // Private mode, or storage disabled. A fresh thread still works.
    return undefined;
  }
}

/**
 * The landing chat, remembered across reloads.
 *
 * This page owns no database row — an application only exists once the agent
 * calls `analyze_jd`, which it does *after* it has asked what language you
 * want. Everything before that point lived in one browser tab: a reload, or a
 * turn the client lost track of, orphaned a live session on the server and
 * left the user staring at an empty composer with no way back to it.
 *
 * The session id is the whole thread — eve keeps the durable stream — so
 * storing that one string is enough to reopen the conversation, question and
 * all, exactly where it stopped.
 */
export function HomeChat({ footer, heading, storageKey, subheading, suggestions }: Props) {
  const plan = usePlan();
  const [sessionId, setSessionId] = useState<string>();
  /** Storage is client-only, so the first paint must wait for it. */
  const [loaded, setLoaded] = useState(false);
  /** Bumped by "new chat", to remount a thread that has the same (empty) id. */
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    setSessionId(readStored(storageKey));
    setLoaded(true);
  }, [storageKey]);

  /*
   * Deliberately not state: the id arrives mid-turn, and re-rendering this
   * component with a new `key` would unmount the chat that is streaming.
   * Storage is for the *next* load.
   */
  const remember = useCallback(
    (id: string) => {
      try {
        window.localStorage.setItem(storageKey, id);
      } catch {
        // Nothing to do — the thread just won't survive this reload.
      }
    },
    [storageKey],
  );

  const startFresh = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignored: the remount below is what the user actually asked for.
    }
    setSessionId(undefined);
    setGeneration((value) => value + 1);
  }, [storageKey]);

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading conversation…
      </div>
    );
  }

  return (
    <ResumableAgentChat
      footer={footer}
      /* Checked here as well as on the server: the proxy refuses the turn
         either way, and this is what stops the user finding that out by
         watching nothing happen. */
      /*
       * The second case is the one that actually bit. Once a free account has
       * spent its application, this thread is attached to that application, so
       * every follow-up is refused as paid chat — and a brand new thread would
       * only reach the agent to be told the allowance is gone. Either way the
       * composer was accepting messages that could not go anywhere.
       */
      lockedNotice={
        plan.usage.agentTurns >= plan.limits.agentTurns ? (
          <ChatLockedNotice reason="turns" />
        ) : !plan.can("applicationChat") && plan.usage.applications >= plan.limits.applications ? (
          <ChatLockedNotice reason="applications" />
        ) : undefined
      }
      heading={heading}
      key={`${sessionId ?? "fresh"}:${generation}`}
      onResetThread={startFresh}
      onSessionId={remember}
      sessionId={sessionId}
      subheading={subheading}
      suggestions={suggestions}
    />
  );
}
