"use client";

import { Client, type ClientSessionState, type MessageStreamEvent } from "eve/client";
import type { EveMessage } from "eve/react";
import { defaultMessageReducer } from "eve/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  changesServerState,
  isTurnActive,
  isTurnBoundary,
  PATIENT_STREAM_RECONNECT,
  persistSnapshot,
  STALL_MS,
} from "../lib/stream";

/**
 * The live follow only ends when the component does. If eve's own reconnects
 * are exhausted the iterator returns, and we open it again — a few times, not
 * forever, so a dead session cannot spin here.
 */
const MAX_REATTACHES = 20;

/** Shortest gap between two server refreshes triggered by tool results. */
const REFRESH_THROTTLE_MS = 1500;

type Options = {
  readonly sessionId?: string;
  /**
   * Bumped by the owner to re-run the attach after a dropped stream, when the
   * session id itself has not changed. Nothing else reads it.
   */
  readonly attempt?: number;
  /**
   * True while the chat below owns the turn: its own store is streaming the
   * same events, so following them here would double up and then fight over
   * the remount. Following resumes, from a fresh snapshot, once it lets go.
   */
  readonly paused?: boolean;
  /** Snapshot the server rendered with, used until the live session answers. */
  readonly savedEvents?: readonly MessageStreamEvent[];
  readonly persistUrl?: string;
};

type Restored = {
  events: readonly MessageStreamEvent[];
  session?: ClientSessionState;
};

/**
 * Restores a conversation from eve's durable stream and then keeps watching it
 * for as long as the page is open.
 *
 * `useEveAgent` only ever streams the turns it starts itself, and one session
 * is open in two places at once here: the landing chat that started the run,
 * and the application page that run created. Whichever of them is not driving
 * has no other way to see what is happening — that is how an answer typed on
 * one page never appeared on the other, how a finished PDF needed a manual
 * refresh, and how a transcript stopped halfway through.
 *
 * So this attaches to the session, projects events with eve's own reducer, and
 * hands a complete log back to the store at every turn boundary — where the
 * page around it is refreshed too, because a turn that ends has usually
 * changed what the server rendered.
 */
export function useResumableSession({
  attempt = 0,
  paused = false,
  sessionId,
  savedEvents,
  persistUrl,
}: Options) {
  const router = useRouter();
  const [restored, setRestored] = useState<Restored>();
  const [settled, setSettled] = useState(false);
  /** Set only while a turn this page does not own is running. */
  const [following, setFollowing] = useState<readonly EveMessage[]>();
  /** Bumped at each handback, to remount the chat on the completed log. */
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setSettled(true);
      return;
    }

    /*
     * The chat below is streaming this turn itself. Stand down rather than
     * render the same events twice from two sources — and drop any live
     * projection we had, or the chat would keep rendering ours instead of its
     * own and never re-enable its composer.
     */
    if (paused) {
      setFollowing(undefined);
      setSettled(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const session = new Client({ host: "" }).sessions.attach(sessionId);

    void (async () => {
      /*
       * Always read the session, even when the server handed us a saved log.
       * That log is only written when a turn settles, so it is exactly the
       * thing that goes stale while a turn is running — trusting it is how a
       * live run looks finished.
       */
      let events: readonly MessageStreamEvent[] = savedEvents ?? [];
      try {
        const snapshot = await session.snapshot({ signal: controller.signal });
        if (cancelled) return;
        events = snapshot.events;
        setRestored({ events, session: snapshot.session });
      } catch {
        // An unreadable session still opens a usable (saved, or empty) composer.
      }
      if (cancelled) return;
      setSettled(true);

      const reducer = defaultMessageReducer();
      let data = events.reduce((acc, event) => reducer.reduce(acc, event), reducer.initial());
      const collected = [...events];
      /*
       * A turn already in flight when we attached — started on the other page,
       * or by this one before a reload. Everything after it goes on screen as
       * it arrives; a session sitting idle shows nothing until one starts.
       */
      let active = isTurnActive(collected);
      let lastRefresh = 0;
      if (active) setFollowing(data.messages);

      const handBack = () => {
        // Nobody else can save this turn: the page that started it may have
        // been closed long before it ended.
        if (persistUrl !== undefined) persistSnapshot(persistUrl, { events: [...collected] });
        setRestored({
          events: [...collected],
          // Cursor at the tail, so the store's next send replays nothing.
          session: { sessionId, streamIndex: collected.length },
        });
        setFollowing(undefined);
        setGeneration((value) => value + 1);
        // A finished turn has usually changed the page around this one — a new
        // PDF, a new score. Without this they only appear on a manual reload.
        router.refresh();
      };

      for (let reattach = 0; reattach < MAX_REATTACHES && !cancelled; reattach++) {
        /*
         * A stream can stop delivering without ever erroring, and eve's
         * reconnects only fire on an error. Give each attach a deadline that
         * every event pushes back: silence past it aborts this connection so
         * the loop opens a fresh one from the same cursor.
         */
        const attach = new AbortController();
        const onOuterAbort = () => attach.abort();
        controller.signal.addEventListener("abort", onOuterAbort, { once: true });
        let deadline = setTimeout(() => attach.abort(), STALL_MS);

        try {
          for await (const event of session.stream({
            signal: attach.signal,
            startIndex: collected.length,
            streamReconnectPolicy: PATIENT_STREAM_RECONNECT,
          })) {
            if (cancelled) return;
            clearTimeout(deadline);
            deadline = setTimeout(() => attach.abort(), STALL_MS);

            collected.push(event);
            data = reducer.reduce(data, event);

            // Same reason as in `useAgentChat`: the PDF and the score are on
            // the page around this chat, and that page is server-rendered.
            if (changesServerState(event)) {
              const now = Date.now();
              if (now - lastRefresh >= REFRESH_THROTTLE_MS) {
                lastRefresh = now;
                router.refresh();
              }
            }

            if (event.type === "turn.started") active = true;
            if (!active) continue;

            setFollowing(data.messages);
            if (isTurnBoundary(event)) {
              active = false;
              handBack();
            }
          }
        } catch {
          // Aborted by the deadline, or dropped outright. Either way the outer
          // loop re-attaches from the cursor and nothing is missed.
        } finally {
          clearTimeout(deadline);
          controller.signal.removeEventListener("abort", onOuterAbort);
        }

        if (cancelled || controller.signal.aborted) return;
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `attempt` re-runs this after a dropped stream on the same session.
  }, [attempt, paused, persistUrl, router, savedEvents, sessionId]);

  return { following, generation, restored, settled };
}
