"use client";

import type { ReactNode } from "react";
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
  lockedNotice,
  onActivityChange,
  onResetThread,
  onSessionId,
  liveMessages,
}: AgentChatProps = {}) {
  const isPanel = variant === "panel";
  const chat = useAgentChat({
    contextPrefix,
    initialEvents,
    initialSession,
    liveMessages,
    onActivityChange,
    onSessionId,
    persistUrl,
  });
  const { isEmpty } = chat;

  /*
   * A locked thread keeps its transcript and loses its input. Leaving a live
   * composer that silently refuses every message is the worst of the options:
   * the user types, presses send, and the app appears to be broken.
   */
  const composer = lockedNotice ?? (
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

  const chips = (
    <SuggestionChips
      align={isPanel ? "start" : "center"}
      disabled={chat.isBusy}
      onSelect={chat.sendSuggestion}
      /* Starters belong to the blank thread only. Emptying the list rather
         than unmounting keeps the slot in place, so nothing below it moves. */
      suggestions={isEmpty && !lockedNotice ? suggestions : []}
    />
  );

  return (
    <main
      className={cn(
        "flex h-full flex-col overflow-hidden text-foreground",
        isPanel ? "bg-transparent" : "bg-background",
      )}
    >
      <ChatHeader
        hasError={chat.errorMessage !== undefined}
        heading={heading}
        isBusy={chat.isBusy}
        onResetThread={onResetThread}
        show={!(isPanel || isEmpty)}
      />

      <ErrorBanner isPanel={isPanel} message={chat.errorMessage} onResetThread={onResetThread} />

      {isEmpty ? null : (
        <ChatTranscript
          answers={chat.answers}
          awaitingFirstToken={chat.awaitingFirstToken}
          canRespond={chat.canRespond}
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
        <PanelFoot
          chips={chips}
          composer={composer}
          heading={heading}
          isEmpty={isEmpty}
          subheading={subheading}
        />
      ) : (
        <PageFoot
          chips={chips}
          composer={composer}
          footer={footer}
          heading={heading}
          isEmpty={isEmpty}
          subheading={subheading}
        />
      )}
    </main>
  );
}

/** Only the page variant labels itself, and only once there is a thread. */
function ChatHeader({
  hasError,
  heading,
  isBusy,
  onResetThread,
  show,
}: {
  readonly hasError: boolean;
  readonly heading: string;
  readonly isBusy: boolean;
  readonly onResetThread?: () => void | Promise<void>;
  readonly show: boolean;
}) {
  if (!show) return null;

  return (
    <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4">
      <span aria-hidden className="min-w-0" />
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-muted-foreground text-sm">{heading}</span>
        <StatusDot hasError={hasError} isBusy={isBusy} />
      </span>
      {/* A thread that is remembered across reloads needs a way out of it. */}
      <span className="flex justify-end">
        {onResetThread ? (
          <button
            className="rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-secondary hover:text-foreground"
            onClick={() => void onResetThread()}
            type="button"
          >
            New chat
          </button>
        ) : null}
      </span>
    </header>
  );
}

function ErrorBanner({
  isPanel,
  message,
  onResetThread,
}: {
  readonly isPanel: boolean;
  readonly message?: string;
  readonly onResetThread?: () => void | Promise<void>;
}) {
  if (!message) return null;

  return (
    <div className={cn("mx-auto w-full shrink-0 px-4 pt-2 sm:px-6", isPanel ? "" : "max-w-3xl")}>
      <ChatError message={message} onResetThread={onResetThread} />
    </div>
  );
}

type FootProps = {
  readonly chips: ReactNode;
  readonly composer: ReactNode;
  readonly heading: string;
  readonly isEmpty: boolean;
  readonly subheading: string;
};

function PanelFoot({ chips, composer, heading, isEmpty, subheading }: FootProps) {
  return (
    // Only the empty state grows to fill the panel. Once the transcript is on
    // screen it owns the space, so this must shrink to the composer —
    // `flex-1` here would otherwise reserve half the panel as blank space.
    <div
      className={cn("flex flex-col gap-3 p-4", isEmpty ? "min-h-0 flex-1 justify-end" : "shrink-0")}
    >
      {isEmpty ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="font-medium text-sm">{heading}</p>
            <p className="text-muted-foreground text-xs leading-relaxed">{subheading}</p>
          </div>
          {chips}
        </div>
      ) : null}
      {composer}
    </div>
  );
}

function PageFoot({
  chips,
  composer,
  footer,
  heading,
  isEmpty,
  subheading,
}: FootProps & { readonly footer?: ReactNode }) {
  return (
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
          <p className="max-w-md text-muted-foreground text-sm leading-relaxed">{subheading}</p>
        </div>
      ) : null}
      {/* The composer keeps this slot in both states, so switching from hero to
          transcript never remounts it — an in-progress draft survives. */}
      <div className="w-full space-y-4">
        {composer}
        {chips}
      </div>
      {isEmpty && footer ? <div className="w-full">{footer}</div> : null}
    </div>
  );
}
