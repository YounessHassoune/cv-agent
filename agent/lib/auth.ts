import { cvLoop } from "./state.ts";

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

  const userId =
    typeof fromAttributes === "string" && fromAttributes.length > 0
      ? fromAttributes
      : (current?.principalId ?? "local-dev");

  /*
   * Remembered on the session, for the usage meter's benefit.
   *
   * A hook's context is `{ agent, channel, session: { id } }` — no auth — so
   * the `usage` hook has no way of its own to say whose tokens a step just
   * spent. Every tool goes through this function, so stamping it here means
   * the first tool call of a turn identifies the principal for every step that
   * follows, without thirteen tools each remembering to do it.
   */
  const state = cvLoop.get();
  if (state.userId !== userId) cvLoop.update((s) => ({ ...s, userId }));

  return userId;
}
