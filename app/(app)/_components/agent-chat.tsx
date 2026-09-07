"use client";

import type { UserContent } from "ai";
import { Client, type ClientSessionState, type MessageStreamEvent } from "eve/client";
import type { EveMessage } from "eve/react";
import { defaultMessageReducer, useEveAgent } from "eve/react";
import { AlertCircleIcon, ArrowUpRightIcon, SquareIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { cn } from "@/lib/utils";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { AgentMessage, isToolRunning } from "./agent-message";

const AGENT_NAME = "ApplyFlow";

/** How long a cancellation may sit silently before the UI explains itself. */
const SLOW_CANCEL_MS = 6000;

type AgentStatus = ReturnType<typeof useEveAgent>["status"];
type CancellationState = "idle" | "requested" | "cancelling";

type Cancellation = {
  requested: boolean;
  sentTurnId?: string;
  turnId?: string;
};

export type AgentChatProps = {
  /** "page" is the full-height Tailor page; "panel" embeds inside an application. */
  readonly variant?: "page" | "panel";
  readonly heading?: string;
  readonly subheading?: string;
  /** One-tap starter prompts shown while the conversation is empty. */
  readonly suggestions?: string[];
  /** Prefixed to messages sent from a panel so the agent knows the context. */
  readonly contextPrefix?: string;
  readonly placeholder?: string;
  /** Saved stream prefix for this thread, replayed to restore the transcript. */
  readonly initialEvents?: readonly MessageStreamEvent[];
  /** Saved `{ sessionId, streamIndex }` cursor, to continue the same session. */
  readonly initialSession?: ClientSessionState;
  /** Endpoint that stores the snapshot after every settled turn. */
  readonly persistUrl?: string;
  /** Called to abandon a broken thread and begin a fresh session. */
  readonly onResetThread?: () => void | Promise<void>;
  /**
   * Transcript of a turn this component does not own — one started on another
   * page and still running. While set, the chat renders these instead of its
   * own store and refuses to send, because a second turn on a busy session is
   * not a thing the user meant to start.
   */
  readonly liveMessages?: readonly EveMessage[];
  /**
   * Rendered under the composer while the thread is still empty. The landing
   * page uses it to show recent work, so an empty chat is a starting point with
   * context rather than a blank prompt.
   */
  readonly footer?: ReactNode;
};

export function AgentChat({
  variant = "page",
  footer,
  heading = AGENT_NAME,
  subheading = "Paste a job description and say which language you want the CV in. Your master profile is the only source of facts.",
  suggestions = [],
  contextPrefix,
  placeholder = "Send a message…",
  initialEvents,
  initialSession,
  persistUrl,
  onResetThread,
  liveMessages,
}: AgentChatProps = {}) {
  const isPanel = variant === "panel";
  const router = useRouter();
  const [client] = useState(() => new Client({ host: "" }));
  const sessionIdRef = useRef<string | undefined>(undefined);
  const cancellationRef = useRef<Cancellation>({ requested: false });
  const [cancellationError, setCancellationError] = useState<string>();
  const [cancellationState, setCancellationState] = useState<CancellationState>("idle");
  /** A message sent while the agent was working — delivered once it stops. */
  const [queued, setQueued] = useState<UserContent | string>();
  /** The application this conversation created, so the user can go and see it. */
  const [applicationId, setApplicationId] = useState<string>();
  const applicationIdRef = useRef<string>(undefined);

  const cancelTurn = useCallback(
    (turnId: string) => {
      const cancellation = cancellationRef.current;
      if (!cancellation.requested || cancellation.sentTurnId === turnId) {
        return;
      }

      const sessionId = sessionIdRef.current;
      if (sessionId === undefined) {
        // send() not accepted yet — leave sentTurnId unset so onSessionChange
        // can retry the moment the session id arrives, instead of hanging in
        // "cancelling" forever.
        setCancellationState("cancelling");
        return;
      }

      cancellation.sentTurnId = turnId;
      setCancellationState("cancelling");

      void client.sessions
        .attach(sessionId)
        .cancel({ turnId })
        .catch((error: unknown) => {
          if (cancellationRef.current !== cancellation) {
            return;
          }

          cancellation.requested = false;
          cancellation.sentTurnId = undefined;
          setCancellationError(toErrorMessage(error));
          setCancellationState("idle");
        });
    },
    [client],
  );

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

      if (event.type !== "turn.started") {
        return;
      }

      const cancellation = cancellationRef.current;
      cancellation.turnId = event.data.turnId;
      cancelTurn(event.data.turnId);
    },
    [cancelTurn],
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
      const cancellation = cancellationRef.current;
      if (session && cancellation.requested && cancellation.turnId !== undefined) {
        cancelTurn(cancellation.turnId);
      }
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
      void fetch(target, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ events: snapshot.events, session: snapshot.session }),
        // Survives the user navigating away the moment a turn settles.
        keepalive: true,
      }).catch(() => {
        // A dropped save only costs history, never the live conversation.
      });
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
  const lastMessage = messages[messages.length - 1];
  const awaitingFirstToken = isBusy && isBetweenSteps(lastMessage);
  const isEmpty = messages.length === 0;
  const errorMessage = cancellationError ?? agent.error?.message;
  const submitStatus = isBusy && cancellationState !== "idle" ? "submitted" : agent.status;

  const prepareTurn = () => {
    cancellationRef.current = { requested: false };
    setCancellationError(undefined);
    setCancellationState("idle");
  };

  const requestCancellation = () => {
    if (!isBusy || cancellationState !== "idle") {
      return;
    }

    const cancellation = cancellationRef.current;
    cancellation.requested = true;
    setCancellationError(undefined);
    setCancellationState("requested");

    if (cancellation.turnId !== undefined) {
      cancelTurn(cancellation.turnId);
    }
  };

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
    if (!isBusy && cancellationState !== "idle" && queued === undefined) {
      setCancellationState("idle");
    }
  }, [isBusy, cancellationState, queued]);

  /*
   * Cancellation is cooperative: the server stops the turn at its next step
   * boundary, so a request already in flight to a model runs to completion
   * first. That can take another 30 seconds, during which the old UI just sat
   * there looking broken. Say so instead.
   */
  const [cancelSlow, setCancelSlow] = useState(false);
  useEffect(() => {
    if (cancellationState === "idle") {
      setCancelSlow(false);
      return;
    }
    const timer = setTimeout(() => setCancelSlow(true), SLOW_CANCEL_MS);
    return () => clearTimeout(timer);
  }, [cancellationState]);

  /*
   * Only the unscoped chat needs this: inside an application panel the user is
   * already looking at the thing the link would point to.
   */
  const applicationLink =
    applicationId !== undefined && !isPanel ? (
      <Link
        className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors hover:border-foreground/25 hover:bg-secondary"
        href={`/applications/${applicationId}`}
      >
        <span className="min-w-0">
          <span className="block font-medium">
            {isBusy ? "Your application is being prepared" : "Your application is ready"}
          </span>
          <span className="block text-muted-foreground text-xs">
            Open it to read the CV, the match breakdown and download the PDF.
          </span>
        </span>
        <ArrowUpRightIcon className="size-4 shrink-0 text-primary" />
      </Link>
    ) : null;

  /** Plain-language account of what the chat is doing between messages. */
  // Following a turn started elsewhere is plumbing, not news: the transcript
  // streaming in already tells the user the work is happening.
  const activityNote =
    cancellationState !== "idle"
      ? cancelSlow
        ? "Still finishing the step it had already started. It will stop right after."
        : queued !== undefined
          ? "Stopping the current run. Your message goes as soon as it does."
          : "Stopping…"
      : queued !== undefined
        ? "Your message is queued and will send in a moment."
        : undefined;

  const composer = (
    <div className="space-y-2">
      {applicationLink}
      {activityNote ? (
        <p className="flex items-center gap-2 px-1 text-muted-foreground text-xs">
          <SquareIcon className="size-3 shrink-0 animate-pulse fill-current" />
          {activityNote}
        </p>
      ) : null}
      <PromptInput onSubmit={handleSubmit}>
        <PromptInputTextarea placeholder={placeholder} />
        <PromptInputSubmit onStop={requestCancellation} status={submitStatus} />
      </PromptInput>
    </div>
  );

  const suggestionChips =
    suggestions.length > 0 && isEmpty ? (
      <div className={cn("flex flex-wrap gap-2", isPanel ? "justify-start" : "justify-center")}>
        {suggestions.map((suggestion) => (
          <button
            className="rounded-full border bg-card px-3.5 py-2 text-left text-muted-foreground text-xs transition-colors hover:border-foreground/25 hover:bg-secondary hover:text-foreground active:translate-y-px disabled:opacity-50"
            disabled={isBusy}
            key={suggestion}
            onClick={() => void sendSuggestion(suggestion)}
            type="button"
          >
            {suggestion}
          </button>
        ))}
      </div>
    ) : null;

  return (
    <main
      className={cn(
        "flex h-full flex-col overflow-hidden text-foreground",
        isPanel ? "bg-transparent" : "bg-background",
      )}
    >
      {isEmpty || isPanel ? null : (
        <header className="flex h-14 shrink-0 items-center justify-center gap-3 pr-2 pl-4">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-muted-foreground text-sm">{heading}</span>
            <StatusDot status={agent.status} />
          </span>
        </header>
      )}

      {errorMessage ? (
        <div className={cn("mx-auto w-full shrink-0 px-4 pt-2 sm:px-6", isPanel ? "" : "max-w-3xl")}>
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0">
              <p className="font-medium">Request failed</p>
              <p className="mt-0.5 text-muted-foreground">{errorMessage}</p>
              {/* A turn that dies mid-flight can leave this session's history
                  malformed, and every later message then fails the same way.
                  That state is unrecoverable in place — only a new session
                  clears it. */}
              {onResetThread && isStuckThread(errorMessage) ? (
                <button
                  className="mt-2 font-medium text-destructive text-xs underline underline-offset-2"
                  onClick={() => void onResetThread()}
                  type="button"
                >
                  Start a fresh conversation
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isEmpty ? null : (
        <Conversation className="min-h-0 flex-1">
          <ConversationContent
            className={cn(
              "mx-auto w-full gap-6 py-6",
              isPanel ? "px-4" : "max-w-3xl px-4 sm:px-6",
            )}
          >
            {messages.map((message, index) => (
              <AgentMessage
                canRespond={!isBusy}
                isStreaming={
                  agent.status === "streaming" && index === agent.data.messages.length - 1
                }
                key={message.id}
                message={message}
                turnActive={isBusy && index === messages.length - 1}
                onInputResponses={(inputResponses) => {
                  prepareTurn();
                  return agent.respond(inputResponses);
                }}
              />
            ))}

            {awaitingFirstToken ? (
              <Message from="assistant">
                <MessageContent>
                  <Shimmer as="span" className="text-sm">
                    Thinking…
                  </Shimmer>
                </MessageContent>
              </Message>
            ) : null}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}

      {/* Panel: the empty state is a compact intro pinned above the composer.
          Page: it is a centred hero that gives way to the transcript. */}
      {/* Only the empty state grows to fill the panel. Once the transcript is
          on screen it owns the space, so this must shrink to the composer —
          `flex-1` here would otherwise reserve half the panel as blank space. */}
      {isPanel ? (
        <div
          className={cn(
            "flex flex-col gap-3 p-4",
            isEmpty ? "min-h-0 flex-1 justify-end" : "shrink-0",
          )}
        >
          {isEmpty ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="font-medium text-sm">{heading}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{subheading}</p>
              </div>
              {suggestionChips}
            </div>
          ) : null}
          {composer}
        </div>
      ) : (
        <div
          className={cn(
            "mx-auto w-full px-4 sm:px-6",
            isEmpty
              ? "scrollbar-slim flex min-h-0 max-w-2xl flex-1 flex-col items-center justify-center gap-7 overflow-y-auto py-8"
              : "max-w-3xl shrink-0 pb-6",
          )}
        >
          {isEmpty ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <h1 className="font-semibold text-3xl tracking-tight">{heading}</h1>
              <p className="max-w-md text-muted-foreground text-sm leading-relaxed">
                {subheading}
              </p>
            </div>
          ) : null}
          <div className="w-full space-y-4">
            {composer}
            {suggestionChips}
          </div>
          {isEmpty && footer ? <div className="w-full">{footer}</div> : null}
        </div>
      )}
    </main>
  );
}

/**
 * Restores a conversation from eve's durable stream before mounting the chat,
 * and — this is the part that matters — keeps following a turn that is still
 * running.
 *
 * `useEveAgent` streams only the turns it starts itself: `initialEvents` and
 * `initialSession` are read once when it creates its store. So a run started
 * on the Tailor page and then navigated away from would go on working with
 * nothing on screen, and the page around it would still be showing pre-run
 * data when it finished. Here we attach to the live stream instead, project
 * the events ourselves with eve's own reducer, and hand back to the hook at
 * the turn boundary.
 */
export function ResumableAgentChat({
  sessionId,
  initialEvents,
  initialSession,
  ...props
}: AgentChatProps & { readonly sessionId?: string }) {
  const savedEvents = initialEvents?.length ? initialEvents : undefined;
  const router = useRouter();
  const [restored, setRestored] = useState<{
    events: readonly MessageStreamEvent[];
    session?: ClientSessionState;
  }>();
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
        // The iterator also gives up on its own after a run of idle
        // reconnects. A turn can sit silent for over a minute while a
        // subagent writes, so re-attach from where we left off until eve
        // says the turn is over — a few tries, not forever.
        let reachedBoundary = false;
        for (let attempt = 0; attempt < 5 && !reachedBoundary; attempt++) {
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
      if (props.persistUrl !== undefined) {
        void fetch(props.persistUrl, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ events: collected }),
          keepalive: true,
        }).catch(() => {
          // A dropped save only costs a snapshot round trip on the next load.
        });
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
  }, [sessionId, savedEvents, router, props.persistUrl]);

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

