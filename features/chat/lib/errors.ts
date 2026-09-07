export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to cancel the response.";
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
