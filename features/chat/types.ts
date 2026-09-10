import type { ClientSessionState, MessageStreamEvent } from "eve/client";
import type { EveMessage, useEveAgent } from "eve/react";
import type { ReactNode } from "react";

export const AGENT_NAME = "Wellsuited";

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
   * Called with the eve session id as soon as one exists. Pages that own no
   * database row for the thread (the landing page) store it themselves, so a
   * reload rejoins the live session rather than starting a blank one.
   */
  readonly onSessionId?: (sessionId: string) => void;
  /**
   * Called when the event stream ends while a turn of ours is still running —
   * the connection died, not the work. The run carries on server-side, so the
   * owner re-attaches to it rather than leaving a spinner on screen forever.
   */
  readonly onStreamDropped?: (sessionId: string) => void;
  /**
   * Reports whether this chat is currently streaming a turn it started. The
   * owner uses it to stand down its own view of the same session.
   */
  readonly onBusyChange?: (isBusy: boolean) => void;
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
