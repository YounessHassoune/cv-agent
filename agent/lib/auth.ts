type Principal = {
  principalId?: string;
  attributes?: Record<string, unknown>;
} | null;

/**
 * Resolve the connected user's id from the session principal. Every tool
 * scopes its queries through this, so the agent can never touch another
 * user's profile or applications.
 */
export function resolveUserId(ctx: { session: { auth: unknown } }): string {
  const auth = ctx.session.auth as { current?: Principal } | undefined;
  const current = auth?.current;
  const fromAttributes = current?.attributes?.userId;
  if (typeof fromAttributes === "string" && fromAttributes.length > 0) {
    return fromAttributes;
  }
  if (current?.principalId) return current.principalId;
  return "local-dev";
}
