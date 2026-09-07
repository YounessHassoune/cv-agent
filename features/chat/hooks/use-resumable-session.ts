"use client";

import { Client, type ClientSessionState, type MessageStreamEvent } from "eve/client";
import type { EveMessage } from "eve/react";
import { defaultMessageReducer } from "eve/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { isTurnActive, isTurnBoundary, persistSnapshot } from "../lib/stream";

/**
 * A turn can sit silent for over a minute while a subagent writes, and the
 * stream iterator gives up on its own after a run of idle reconnects. Re-attach
 * from where we left off until eve says the turn is over — a few tries, not
 * forever.
 */
const MAX_REATTACHES = 5;

type Options = {
  readonly sessionId?: string;
  /** Snapshot the server rendered with, used until the live session answers. */
  readonly savedEvents?: readonly MessageStreamEvent[];
  readonly persistUrl?: string;
};

type Restored = {
  events: readonly MessageStreamEvent[];
  session?: ClientSessionState;
};

/**
 * Restores a conversation from eve's durable stream, and — this is the part
 * that matters — keeps following a turn that is still running.
 *
 * `useEveAgent` streams only the turns it starts itself: `initialEvents` and
 * `initialSession` are read once when it creates its store. So a run started on
 * the Tailor page and then navigated away from would go on working with nothing
 * on screen, and the page around it would still be showing pre-run data when it
 * finished. Here we attach to the live stream instead, project the events
 * ourselves with eve's own reducer, and hand back to the hook at the turn
 * boundary.
 */
export function useResumableSession({ sessionId, savedEvents, persistUrl }: Options) {
  const router = useRouter();
  const [restored, setRestored] = useState<Restored>();
  const [settled, setSettled] = useState(false);
  /** Set only while a turn belonging to another page is still running. */
  const [following, setFollowing] = useState<readonly EveMessage[]>();

  useEffect(() => {
    if (!sessionId) {
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

      if (!isTurnActive(events)) return;

      // Project the live tail with eve's own reducer so the transcript looks
      // identical to the one the hook would have built.
      const reducer = defaultMessageReducer();
      let data = events.reduce((acc, event) => reducer.reduce(acc, event), reducer.initial());
      const collected = [...events];
      setFollowing(data.messages);

      /*
       * `session.stream()` follows forever: unlike `send()`, it does not stop
       * at the turn boundary but reconnects and waits for the next turn. Left
       * alone, this loop never ended — no save, no refresh, a composer that
       * stayed disabled until the user reloaded. Break on eve's own boundary
       * events and drop the connection ourselves.
       */
      const follower = new AbortController();
      const onAbort = () => follower.abort();
      controller.signal.addEventListener("abort", onAbort, { once: true });
      try {
        let reachedBoundary = false;
        for (let attempt = 0; attempt < MAX_REATTACHES && !reachedBoundary; attempt++) {
          for await (const event of session.stream({
            startIndex: collected.length,
            signal: follower.signal,
          })) {
            if (cancelled) return;
            collected.push(event);
            data = reducer.reduce(data, event);
            setFollowing(data.messages);
            if (isTurnBoundary(event)) {
              reachedBoundary = true;
              break;
            }
          }
          if (cancelled || follower.signal.aborted) return;
        }
      } catch {
        // A dropped follow just means the transcript stops updating; the hand
        // back below still runs and the turn keeps going on the server.
      } finally {
        follower.abort();
        controller.signal.removeEventListener("abort", onAbort);
      }
      if (cancelled) return;

      // The turn ended. Nobody else can save it — the page that started it
      // unmounted long ago, so its `onFinish` never ran.
      if (persistUrl !== undefined) {
        persistSnapshot(persistUrl, { events: collected });
      }

      // Hand the completed transcript to the hook, and pull the server-rendered
      // page around us up to date with what the run produced.
      // Cursor at the tail, so the hook's next send does not replay the run.
      setRestored({ events: collected, session: { sessionId, streamIndex: collected.length } });
      setFollowing(undefined);
      router.refresh();
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionId, savedEvents, router, persistUrl]);

  return { following, restored, settled };
}
