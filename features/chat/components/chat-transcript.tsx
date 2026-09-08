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
import type { StoredAnswers } from "../lib/answers";
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
  );
}
