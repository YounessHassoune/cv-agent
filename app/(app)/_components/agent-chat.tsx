"use client";

import type { UserContent } from "ai";
import { Client, type ClientSessionState, type MessageStreamEvent } from "eve/client";
import { useEveAgent } from "eve/react";
import { AlertCircleIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { AgentMessage } from "./agent-message";

const AGENT_NAME = "ApplyFlow";

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
};

export function AgentChat({
  variant = "page",
  heading = AGENT_NAME,
  subheading = "Paste a job description and say which language you want the CV in. Your master profile is the only source of facts.",
  suggestions = [],
  contextPrefix,
  placeholder = "Send a message…",
  initialEvents,
  initialSession,
  persistUrl,
  onResetThread,
}: AgentChatProps = {}) {
  const isPanel = variant === "panel";
  const [client] = useState(() => new Client({ host: "" }));
  const sessionIdRef = useRef<string | undefined>(undefined);
  const cancellationRef = useRef<Cancellation>({ requested: false });
  const [cancellationError, setCancellationError] = useState<string>();
  const [cancellationState, setCancellationState] = useState<CancellationState>("idle");

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
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const isEmpty = agent.data.messages.length === 0;
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

  const sendSuggestion = async (text: string) => {
    if (isBusy) return;
    prepareTurn();
    await agent.send(withContext(text));
  };

  const handleSubmit = async (message: PromptInputMessage) => {
    const text = message.text.trim();
    if ((text.length === 0 && message.files.length === 0) || isBusy) return;

    prepareTurn();

    if (message.files.length === 0) {
      await agent.send(withContext(text));
      return;
    }

    const parts: UserContent = [];
    if (text.length > 0) {
      parts.push({ text: withContext(text), type: "text" });
    }
    for (const file of message.files) {
      parts.push({
        data: file.url,
        filename: file.filename,
        mediaType: file.mediaType,
        type: "file",
      });
    }

    await agent.send(parts);
  };

  const composer = (
    <PromptInput onSubmit={handleSubmit}>
      <PromptInputTextarea placeholder={placeholder} />
      <PromptInputSubmit onStop={requestCancellation} status={submitStatus} />
    </PromptInput>
  );

  const suggestionChips =
    suggestions.length > 0 && isEmpty ? (
      <div className={cn("flex flex-wrap gap-2", isPanel ? "justify-start" : "justify-center")}>
        {suggestions.map((suggestion) => (
          <button
            className="rounded-full border bg-card px-3 py-1.5 text-left text-muted-foreground text-xs transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
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
            {agent.data.messages.map((message, index) => (
              <AgentMessage
                canRespond={!isBusy}
                isStreaming={
                  agent.status === "streaming" && index === agent.data.messages.length - 1
                }
                key={message.id}
                message={message}
                onInputResponses={(inputResponses) => {
                  prepareTurn();
                  return agent.respond(inputResponses);
                }}
              />
            ))}
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
              ? "flex max-w-2xl flex-1 flex-col items-center justify-center gap-8 pb-[10vh]"
              : "max-w-3xl shrink-0 pb-6",
          )}
        >
          {isEmpty ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <h1 className="font-medium text-4xl tracking-tighter sm:text-5xl">{heading}</h1>
              <p className="max-w-md text-muted-foreground text-sm leading-relaxed">
                {subheading}
              </p>
            </div>
          ) : null}
          <div className="w-full space-y-4">
            {composer}
            {suggestionChips}
          </div>
        </div>
      )}
    </main>
  );
}

/**
 * Restores a conversation from eve's durable stream before mounting the chat.
 *
 * The saved `chatEvents` snapshot only exists once a turn settles, so a run
 * that errored or was cancelled leaves an application with a session id but no
 * transcript. `snapshot()` reads the events back from the session itself, which
 * is the source of truth either way. `useEveAgent` reads `initialEvents` when
 * it creates its store, so the chat must not mount until this resolves.
 */
export function ResumableAgentChat({
  sessionId,
  initialEvents,
  initialSession,
  ...props
}: AgentChatProps & { readonly sessionId?: string }) {
  const savedEvents = initialEvents?.length ? initialEvents : undefined;
  const [restored, setRestored] = useState<{
    events: readonly MessageStreamEvent[];
    session?: ClientSessionState;
  }>();
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    // Nothing to restore: a fresh thread, or the server already had the events.
    if (!sessionId || savedEvents) {
      setSettled(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    void new Client({ host: "" }).sessions
      .attach(sessionId)
      .snapshot({ signal: controller.signal })
      .then((snapshot) => {
        if (cancelled) return;
        setRestored({ events: snapshot.events, session: snapshot.session });
      })
      .catch(() => {
        // An unreadable session still opens a usable (empty) composer.
      })
      .finally(() => {
        if (!cancelled) setSettled(true);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionId, savedEvents]);

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
      initialEvents={savedEvents ?? restored?.events}
      initialSession={restored?.session ?? initialSession}
    />
  );
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
 * Finds the application `analyze_jd` created during this turn by reading the
 * id back out of the stream, so an unscoped chat can persist itself to it.
 */
function applicationChatUrl(events: readonly MessageStreamEvent[]): string | undefined {
  try {
    const match = JSON.stringify(events).match(/"applicationId"\s*:\s*"([A-Za-z0-9_-]+)"/);
    return match ? `/api/applications/${match[1]}/chat` : undefined;
  } catch {
    return undefined; // circular or oversized payload — history just isn't saved
  }
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
