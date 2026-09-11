"use client";

import type { EveMessage } from "eve/react";
import type { ComponentProps } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";
import { useCyclingMessage } from "../hooks/use-cycling-message";
import { AFTER_TOOL_PROGRESS, THINKING_PROGRESS } from "../lib/activity-copy";
import type { StoredAnswers } from "../lib/answers";
import { lastFinishedTool } from "../lib/messages";
import { AgentMessage } from "./agent-message";

type Props = {
  readonly messages: readonly EveMessage[];
  /** Answers this browser gave, which the server stream does not record. */
  readonly answers: StoredAnswers;
  /** Whether the agent's own questions accept an answer right now. */
  readonly canRespond: boolean;
  readonly isBusy: boolean;
  readonly isPanel: boolean;
  /** Index of the message being streamed into, or null when nothing is. */
  readonly streamingIndex: number | null;
  /** True during the silent gaps: before the first token, and between steps. */
  readonly awaitingFirstToken: boolean;
  readonly onInputResponses: ComponentProps<typeof AgentMessage>["onInputResponses"];
};

export function ChatTranscript({
  answers,
  awaitingFirstToken,
  canRespond,
  isBusy,
  isPanel,
  messages,
  onInputResponses,
  streamingIndex,
}: Props) {
  return (
    <Conversation className="min-h-0 flex-1">
      <ConversationContent
        className={cn("mx-auto w-full gap-6 py-6", isPanel ? "px-4" : "max-w-3xl px-4 sm:px-6")}
      >
        {messages.map((message, index) => (
          <AgentMessage
            answers={answers}
            canRespond={canRespond}
            isLastMessage={index === messages.length - 1}
            isStreaming={index === streamingIndex}
            key={message.id}
            message={message}
            onInputResponses={onInputResponses}
            turnActive={isBusy && index === messages.length - 1}
          />
        ))}

        {awaitingFirstToken ? (
          <ThinkingMessage after={lastFinishedTool(messages[messages.length - 1])} />
        ) : null}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}

/**
 * The silence between steps. The line moves on while the wait lasts, because a
 * frozen "Thinking…" is the part of a long run that reads as a hung app.
 */
function ThinkingMessage({ after }: { readonly after: string | undefined }) {
  const steps = (after !== undefined && AFTER_TOOL_PROGRESS[after]) || THINKING_PROGRESS;
  const label = useCyclingMessage(steps);

  return (
    <Message from="assistant">
      <MessageContent>
        <Shimmer as="span" className="text-sm">
          {label}
        </Shimmer>
      </MessageContent>
    </Message>
  );
}
