"use client";

import type { UserContent } from "ai";
import { Client, type MessageStreamEvent } from "eve/client";
import { useEveAgent } from "eve/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { readAnswers, type StoredAnswers, writeAnswers } from "../lib/answers";
import { isBetweenSteps } from "../lib/messages";
import {
  applicationChatUrl,
  findApplicationId,
  PATIENT_STREAM_RECONNECT,
  persistSnapshot,
  STALL_CHECK_MS,
  STALL_MS,
} from "../lib/stream";
import type { AgentChatProps } from "../types";
import { type CancellationState, useCancellation } from "./use-cancellation";

type Options = Pick<
  AgentChatProps,
  | "contextPrefix"
  | "initialEvents"
  | "initialSession"
  | "liveMessages"
  | "onBusyChange"
  | "onSessionId"
  | "onStreamDropped"
  | "persistUrl"
>;

/** Every turn this hook starts rides the patient reconnect policy. */
const STREAM_OPTIONS = { streamReconnectPolicy: PATIENT_STREAM_RECONNECT } as const;

/**
 * Events that mean the server has handed control back to the user, whatever
 * the client store's own status says. `input.requested` belongs here: a
 * question *is* the agent stopping to wait for us.
 *
 * The store tracks one stream, and a turn that the runtime executes twice —
 * one copy dying on a transient model error while the other finishes — leaves
 * it streaming forever. Reading the lifecycle ourselves means the composer,
 * the stop button and the question buttons unlock on the turn's real end
 * rather than on a status that never arrives.
 */
const TURN_SETTLED_EVENTS: ReadonlySet<string> = new Set([
  "turn.completed",
  "turn.failed",
  "session.waiting",
  "input.requested",
]);

/**
 * Everything the chat *does*, with none of what it looks like: the eve session,
 * the cancel-and-requeue dance around a busy agent, and the application the
 * agent creates mid-turn. The component above it only renders the result.
 */
