export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to cancel the response.";
}

/**
 * A turn the proxy refused for billing reasons.
 *
 * The agent endpoint answers 402 with `{"error":"paywall"}`, and how much of
 * that reaches the client depends on where the transport gives up — the status
 * code, the body, or both. Matching either is what makes the difference
 * between "Request failed" and a sentence that says what to do next.
 */
export function isPaywall(message: string | undefined): boolean {
  if (!message) return false;
  return /paywall|402/.test(message);
}

/**
 * Marks the failures that repeat forever on the same session rather than being
 * worth a retry — an empty model reply, which is what a provider returns when
 * it rejects the stored history outright.
 */
export function isStuckThread(message: string | undefined): boolean {
  if (!message) return false;
  return /did not return a response|empty response|no response/i.test(message);
}
