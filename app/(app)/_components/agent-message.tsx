"use client";

import type {
  EveAuthorizationPart,
  EveDynamicToolPart,
  EveMessage,
  EveMessagePart,
} from "eve/react";
import {
  AlertCircleIcon,
  CheckCircleIcon,
  CheckIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileIcon,
  ImageIcon,
  KeyRoundIcon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AgentInputResponse = {
  readonly optionId?: string;
  readonly requestId: string;
  readonly text?: string;
};

type EveFilePart = Extract<EveMessagePart, { type: "file" }>;

export function AgentMessage({
  canRespond,
  isStreaming,
  message,
  onInputResponses,
  turnActive,
}: {
  readonly canRespond: boolean;
  readonly isStreaming: boolean;
  readonly message: EveMessage;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  /** Whether this part can still be making progress: the turn is running and
   * the part belongs to the step currently executing. */
  readonly turnActive: boolean;
}) {
  const lastTextIndex = message.parts.reduce(
    (last, part, index) => (part.type === "text" ? index : last),
    -1,
  );

  /*
   * One failed step is a hiccup the agent routes around; the same step failing
   * again and again is a dead end, and saying "trying another way" four times
   * left the user watching a run that was never going to finish.
   */
  /*
   * Anything before the last `step-start` belongs to a step the agent has
   * already moved on from. A tool call still "running" back there was never
   * answered — the model asked for it twice and one call came back — and
   * spinning forever next to finished work is what made the feed look stuck.
   * Parallel calls within one step are untouched: they share a step, so none
   * of them sits before the boundary.
   */
  const liveFrom = message.parts.reduce(
    (last, part, index) => (part.type === "step-start" ? index : last),
    0,
  );

  const failuresByTool = new Map<string, number>();
  /** Tools that got a real answer somewhere in this message. */
  const succeeded = new Set<string>();
  /*
   * eve retries a model step that runs long (a subagent in flight) and the
   * retry re-emits the same tool call under a new id. The runtime drops the
   * duplicate, so it never gets a result — a second "Tailoring your CV…" that
   * spins while the real one finishes. Show one spinner per tool.
   */
  const running = new Set<string>();
  const phantoms = new Set<string>();
  for (const part of message.parts) {
    if (part.type !== "dynamic-tool") continue;
    if (part.state === "output-error") {
      const key = toolKey(part);
      failuresByTool.set(key, (failuresByTool.get(key) ?? 0) + 1);
    } else if (part.state === "output-available") {
      succeeded.add(toolKey(part));
    }
    if (isToolRunning(part) && part.toolMetadata?.eve?.inputRequest === undefined) {
      const key = toolKey(part);
      if (running.has(key)) phantoms.add(part.toolCallId);
      running.add(key);
    }
  }

  const answer = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n\n")
    .trim();

  return (
    <Message
      data-optimistic={message.metadata?.optimistic ? "true" : undefined}
      from={message.role}
    >
      <MessageContent>
        {message.parts.map((part, index) => part.type === "dynamic-tool" && phantoms.has(part.toolCallId) ? null : (
          <AgentMessagePart
            canRespond={canRespond}
            failureCount={failuresByTool.get(toolKey(part)) ?? 0}
            hadSiblingSuccess={succeeded.has(toolKey(part))}
            key={partKey(part, index)}
            onInputResponses={onInputResponses}
            part={part}
            showCaret={isStreaming && message.role === "assistant" && index === lastTextIndex}
            turnActive={turnActive && index >= liveFrom}
          />
        ))}
      </MessageContent>

      {/* Revealed on hover, the way every chat app does it — present when
          wanted, invisible while reading. */}
      {message.role === "assistant" && !isStreaming && answer.length > 0 ? (
        <MessageActions className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <CopyAction text={answer} />
        </MessageActions>
      ) : null}
    </Message>
  );
}

function CopyAction({ text }: { readonly text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <MessageAction
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      tooltip={copied ? "Copied" : "Copy"}
    >
      {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
    </MessageAction>
  );
}

function AgentMessagePart({
  canRespond,
  failureCount,
  hadSiblingSuccess,
  onInputResponses,
  part,
  showCaret,
  turnActive,
}: {
  readonly canRespond: boolean;
  /** How many times this same step has failed in this message. */
  readonly failureCount: number;
  /** Whether another call to this same tool already succeeded here. */
  readonly hadSiblingSuccess: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveMessagePart;
  readonly showCaret: boolean;
  readonly turnActive: boolean;
}) {
  switch (part.type) {
    case "step-start":
      return null;
    case "text":
      return (
        <MessageResponse caret="block" isAnimating={showCaret}>
          {part.text}
        </MessageResponse>
      );
    case "reasoning":
      return (
        <Reasoning isStreaming={part.state === "streaming"}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );
    case "file":
      return <AttachmentPart part={part} />;
    case "authorization":
      return <AuthorizationPrompt part={part} />;
    case "dynamic-tool":
      return (
        <ToolActivity
          canRespond={canRespond}
          failureCount={failureCount}
          hadSiblingSuccess={hadSiblingSuccess}
          onInputResponses={onInputResponses}
          part={part}
          turnActive={turnActive}
        />
      );
  }
}

/**
 * End-user labels for the agent's internal steps. Tool calls never render
 * their name, parameters, or output — only these plain-language status lines
 * (nothing internal like ids or JSON ever reaches the user).
 */
const REPEATED_FAILURE = 2;

/**
 * States a tool call never leaves. Anything else is still in flight — and if
 * the turn has ended while a part is still in flight, it never got a result
 * and never will.
 */
const TERMINAL_TOOL_STATES = new Set(["output-available", "output-error", "output-denied"]);

export function isToolRunning(part: EveMessagePart): boolean {
  return part.type === "dynamic-tool" && !TERMINAL_TOOL_STATES.has(part.state);
}

const TOOL_ACTIVITY: Record<
  string,
  { running: string; done: string; failed?: string; retry?: string }
> = {
  getprofile: { running: "Reading your profile…", done: "Profile loaded" },
  jdanalyst: { running: "Analyzing the job offer…", done: "Job offer analyzed", failed: "Analyzing the job offer" },
  analyzejd: { running: "Setting up your application…", done: "Application created" },
  cvwriter: { running: "Tailoring your CV…", done: "CV draft ready", failed: "Writing your CV" },
  compilepdf: {
    running: "Building the PDF…",
    done: "PDF ready",
    failed: "Building the PDF",
    // A rejected draft is the fact check doing its job, not something going wrong.
    retry: "Draft claimed something your profile doesn't back, so it is asking for a corrected draft.",
  },
  scoreats: { running: "Checking the match with the job…", done: "Match check done", failed: "Checking the match" },
  stageapplication: {
    running: "Preparing your application for review…",
    done: "Ready for your review",
  },
  askquestion: { running: "Waiting for your answer…", done: "Answer received" },
};

function activityFor(toolName: string) {
  return TOOL_ACTIVITY[toolName.toLowerCase().replace(/[^a-z0-9]/g, "")];
}

/** Groups a tool's parts so repeated failures of the *same* step are counted. */
function toolKey(part: EveMessagePart): string {
  if (part.type !== "dynamic-tool") return part.type;
  return part.toolMetadata?.eve?.name ?? part.toolName;
}

/**
 * Renders a tool call as a friendly one-line status instead of the raw
 * name/input/output card. Input requests (questions, the staging approval)
 * still surface their interactive prompt.
 */
function ToolActivity({
  canRespond,
  failureCount,
  hadSiblingSuccess,
  onInputResponses,
  part,
  turnActive,
}: {
  readonly canRespond: boolean;
  readonly failureCount: number;
  readonly hadSiblingSuccess: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveDynamicToolPart;
  readonly turnActive: boolean;
}) {
  const activity = activityFor(part.toolMetadata?.eve?.name ?? part.toolName);
  const hasInputRequest = part.toolMetadata?.eve?.inputRequest !== undefined;

  /*
   * A step left mid-flight by a finished turn is abandoned, not running. The
   * model sometimes asks for the same tool twice and only one call comes back;
   * without this the leftover part spins forever, in the live view and in the
   * replayed transcript after a refresh.
   */
  if (!turnActive && isToolRunning(part) && !hasInputRequest) {
    /*
     * The model sometimes asks for the same tool twice while the first call is
     * still running, and the runtime drops the duplicate. Nothing was lost and
     * nothing is wrong, so saying so between two successful steps only alarms
     * the user. Stay quiet when the real call came back.
     */
    if (hadSiblingSuccess) return null;

    return (
      <ActivityLine
        className="text-muted-foreground/70"
        icon={<XCircleIcon className="size-3.5" />}
        label={`${activity?.failed ?? "That step"} didn't finish. Ask again if the result is missing.`}
      />
    );
  }

  let statusLine: ReactNode = null;
  switch (part.state) {
    case "input-streaming":
    case "input-available":
      statusLine = (
        <ActivityLine
          icon={<Loader2Icon className="size-3.5 animate-spin" />}
          label={activity?.running ?? "Working…"}
          running
        />
      );
      break;
    case "output-available":
      statusLine = activity ? (
        <ActivityLine icon={<CheckIcon className="size-3.5" />} label={activity.done} />
      ) : null;
      break;
    case "output-error":
      statusLine = (
        <ActivityLine
          className="text-destructive/80"
          icon={<AlertCircleIcon className="size-3.5" />}
          label={
            failureCount >= REPEATED_FAILURE && !hadSiblingSuccess
              ? `${activity?.failed ?? "That step"} keeps failing. This run can't finish. Try again, and if it repeats the step is broken rather than unlucky.`
              : (activity?.retry ?? "That step hit a snag, trying another way.")
          }
        />
      );
      break;
    case "output-denied":
      // The user declined this step themselves — nothing to announce.
      statusLine = null;
      break;
    default:
      // approval-requested / approval-responded: the interactive prompt below
      // is the whole story. Without one, at least say what we're waiting on.
      statusLine = hasInputRequest ? null : (
        <ActivityLine
          icon={<Loader2Icon className="size-3.5 animate-spin" />}
          label="Waiting for your confirmation…"
          running
        />
      );
      break;
  }

  if (statusLine === null && !hasInputRequest) {
    return null;
  }

  return (
    <div className="space-y-2">
      {statusLine}
      <InputRequestActions
        canRespond={canRespond}
        onInputResponses={onInputResponses}
        part={part}
      />
    </div>
  );
}

function ActivityLine({
  className,
  icon,
  label,
  running = false,
}: {
  readonly className?: string;
  readonly icon: ReactNode;
  readonly label: string;
  /** A step still in flight shimmers, so waiting reads as progress. */
  readonly running?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2 text-muted-foreground text-sm", className)}>
      {icon}
      {running ? <Shimmer as="span">{label}</Shimmer> : <span>{label}</span>}
    </div>
  );
}

function AttachmentPart({ part }: { readonly part: EveFilePart }) {
  const label = part.filename ?? "Attachment";
  const detail = [part.mediaType, formatBytes(part.size)].filter(Boolean).join(" - ");
  const isImage = part.mediaType.startsWith("image/") && part.url !== undefined;
  const Icon = isImage ? ImageIcon : FileIcon;
  const body = (
    <span className="flex max-w-sm items-center gap-3 rounded-md border bg-background/60 p-2 text-sm">
      {isImage ? (
        <img alt={label} className="size-12 shrink-0 rounded-sm object-cover" src={part.url} />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        {detail ? <span className="block truncate text-muted-foreground">{detail}</span> : null}
      </span>
      {part.url ? <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" /> : null}
    </span>
  );

  return part.url ? (
    <a href={part.url} rel="noreferrer" target="_blank">
      {body}
    </a>
  ) : (
    body
  );
}

function AuthorizationPrompt({ part }: { readonly part: EveAuthorizationPart }) {
  const isAuthorized = part.state === "completed" && part.outcome === "authorized";
  const isCompleted = part.state === "completed";
  const Icon = isAuthorized ? CheckCircleIcon : isCompleted ? XCircleIcon : KeyRoundIcon;
  const instructions = part.authorization?.instructions;
  const shouldShowInstructions = instructions !== undefined && instructions !== part.description;

  return (
    <div
      className={cn(
        "space-y-3 rounded-md border p-3",
        isAuthorized
          ? "border-emerald-500/30 bg-emerald-500/5"
          : isCompleted
            ? "border-destructive/30 bg-destructive/5"
            : "border-blue-500/30 bg-blue-500/5",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
            isAuthorized
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : isCompleted
                ? "bg-destructive/10 text-destructive"
                : "bg-blue-500/10 text-blue-700 dark:text-blue-300",
          )}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-medium text-sm">{authorizationTitle(part)}</p>
          <p className="text-muted-foreground text-sm">{authorizationDescription(part)}</p>
          {shouldShowInstructions ? (
            <p className="text-muted-foreground text-sm">{instructions}</p>
          ) : null}
          {part.state === "required" && part.authorization?.userCode ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Code</span>
              <code className="rounded-md bg-background px-2 py-1 font-mono">
                {part.authorization.userCode}
              </code>
            </div>
          ) : null}
          {part.state === "required" && part.authorization?.url ? (
            <Button
              render={<a href={part.authorization.url} rel="noreferrer" target="_blank" />}
              size="sm"
            >
              <ExternalLinkIcon className="size-4" />
              Sign in with {part.displayName}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function authorizationTitle(part: EveAuthorizationPart): string {
  if (part.state === "required") {
    return `Connect ${part.displayName}`;
  }
  if (part.outcome === "authorized") {
    return `${part.displayName} connected`;
  }
  return `${part.displayName} authorization ${formatAuthorizationOutcome(part.outcome)}`;
}

function authorizationDescription(part: EveAuthorizationPart): string {
  if (part.state === "required") {
    return part.description;
  }
  if (part.outcome === "authorized") {
    return `${part.displayName} connected.`;
  }
  const tail = part.reason !== undefined ? ` (${part.reason})` : "";
  return `${part.displayName} authorization ${formatAuthorizationOutcome(part.outcome)}${tail}.`;
}

function formatAuthorizationOutcome(outcome: NonNullable<EveAuthorizationPart["outcome"]>): string {
  switch (outcome) {
    case "authorized":
      return "authorized";
    case "declined":
      return "declined";
    case "failed":
      return "failed";
    case "timed-out":
      return "timed out";
  }
}

function formatBytes(size: number | undefined): string | undefined {
  if (size === undefined) {
    return undefined;
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function InputRequestActions({
  canRespond,
  onInputResponses,
  part,
}: {
  readonly canRespond: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveDynamicToolPart;
}) {
  const inputRequest = part.toolMetadata?.eve?.inputRequest;
  if (!inputRequest) {
    return null;
  }

  const inputResponse = part.toolMetadata?.eve?.inputResponse;
  const selectedOption = inputRequest.options?.find(
    (option) => option.id === inputResponse?.optionId,
  );

  return (
    <div className="space-y-3 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
      <p className="text-muted-foreground text-sm">{inputRequest.prompt}</p>
      {inputResponse ? (
        <p className="font-medium text-sm">
          Responded: {selectedOption?.label ?? inputResponse.text ?? inputResponse.optionId}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {inputRequest.options?.map((option) => (
            <Button
              disabled={!canRespond}
              key={option.id}
              onClick={() => {
                void onInputResponses([
                  {
                    optionId: option.id,
                    requestId: inputRequest.requestId,
                  },
                ]);
              }}
              size="sm"
              type="button"
              variant={option.style === "danger" ? "destructive" : "default"}
            >
              {option.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function partKey(part: EveMessagePart, index: number): string {
  switch (part.type) {
    case "authorization":
      return `authorization:${part.turnId}:${part.stepIndex}:${part.name}`;
    case "dynamic-tool":
      return part.toolCallId;
    default:
      return `${part.type}:${index}`;
  }
}