export function useAgentChat({
  contextPrefix,
  initialEvents,
  initialSession,
  liveMessages,
  onBusyChange,
  onSessionId,
  onStreamDropped,
  persistUrl,
}: Options) {
  const router = useRouter();
  const [client] = useState(() => new Client({ host: "" }));
  const sessionIdRef = useRef<string | undefined>(undefined);
  const cancellation = useCancellation({ client, sessionIdRef });
  /**
   * Whether a turn of ours is still running, read from the stream's own
   * lifecycle events rather than inferred from the store's status.
   */
  const [turnOpen, setTurnOpen] = useState(false);
  /** A message sent while the agent was working — delivered once it stops. */
  const [queued, setQueued] = useState<UserContent | string>();
  /*
   * The application this conversation created, so the user can go and see it.
   * Seeded from the replayed log: this store is rebuilt whenever a turn is
   * handed back to it, and reading only the live stream lost the link every
   * time — right at the moment the run finished and the user wanted it.
   */
  const [applicationId, setApplicationId] = useState<string | undefined>(() =>
    findApplicationId(initialEvents),
  );
  const applicationIdRef = useRef<string | undefined>(applicationId);

  /** When the stream last produced anything, for the stall watchdog below. */
  const lastEventAtRef = useRef(Date.now());
  /** Answers this browser gave, which the server stream does not record. */
  const [answers, setAnswers] = useState<StoredAnswers>({});

  // Reads storage, so it cannot run during render on the server.
  useEffect(() => {
    setAnswers(readAnswers(initialSession?.sessionId ?? sessionIdRef.current));
  }, [initialSession?.sessionId]);

  const { noteTurnStarted, reset: resetCancellation, retryPending } = cancellation;

  const handleEvent = useCallback(
    (event: MessageStreamEvent) => {
      lastEventAtRef.current = Date.now();

      // The application appears mid-turn, the moment `analyze_jd` returns —
      // surface it as soon as it does rather than waiting for the turn to end.
      if (applicationIdRef.current === undefined) {
        const found = findApplicationId(event);
        if (found !== undefined) {
          applicationIdRef.current = found;
          setApplicationId(found);
        }
      }

      if (event.type === "turn.started") {
        setTurnOpen(true);
        noteTurnStarted(event.data.turnId);
        return;
      }

      // Anything that hands control back ends the turn for us, even when the
      // store keeps streaming a copy of it that will never finish.
      if (TURN_SETTLED_EVENTS.has(event.type)) setTurnOpen(false);
    },
    [noteTurnStarted],
  );

  const agent = useEveAgent({
    // Replayed history. The store dedupes by `meta.id`, so an overlap between
    // the saved prefix and the resumed stream renders only once.
    initialEvents: initialEvents ?? [],
    initialSession,
    onEvent: handleEvent,
    onSessionChange(session) {
      sessionIdRef.current = session?.sessionId;
      // The page above may store this, so a reload rejoins the same thread
      // instead of opening an empty one over a session still on the server.
      if (session?.sessionId) onSessionId?.(session.sessionId);
      // A cancel requested before send() was accepted is still pending — fire
      // it now that the session id is known.
      if (session) retryPending();
    },
    onFinish(snapshot) {
      setTurnOpen(false);

      /*
       * The application page is server-rendered, so a turn that just compiled
       * a PDF and scored it leaves the panel around it showing the state from
       * before the run. Without this the user has to reload to see their own
       * results — which is exactly what they were doing.
       */
      router.refresh();

      // The Tailor page has no application yet when the turn starts — the
      // agent creates one mid-turn — so fall back to the id `analyze_jd`
      // reported. Without this the transcript is lost and the application
      // opens with an empty chat that only fills in after another message.
      const target = persistUrl ?? applicationChatUrl(snapshot.events);
      if (!target) return;
      persistSnapshot(target, { events: snapshot.events, session: snapshot.session });
    },
  });

  const isFollowing = liveMessages !== undefined;
  const messages = liveMessages ?? agent.data.messages;
  const isStreaming = agent.status === "submitted" || agent.status === "streaming";
  /*
   * Busy means "the server owes us a turn", and both halves of that matter.
   * The status alone used to be enough — until a turn the runtime ran twice
   * left the store streaming a dead copy, which froze the composer, the stop
   * button and the agent's own question with no way back but a reload.
   */
  const isBusy = isFollowing || (isStreaming && turnOpen);
  /** This chat is driving the session, as opposed to watching someone else. */
  const ownsTurn = !isFollowing && isStreaming;

  // The owner watches the same session from outside; tell it to stand down
  // while we are the ones streaming, so the transcript has a single source.
  useEffect(() => {
    onBusyChange?.(ownsTurn);
  }, [onBusyChange, ownsTurn]);
  /*
   * The agent goes quiet for tens of seconds at a time — before its first
   * event, and again between steps while it decides what to do next. Both gaps
   * used to render as a frozen screen. This fills every one of them and clears
   * the moment a step starts or text begins arriving.
   */
  const awaitingFirstToken = isBusy && isBetweenSteps(messages[messages.length - 1]);
  const isEmpty = messages.length === 0;

  const prepareTurn = useCallback(() => {
    setTurnOpen(true);
    resetCancellation();
  }, [resetCancellation]);
  const requestCancellation = () => cancellation.request(isBusy);

  /** In a panel the first message carries the application context. */
  const withContext = (text: string) =>
    contextPrefix && isEmpty ? `${contextPrefix}\n\n${text}` : text;

  /**
   * Never awaited. `send()` resolves when the whole turn finishes, and the
   * composer only clears once its submit handler settles — awaiting it leaves
   * the user staring at their own text for the length of the run.
   */
  const dispatch = (payload: UserContent | string) => {
    prepareTurn();
    /*
     * Claim the turn before the request leaves, not after the first event
     * arrives. The owner is watching the same session; told late, it would see
     * our own `turn.started` first and remount this chat mid-send.
     */
    onBusyChange?.(true);
    void agent.send(payload, STREAM_OPTIONS);
  };

  const sendSuggestion = (text: string) => {
    if (isBusy) return;
    dispatch(withContext(text));
  };

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (text.length === 0 && message.files.length === 0) return;

    let payload: UserContent | string = withContext(text);
    if (message.files.length > 0) {
      const parts: UserContent = [];
      if (text.length > 0) parts.push({ text: withContext(text), type: "text" });
      for (const file of message.files) {
        parts.push({
          data: file.url,
          filename: file.filename,
          mediaType: file.mediaType,
          type: "file",
        });
      }
      payload = parts;
    }

    /*
     * Sending mid-run means "stop and listen to me" — usually the user asking
     * for a correction they have just spotted. Queue the message, stop the
     * turn, and deliver it once the cancellation lands. Dropping it (the old
     * behaviour) looked like the app had ignored them.
     */
    if (isFollowing) return; // the composer is disabled; nothing to queue against
    if (isBusy) {
      setQueued(payload);
      requestCancellation();
      return;
    }

    dispatch(payload);
  };

  const respond = (inputResponses: Parameters<typeof agent.respond>[0]) => {
    prepareTurn();
    onBusyChange?.(true);
    // eve keeps no record of an answer, so remember it here before sending —
    // otherwise a reload replays the question as if it were never answered.
    setAnswers(writeAnswers(sessionIdRef.current, [...inputResponses]));
    return agent.respond(inputResponses, STREAM_OPTIONS);
  };

  /*
   * The stream ended but no lifecycle event said the turn was over: the
   * connection died under a run that is still going. Everything the agent
   * produces from here lands in eve's durable stream and nowhere on screen —
   * which is exactly how a finished CV ended up visible on its application
   * page while this chat still showed "Tailoring your CV…". Hand the session
   * id up so the owner can re-attach and follow the rest.
   */
  useEffect(() => {
    if (isFollowing || !turnOpen || isStreaming) return;
    const sessionId = sessionIdRef.current;
    if (sessionId === undefined) return;
    setTurnOpen(false);
    onStreamDropped?.(sessionId);
  }, [isFollowing, isStreaming, onStreamDropped, turnOpen]);

  /*
   * The other half of a dead stream: the connection stays open and simply
   * stops delivering. Nothing errors, so the store sits in `streaming` and the
   * transcript freezes mid-run — the last few steps of a finished job only
   * appearing on a manual reload. The longest real gap in a run is a subagent
   * writing a CV, well under a minute, so silence past `STALL_MS` means the
   * connection is gone and re-attaching is the only way to see the rest.
   */
  useEffect(() => {
    if (isFollowing || !turnOpen || !isStreaming) return;

    const timer = setInterval(() => {
      if (Date.now() - lastEventAtRef.current < STALL_MS) return;
      const sessionId = sessionIdRef.current;
      if (sessionId === undefined) return;
      lastEventAtRef.current = Date.now();
      setTurnOpen(false);
      onStreamDropped?.(sessionId);
    }, STALL_CHECK_MS);

    return () => clearInterval(timer);
  }, [isFollowing, isStreaming, onStreamDropped, turnOpen]);

  // The queued message goes the moment the agent is free again.
  useEffect(() => {
    if (queued === undefined || isBusy) return;
    setQueued(undefined);
    dispatch(queued);
    // `dispatch` is stable enough here: it only closes over `agent`, which the
    // hook keeps identity-stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queued, isBusy]);

  // A settled turn ends the cancellation, whatever the outcome.
  useEffect(() => {
    if (!isBusy && cancellation.state !== "idle" && queued === undefined) {
      cancellation.settle();
    }
  }, [isBusy, cancellation.state, cancellation.settle, queued]);

  return {
    /** The application the agent created mid-turn, once it has reported one. */
    applicationId,
    /** Answers given in this browser, keyed by the question's request id. */
    answers,
    awaitingFirstToken,
    /*
     * An unanswered question is the one thing that is always actionable: the
     * agent asked it and stopped. Gating it on `isBusy` — as this used to —
     * meant a stuck busy flag also locked the only control that could clear
     * it. Only a turn owned by another page is off limits.
     */
    canRespond: !isFollowing,
    errorMessage: cancellation.error ?? agent.error?.message,
    handleSubmit,
    isBusy,
    isEmpty,
    messages,
    requestCancellation,
    respond,
    sendSuggestion,
    status: agent.status,
    /** Index of the message the hook is streaming into, if any. */
    streamingIndex: agent.status === "streaming" ? agent.data.messages.length - 1 : null,
    submitStatus: isBusy && cancellation.state !== "idle" ? ("submitted" as const) : agent.status,
    /** Plain-language account of what the chat is doing between messages. */
    activityNote: describeActivity(cancellation.state, cancellation.isSlow, queued !== undefined),
  };
}

/**
 * Following a turn started elsewhere is plumbing, not news: the transcript
 * streaming in already tells the user the work is happening. Only stopping and
 * queueing get a line.
 */
function describeActivity(
  state: CancellationState,
  isSlow: boolean,
  hasQueued: boolean,
): string | undefined {
  if (state !== "idle") {
    if (isSlow) return "Still finishing the step it had already started. It will stop right after.";
    if (hasQueued) return "Stopping the current run. Your message goes as soon as it does.";
    return "Stopping…";
  }
  return hasQueued ? "Your message is queued and will send in a moment." : undefined;
}
