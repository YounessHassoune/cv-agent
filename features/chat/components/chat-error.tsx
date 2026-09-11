"use client";

import Link from "next/link";
import { AlertCircleIcon, SparklesIcon } from "lucide-react";
import { isPaywall, isStuckThread } from "../lib/errors";

type Props = {
  readonly message: string;
  /** Offered only for the failures a new session can actually clear. */
  readonly onResetThread?: () => void | Promise<void>;
};

export function ChatError({ message, onResetThread }: Props) {
  /*
   * A refused turn is not a failure, and dressing it in a red box with
   * "Request failed" tells the user their app is broken when in fact they have
   * run out of something they can buy more of.
   */
  if (isPaywall(message)) {
    return (
      <div className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm">
        <SparklesIcon className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">That is as far as the free plan goes</p>
          <p className="mt-0.5 text-muted-foreground">
            You have used the agent messages included with your plan. Everything you have made so
            far stays exactly where it is.
          </p>
          <Link
            className="mt-2 inline-block font-medium text-xs underline underline-offset-2"
            href="/dashboard/pricing"
          >
            See plans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm">
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="min-w-0">
        <p className="font-medium">Request failed</p>
        <p className="mt-0.5 text-muted-foreground">{message}</p>
        {/* A turn that dies mid-flight can leave this session's history
            malformed, and every later message then fails the same way. That
            state is unrecoverable in place — only a new session clears it. */}
        {onResetThread && isStuckThread(message) ? (
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
  );
}
