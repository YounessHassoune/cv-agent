import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import type { EveMessage, useEveAgent } from "eve/react";
import type { ReactNode } from "react";

export const AGENT_NAME = "ApplyFlow";

export const DEFAULT_SUBHEADING =
  "Paste a job description and say which language you want the CV in. Your master profile is the only source of facts.";

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

export type AgentStatus = ReturnType<typeof useEveAgent>["status"];
