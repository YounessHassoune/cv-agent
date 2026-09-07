"use client";

import type { UserContent } from "ai";
import { Client, type MessageStreamEvent } from "eve/client";
import { useEveAgent } from "eve/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { isBetweenSteps } from "../lib/messages";
import { applicationChatUrl, findApplicationId, persistSnapshot } from "../lib/stream";
import type { AgentChatProps } from "../types";
import { type CancellationState, useCancellation } from "./use-cancellation";

type Options = Pick<
  AgentChatProps,
  "contextPrefix" | "initialEvents" | "initialSession" | "liveMessages" | "persistUrl"
>;

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
  persistUrl,
}: Options) {
  const router = useRouter();
  const [client] = useState(() => new Client({ host: "" }));
  const sessionIdRef = useRef<string | undefined>(undefined);
  const cancellation = useCancellation({ client, sessionIdRef });
  /** A message sent while the agent was working — delivered once it stops. */
  const [queued, setQueued] = useState<UserContent | string>();
  /** The application this conversation created, so the user can go and see it. */
  const [applicationId, setApplicationId] = useState<string>();
  const applicationIdRef = useRef<string>(undefined);

  const { noteTurnStarted, retryPending } = cancellation;

  const handleEvent = useCallback(
    (event: MessageStreamEvent) => {
      // The application appears mid-turn, the moment `analyze_jd` returns —
      // surface it as soon as it does rather than waiting for the turn to end.
      if (applicationIdRef.current === undefined) {
        const found = findApplicationId(event);
        if (found !== undefined) {
          applicationIdRef.current = found;
          setApplicationId(found);
        }
      }

      if (event.type !== "turn.started") return;
      noteTurnStarted(event.data.turnId);
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
      // A cancel requested before send() was accepted is still pending — fire
      // it now that the session id is known.
      if (session) retryPending();
    },
    onFinish(snapshot) {
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
  const isBusy = isFollowing || agent.status === "submitted" || agent.status === "streaming";
  /*
   * The agent goes quiet for tens of seconds at a time — before its first
   * event, and again between steps while it decides what to do next. Both gaps
   * used to render as a frozen screen. This fills every one of them and clears
   * the moment a step starts or text begins arriving.
   */
  const awaitingFirstToken = isBusy && isBetweenSteps(messages[messages.length - 1]);
  const isEmpty = messages.length === 0;

  const prepareTurn = cancellation.reset;
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
    void agent.send(payload);
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
    return agent.respond(inputResponses);
  };

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
    awaitingFirstToken,
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
