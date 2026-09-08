"use client";

import type {
  EveAuthorizationPart,
  EveDynamicToolPart,
  EveMessage,
  EveMessagePart,
} from "eve/react";
import {
  AlertCircleIcon,
  ArrowRightIcon,
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
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StoredAnswers } from "../lib/answers";

export type AgentInputResponse = {
  readonly optionId?: string;
  readonly requestId: string;
  readonly text?: string;
};

type EveFilePart = Extract<EveMessagePart, { type: "file" }>;

export function AgentMessage({
  answers,
  canRespond,
  isLastMessage,
  isStreaming,
  message,
  onInputResponses,
  turnActive,
}: {
  readonly answers: StoredAnswers;
  readonly canRespond: boolean;
  /** Only the tail of the last message can still be waiting on the user. */
  readonly isLastMessage: boolean;
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
  /*
   * The pipeline writes, compiles and scores, and the improvement pass runs
   * the same three steps again — which read as "CV draft ready / PDF ready /
   * Match check 59 / Improved draft ready / PDF rebuilt / Match re-checked
   * 75", six lines for three things. Only the last run of each step is shown,
   * so the feed is one line per step carrying its final result.
   */
  const supersededCalls = new Set<string>();
  const lastCallByTool = new Map<string, string>();
  for (const part of message.parts) {
    if (part.type !== "dynamic-tool") continue;
    if (part.state === "output-error") {
      const key = toolKey(part);
      failuresByTool.set(key, (failuresByTool.get(key) ?? 0) + 1);
    } else if (part.state === "output-available") {
      const key = toolKey(part);
      succeeded.add(key);
      const previous = lastCallByTool.get(key);
      if (previous !== undefined) supersededCalls.add(previous);
      lastCallByTool.set(key, part.toolCallId);
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
        {message.parts.map((part, index) => part.type === "dynamic-tool" && (phantoms.has(part.toolCallId) || supersededCalls.has(part.toolCallId)) ? null : (
          <AgentMessagePart
            answers={answers}
            canRespond={canRespond}
            failureCount={failuresByTool.get(toolKey(part)) ?? 0}
            hadSiblingSuccess={succeeded.has(toolKey(part))}
            // A question the run has already moved past is history, not a
            // prompt — even though eve replays it looking brand new.
            isPending={isLastMessage && index === message.parts.length - 1}
            isUser={message.role === "user"}
            key={partKey(part, index)}
            onInputResponses={onInputResponses}
            part={part}
            showCaret={isStreaming && message.role === "assistant" && index === lastTextIndex}
            turnActive={turnActive && index >= liveFrom}
          />
        ))}
      </MessageContent>

      {/* The answer's copy button stays put; the one on your own message is
          revealed on hover, the way every chat app does it. */}
      {message.role === "assistant" && !isStreaming && answer.length > 0 ? (
        <MessageActions>
          <CopyAction text={answer} />
        </MessageActions>
      ) : null}

      {message.role === "user" && answer.length > 0 ? (
        <MessageActions className="justify-end opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
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

/**
 * A pasted job description is the normal first message here, and it is
 * hundreds of lines long. Left whole it buried the conversation: the agent's
 * reply started a screen and a half below its own question. Clamp it, and let
 * the user open it back up.
 *
 * Rendered as plain text rather than markdown — a JD full of `*` bullets and
 * `#` headings is not a document the user asked us to format.
 */
const COLLAPSE_CHARS = 600;
const COLLAPSE_LINES = 8;

function UserText({ text }: { readonly text: string }) {
  const [expanded, setExpanded] = useState(false);

  const lineCount = text.split("\n").length;
  const isLong = text.length > COLLAPSE_CHARS || lineCount > COLLAPSE_LINES;

  const body = <p className="whitespace-pre-wrap wrap-break-word">{text}</p>;
  if (!isLong) return body;

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          !expanded &&
            "max-h-40 overflow-hidden mask-[linear-gradient(to_bottom,black_60%,transparent)]",
        )}
      >
        {body}
      </div>
      <button
        className="self-start text-xs underline underline-offset-2 opacity-80 transition-opacity hover:opacity-100"
        onClick={() => setExpanded((value) => !value)}
        type="button"
      >
        {expanded ? "Show less" : lineCount > 1 ? `Show more (${lineCount} lines)` : "Show more"}
      </button>
    </div>
  );
}

function AgentMessagePart({
  answers,
  canRespond,
  failureCount,
  hadSiblingSuccess,
  isPending,
  isUser,
  onInputResponses,
  part,
  showCaret,
  turnActive,
}: {
  readonly answers: StoredAnswers;
  readonly canRespond: boolean;
  /** Whether this part sits at the very end of the conversation. */
  readonly isPending: boolean;
  /** How many times this same step has failed in this message. */
  readonly failureCount: number;
  /** Whether another call to this same tool already succeeded here. */
  readonly hadSiblingSuccess: boolean;
  /** Your own message: plain text, and collapsed when it is a pasted wall. */
  readonly isUser: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveMessagePart;
  readonly showCaret: boolean;
  readonly turnActive: boolean;
}) {
  switch (part.type) {
    case "step-start":
      return null;
    case "text":
      if (isUser) return <UserText text={part.text} />;
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
          answers={answers}
          canRespond={canRespond}
          failureCount={failureCount}
          hadSiblingSuccess={hadSiblingSuccess}
          isPending={isPending}
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
  cvwriter: {
    running: "Tailoring your CV…",
    done: "CV draft ready",
    failed: "Writing your CV",
  },
  compilepdf: {
    running: "Building the PDF…",
    done: "PDF ready",
    failed: "Building the PDF",
    // A rejected draft is the fact check doing its job, not something going wrong.
    retry: "Draft claimed something your profile doesn't back, so it is asking for a corrected draft.",
  },
  scoreats: {
    running: "Checking the match with the job…",
    done: "Match check",
    failed: "Checking the match",
  },
  askquestion: { running: "Waiting for your answer…", done: "Answer received" },
};

function activityFor(toolName: string) {
  return TOOL_ACTIVITY[toolName.toLowerCase().replace(/[^a-z0-9]/g, "")];
}

/** The ATS score, when the step that just finished is the one that computes it. */
function readScore(part: EveDynamicToolPart): string | undefined {
  const output = part.output as { total?: unknown } | null | undefined;
  return typeof output?.total === "number" ? `${output.total}/100` : undefined;
}

/**
 * What a finished step says. Only the last run of a step is rendered, so this
 * is the final state of that step — and for the score, the number the user is
 * actually waiting to hear.
 */
function describeResult(activity: { done: string }, part: EveDynamicToolPart): string {
  const score = readScore(part);
  return score === undefined ? activity.done : `${activity.done} — ${score}`;
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
  answers,
  canRespond,
  failureCount,
  hadSiblingSuccess,
  isPending,
  onInputResponses,
  part,
  turnActive,
}: {
  readonly answers: StoredAnswers;
  readonly canRespond: boolean;
  /** Whether this call sits at the very end of the conversation. */
  readonly isPending: boolean;
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
        <ActivityLine
          icon={<CheckIcon className="size-3.5" />}
          label={describeResult(activity, part)}
        />
      ) : null;
      break;
    case "output-error":
      /*
       * A step that failed and then succeeded is not news — the agent routed
       * around it, which is its job. Announcing it in red on every single run
       * made a working pipeline look broken. Only an unrecovered failure is
       * worth the user's attention.
       */
      statusLine = hadSiblingSuccess ? null : (
        <ActivityLine
          className="text-destructive/80"
          icon={<AlertCircleIcon className="size-3.5" />}
          label={
            failureCount >= REPEATED_FAILURE
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
        answers={answers}
        canRespond={canRespond}
        isPending={isPending}
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
            <a
              className={buttonVariants({ size: "sm" })}
              href={part.authorization.url}
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLinkIcon className="size-4" />
              Sign in with {part.displayName}
            </a>
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

type InputOption = { id: string; label: string; description?: string; style?: string };

/**
 * Marks a question whose answers are not mutually exclusive.
 *
 * eve's `ask_question` takes `{ prompt, options?, allowFreeform? }` and nothing
 * else — the schema is strict, and a response carries one `optionId` or free
 * text. So the only place to say "more than one of these can be true" is the
 * option id, which is a machine identifier the user never sees. Every id
 * carrying the prefix is the signal; a channel that does not know the
 * convention still shows the options as ordinary buttons.
 */
const MULTI_PREFIX = "multi:";

function isMultiSelect(options: readonly InputOption[]): boolean {
  return options.length > 1 && options.every((option) => option.id.startsWith(MULTI_PREFIX));
}

/**
 * Checkboxes plus one confirm, for a proposal where the user can want two
 * things at once ("quantify the bullets" *and* "reorder the skills").
 *
 * The answer goes back as free text — the joined labels — because the response
 * contract has room for exactly one option id. The model reads the labels it
 * wrote itself, so nothing is lost in the round trip.
 */
function MultiSelectOptions({
  canRespond,
  onSubmit,
  options,
  sent,
}: {
  readonly canRespond: boolean;
  readonly onSubmit: (labels: string[]) => void;
  readonly options: readonly InputOption[];
  readonly sent: boolean;
}) {
  const [checked, setChecked] = useState<readonly string[]>([]);
  const disabled = !canRespond || sent;

  return (
    <>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isChecked = checked.includes(option.id);
          return (
            <label
              className={cn(
                "flex w-full cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                "hover:border-primary/40 hover:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring",
                isChecked && "border-primary/50 bg-accent",
                disabled && "pointer-events-none opacity-50",
              )}
              key={option.id}
            >
              <input
                checked={isChecked}
                className="mt-0.5 size-4 shrink-0 accent-primary"
                disabled={disabled}
                onChange={(event) => {
                  setChecked((current) =>
                    event.target.checked
                      ? [...current, option.id]
                      : current.filter((id) => id !== option.id),
                  );
                }}
                type="checkbox"
              />
              <span className="min-w-0">
                <span className="block font-medium text-sm">{option.label}</span>
                {option.description !== undefined && (
                  <span className="mt-0.5 block text-muted-foreground text-xs leading-relaxed">
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <button
          className={cn(buttonVariants({ size: "sm" }))}
          disabled={disabled || checked.length === 0}
          onClick={() => {
            const labels = options
              .filter((option) => checked.includes(option.id))
              .map((option) => option.label);
            onSubmit(labels);
          }}
          type="button"
        >
          {checked.length > 1 ? `Apply ${checked.length}` : "Apply"}
        </button>
        <span className="text-muted-foreground text-xs">
          Pick as many as you want, or type your own answer below.
        </span>
      </div>
    </>
  );
}

function InputRequestActions({
  answers,
  canRespond,
  isPending,
  onInputResponses,
  part,
}: {
  readonly answers: StoredAnswers;
  readonly canRespond: boolean;
  readonly isPending: boolean;
  readonly onInputResponses: (responses: readonly AgentInputResponse[]) => void | Promise<void>;
  readonly part: EveDynamicToolPart;
}) {
  /*
   * The answer only comes back as `inputResponse` once the server echoes it,
   * which is a round trip away. Remember the click locally so a second one
   * cannot start a second turn in the gap.
   */
  const [sent, setSent] = useState(false);

  const inputRequest = part.toolMetadata?.eve?.inputRequest;
  if (!inputRequest) {
    return null;
  }

  /*
   * eve records the question in its durable stream but not the answer, so a
   * replayed transcript shows every question as if it were still open — live
   * buttons under a run that answered them minutes ago. Two things close one:
   * the answer this browser remembers giving, and the plain fact that the
   * conversation moved on past it.
   */
  const remembered = answers[inputRequest.requestId];
  const inputResponse = part.toolMetadata?.eve?.inputResponse ?? remembered;
  const answered = inputResponse !== undefined;
  const selectedOption = inputRequest.options?.find(
    (option) => option.id === inputResponse?.optionId,
  );

  const options = inputRequest.options ?? [];
  const multiSelect = isMultiSelect(options);

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4 shadow-xs">
      <p className="font-medium text-sm leading-relaxed">{inputRequest.prompt}</p>
      {answered ? (
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <CheckCircleIcon className="size-4 shrink-0 text-primary" />
          <span>{selectedOption?.label ?? inputResponse.text ?? inputResponse.optionId}</span>
        </p>
      ) : !isPending ? (
        // Answered on another device, or by freeform text. Either way it is
        // settled: the run went on without needing anything more here.
        <p className="text-muted-foreground text-sm">Answered.</p>
      ) : multiSelect ? (
        <MultiSelectOptions
          canRespond={canRespond}
          onSubmit={(labels) => {
            setSent(true);
            void onInputResponses([
              { requestId: inputRequest.requestId, text: labels.join(", ") },
            ]);
          }}
          options={options}
          sent={sent}
        />
      ) : (
        <>
          {/*
           * One full-width row per option, label above its description. The
           * old row of identical solid buttons made a proposal — "rewrite the
           * bullets", "quantify them", "draft a demo project" — unreadable at
           * a glance, and threw away the descriptions the agent wrote for each
           * one.
           */}
          <div className="flex flex-col gap-2">
            {options.map((option) => (
              <button
                className={cn(
                  "group w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                  "hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:pointer-events-none disabled:opacity-50",
                  option.style === "danger" && "hover:border-destructive/40",
                )}
                disabled={!canRespond || sent}
                key={option.id}
                onClick={() => {
                  setSent(true);
                  void onInputResponses([
                    {
                      optionId: option.id,
                      requestId: inputRequest.requestId,
                    },
                  ]);
                }}
                type="button"
              >
                <span className="flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "font-medium text-sm",
                      option.style === "danger" && "text-destructive",
                    )}
                  >
                    {option.label}
                  </span>
                  <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                {option.description !== undefined && (
                  <span className="mt-0.5 block text-muted-foreground text-xs leading-relaxed">
                    {option.description}
                  </span>
                )}
              </button>
            ))}
          </div>
          {/* Freeform is always open in this app — the composer is right there
              — but it is only worth saying when the buttons are the answer. */}
          {options.length > 0 && (
            <p className="text-muted-foreground text-xs">Or type your own answer below.</p>
          )}
        </>
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