/**
 * Whether the session's last lifecycle event left a turn running. `turn.started`
 * with nothing after it means work is still in flight.
 */
function isTurnActive(events: readonly MessageStreamEvent[]): boolean {
  for (let i = events.length - 1; i >= 0; i--) {
    const type = events[i].type;
    if (isTurnBoundary(events[i]) || type.startsWith("turn.")) {
      return type === "turn.started";
    }
  }
  return false;
}

/** The events eve itself treats as the end of a turn (see `send()`'s stream). */
function isTurnBoundary(event: MessageStreamEvent): boolean {
  return (
    event.type === "session.waiting" ||
    event.type === "session.completed" ||
    event.type === "session.failed"
  );
}

/**
 * Whether the agent is thinking rather than doing: no assistant message yet,
 * or its most recent part is already finished. Reading only the tail is what
 * makes this catch the pauses *between* steps — the message is full of
 * completed activity lines, and none of it means anything is happening now.
 */
function isBetweenSteps(message: EveMessage | undefined): boolean {
  if (message === undefined || message.role !== "assistant") return true;

  const tail = message.parts[message.parts.length - 1];
  if (tail === undefined) return true;
  if (tail.type === "step-start") return true;
  if (tail.type === "text") return tail.text.trim().length === 0;
  return !isToolRunning(tail);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to cancel the response.";
}

