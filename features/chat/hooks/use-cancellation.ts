"use client";

import type { Client } from "eve/client";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { toErrorMessage } from "../lib/errors";

/** How long a cancellation may sit silently before the UI explains itself. */
const SLOW_CANCEL_MS = 6000;

export type CancellationState = "idle" | "requested" | "cancelling";

type Cancellation = {
  requested: boolean;
  sentTurnId?: string;
  turnId?: string;
};

type Options = {
  readonly client: Client;
  readonly sessionIdRef: RefObject<string | undefined>;
};

/**
 * Owns "stop that turn". Cancellation is cooperative and racy in two ways: the
 * request can arrive before `send()` has been accepted (no session id yet), and
 * the server only stops at its next step boundary. Both are handled here so the
 * chat component only sees a state and a note to render.
 */
export function useCancellation({ client, sessionIdRef }: Options) {
  const ref = useRef<Cancellation>({ requested: false });
  const [error, setError] = useState<string>();
  const [state, setState] = useState<CancellationState>("idle");
  const [isSlow, setIsSlow] = useState(false);

  const cancelTurn = useCallback(
    (turnId: string) => {
      const cancellation = ref.current;
      if (!cancellation.requested || cancellation.sentTurnId === turnId) {
        return;
      }

      const sessionId = sessionIdRef.current;
      if (sessionId === undefined) {
        // send() not accepted yet — leave sentTurnId unset so onSessionChange
        // can retry the moment the session id arrives, instead of hanging in
        // "cancelling" forever.
        setState("cancelling");
        return;
      }

      cancellation.sentTurnId = turnId;
      setState("cancelling");

      void client.sessions
        .attach(sessionId)
        .cancel({ turnId })
        .catch((cause: unknown) => {
          if (ref.current !== cancellation) {
            return;
          }

          cancellation.requested = false;
          cancellation.sentTurnId = undefined;
          setError(toErrorMessage(cause));
          setState("idle");
        });
    },
    [client, sessionIdRef],
  );

  /** A fresh turn starts from a clean slate. */
  const reset = useCallback(() => {
    ref.current = { requested: false };
    setError(undefined);
    setState("idle");
  }, []);

  const request = useCallback(
    (isBusy: boolean) => {
      if (!isBusy || state !== "idle") return;

      const cancellation = ref.current;
      cancellation.requested = true;
      setError(undefined);
      setState("requested");

      if (cancellation.turnId !== undefined) {
        cancelTurn(cancellation.turnId);
      }
    },
    [cancelTurn, state],
  );

  /** The turn id only becomes known when the server announces it. */
  const noteTurnStarted = useCallback(
    (turnId: string) => {
      ref.current.turnId = turnId;
      cancelTurn(turnId);
    },
    [cancelTurn],
  );

  /** Fires a cancel that was requested before the session id existed. */
  const retryPending = useCallback(() => {
    const cancellation = ref.current;
    if (cancellation.requested && cancellation.turnId !== undefined) {
      cancelTurn(cancellation.turnId);
    }
  }, [cancelTurn]);

  /** A settled turn ends the cancellation, whatever the outcome. */
  const settle = useCallback(() => setState("idle"), []);

  /*
   * The server stops the turn at its next step boundary, so a request already
   * in flight to a model runs to completion first. That can take another 30
   * seconds, during which the old UI just sat there looking broken. Say so.
   */
  useEffect(() => {
    if (state === "idle") {
      setIsSlow(false);
      return;
    }
    const timer = setTimeout(() => setIsSlow(true), SLOW_CANCEL_MS);
    return () => clearTimeout(timer);
  }, [state]);

  return { error, isSlow, noteTurnStarted, request, reset, retryPending, settle, state };
}
