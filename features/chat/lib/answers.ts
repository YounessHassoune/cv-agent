"use client";

/**
 * Local memory of the answers the user gave to the agent's questions.
 *
 * eve's durable stream records the *question* (`input.requested`) but nothing
 * about the response — there is no event for it. So a reload replays the
 * question looking unanswered, with live buttons under a run that has long
 * since moved on. Nothing on the server can tell us what was picked, so the
 * browser that picked it remembers.
 *
 * Best-effort by design: another device shows the question as closed rather
 * than as answered-with-this-option, which is still the truth.
 */
export type StoredAnswer = {
  readonly optionId?: string;
  readonly text?: string;
};

export type StoredAnswers = Readonly<Record<string, StoredAnswer>>;

function keyFor(sessionId: string): string {
  return `applyflow.chat.answers.${sessionId}`;
}

export function readAnswers(sessionId: string | undefined): StoredAnswers {
  if (sessionId === undefined) return {};
  try {
    const raw = window.localStorage.getItem(keyFor(sessionId));
    return raw ? (JSON.parse(raw) as StoredAnswers) : {};
  } catch {
    // Storage disabled, or a corrupt entry. The question just reads as closed.
    return {};
  }
}

export function writeAnswers(
  sessionId: string | undefined,
  answers: readonly { requestId: string; optionId?: string; text?: string }[],
): StoredAnswers {
  const merged: Record<string, StoredAnswer> = { ...readAnswers(sessionId) };
  for (const answer of answers) {
    merged[answer.requestId] = { optionId: answer.optionId, text: answer.text };
  }
  if (sessionId !== undefined) {
    try {
      window.localStorage.setItem(keyFor(sessionId), JSON.stringify(merged));
    } catch {
      // Not worth surfacing: the answer still went to the agent.
    }
  }
  return merged;
}
