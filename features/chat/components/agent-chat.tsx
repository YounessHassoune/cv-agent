"use client";

import { cn } from "@/lib/utils";
import { useAgentChat } from "../hooks/use-agent-chat";
import { AGENT_NAME, type AgentChatProps, DEFAULT_SUBHEADING } from "../types";
import { ChatComposer } from "./chat-composer";
import { ChatError } from "./chat-error";
import { ChatTranscript } from "./chat-transcript";
import { StatusDot } from "./status-dot";
import { SuggestionChips } from "./suggestion-chips";

export function AgentChat({
  variant = "page",
  footer,
  heading = AGENT_NAME,
  subheading = DEFAULT_SUBHEADING,
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
  const chat = useAgentChat({
    contextPrefix,
    initialEvents,
    initialSession,
    liveMessages,
    persistUrl,
  });

  const composer = (
    <ChatComposer
      activityNote={chat.activityNote}
      /* Only the unscoped chat needs the link: inside an application panel the
         user is already looking at the thing it would point to. */
      applicationId={isPanel ? undefined : chat.applicationId}
      isBusy={chat.isBusy}
      onStop={chat.requestCancellation}
      onSubmit={chat.handleSubmit}
      placeholder={placeholder}
      status={chat.submitStatus}
    />
  );

  const suggestionChips = chat.isEmpty ? (
    <SuggestionChips
      align={isPanel ? "start" : "center"}
      disabled={chat.isBusy}
      onSelect={chat.sendSuggestion}
      suggestions={suggestions}
    />
  ) : null;

  return (
    <main
      className={cn(
        "flex h-full flex-col overflow-hidden text-foreground",
        isPanel ? "bg-transparent" : "bg-background",
      )}
    >
      {chat.isEmpty || isPanel ? null : (
        <header className="flex h-14 shrink-0 items-center justify-center gap-3 pr-2 pl-4">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-muted-foreground text-sm">{heading}</span>
            <StatusDot status={chat.status} />
          </span>
        </header>
      )}

      {chat.errorMessage ? (
        <div className={cn("mx-auto w-full shrink-0 px-4 pt-2 sm:px-6", isPanel ? "" : "max-w-3xl")}>
          <ChatError message={chat.errorMessage} onResetThread={onResetThread} />
        </div>
      ) : null}

      {chat.isEmpty ? null : (
        <ChatTranscript
          awaitingFirstToken={chat.awaitingFirstToken}
          isBusy={chat.isBusy}
          isPanel={isPanel}
          messages={chat.messages}
          onInputResponses={chat.respond}
          streamingIndex={chat.streamingIndex}
        />
      )}

      {/* Panel: the empty state is a compact intro pinned above the composer.
          Page: it is a centred hero that gives way to the transcript. */}
      {isPanel ? (
        // Only the empty state grows to fill the panel. Once the transcript is
        // on screen it owns the space, so this must shrink to the composer —
        // `flex-1` here would otherwise reserve half the panel as blank space.
        <div
          className={cn(
            "flex flex-col gap-3 p-4",
            chat.isEmpty ? "min-h-0 flex-1 justify-end" : "shrink-0",
          )}
        >
          {chat.isEmpty ? (
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
            chat.isEmpty
              ? "scrollbar-slim flex min-h-0 max-w-2xl flex-1 flex-col items-center justify-center gap-7 overflow-y-auto py-8"
              : "max-w-3xl shrink-0 pb-6",
          )}
        >
          {chat.isEmpty ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <h1 className="font-semibold text-3xl tracking-tight">{heading}</h1>
              <p className="max-w-md text-muted-foreground text-sm leading-relaxed">{subheading}</p>
            </div>
          ) : null}
          <div className="w-full space-y-4">
            {composer}
            {suggestionChips}
          </div>
          {chat.isEmpty && footer ? <div className="w-full">{footer}</div> : null}
        </div>
      )}
    </main>
  );
}
