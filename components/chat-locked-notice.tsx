"use client";

import { LockedCard, usePlan } from "@/components/plan-provider";

/**
 * What sits where the composer was when a thread cannot take another message.
 *
 * The failure this replaces was the worst kind: the composer accepted the
 * message, the server refused it with a 402, and nothing at all appeared. The
 * user concludes the app is broken rather than that they have hit a limit, and
 * a limit nobody can see cannot sell anything.
 *
 * Only the words are decided here — the shape is `LockedCard`, so this reads as
 * the same object as every other lock in the app.
 */
export function ChatLockedNotice({
  reason,
}: {
  readonly reason: "turns" | "applicationChat" | "applications";
}) {
  const plan = usePlan();

  const copy = {
    applications: {
      title:
        plan.limits.applications === 1
          ? "You have used your free application"
          : `You have used all ${plan.limits.applications} applications`,
      body: "Nothing is lost — every CV you have tailored stays in your account. A paid plan starts the count again and adds follow-up chat on each one.",
    },
    turns: {
      title: `You have used all ${plan.limits.agentTurns} messages on ${plan.limits.label}`,
      body:
        plan.limits.applicationWindow === "period"
          ? "Your messages reset when the plan renews. A larger plan starts them again now."
          : "Everything you have made stays exactly where it is.",
    },
    applicationChat: {
      title: "Follow-up chat is part of Pro",
      body: "Ask for a stronger summary, a different emphasis, or a rewritten bullet — and watch the CV change beside you.",
    },
  }[reason];

  return (
    <LockedCard
      body={copy.body}
      layout="row"
      onUpgrade={() => plan.upgrade("applicationChat")}
      title={copy.title}
    />
  );
}
