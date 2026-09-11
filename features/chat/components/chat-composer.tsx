"use client";

import { ArrowUpRightIcon, SquareIcon } from "lucide-react";
import Link from "next/link";
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import type { AgentStatus } from "../types";

type Props = {
  readonly placeholder: string;
  readonly status: AgentStatus;
  /** Set while the chat is stopping a run or holding a queued message. */
  readonly activityNote?: string;
  readonly onSubmit: (message: PromptInputMessage) => void;
  readonly onStop: () => void;
};

export function ChatComposer({ activityNote, onStop, onSubmit, placeholder, status }: Props) {
  return (
    <div className="space-y-2">
      {activityNote ? (
        <p className="flex items-center gap-2 px-1 text-muted-foreground text-xs">
          <SquareIcon className="size-3 shrink-0 animate-pulse fill-current" />
          {activityNote}
        </p>
      ) : null}
      <PromptInput onSubmit={onSubmit}>
        <PromptInputTextarea placeholder={placeholder} />
        <PromptInputSubmit onStop={onStop} status={status} />
      </PromptInput>
    </div>
  );
}

/**
 * The way back to the application this conversation produced.
 *
 * It is rendered beside the composer rather than inside it, because the link
 * has to outlive the input. A thread that has spent its allowance loses the
 * composer to a lock notice, and losing the only pointer to the CV that same
 * run just made is the one thing that must not happen at that moment.
 *
 * The tab is named in the URL: the line under the link promises a conversation
 * about the CV, and the panel opens on the score otherwise.
 */
export function ApplicationLink({ id, isBusy }: { readonly id: string; readonly isBusy: boolean }) {
  return (
    <Link
      className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors hover:border-foreground/25 hover:bg-secondary"
      href={`/dashboard/applications/${id}?tab=chat`}
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
  );
}