/**
 * Marks the failures that repeat forever on the same session rather than being
 * worth a retry — an empty model reply, which is what a provider returns when
 * it rejects the stored history outright.
 */
function isStuckThread(message: string | undefined): boolean {
  if (!message) return false;
  return /did not return a response|empty response|no response/i.test(message);
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
function findApplicationId(value: unknown): string | undefined {
  try {
    return JSON.stringify(value)?.match(/"applicationId"\s*:\s*"([A-Za-z0-9_-]+)"/)?.[1];
  } catch {
    return undefined; // circular or oversized payload — history just isn't saved
  }
}

function applicationChatUrl(events: readonly MessageStreamEvent[]): string | undefined {
  const id = findApplicationId(events);
  return id === undefined ? undefined : `/api/applications/${id}/chat`;
}

function StatusDot({ status }: { readonly status: AgentStatus }) {
  const isLive = status === "submitted" || status === "streaming";
  const tone =
    status === "error"
      ? "bg-destructive"
      : isLive
        ? "bg-emerald-500"
        : status === "ready"
          ? "bg-muted-foreground"
          : "bg-muted-foreground/50";

  return (
    <span className="relative flex size-1">
      {isLive ? (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-75",
            tone,
          )}
        />
      ) : null}
      <span className={cn("relative inline-flex size-1 rounded-full transition-colors", tone)} />
    </span>
  );
}
