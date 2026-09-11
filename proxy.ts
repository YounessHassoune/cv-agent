import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { consumeAgentTurn, planFor } from "@/agent/lib/billing.ts";
import { db } from "@/agent/lib/db.ts";
import { sessionFromRequest } from "@/agent/lib/session.ts";
import { can } from "@/lib/entitlements";

/**
 * The meter in front of the agent.
 *
 * Every turn — the landing chat, the workspace chat, the terminal client —
 * reaches the model through the routes `eveChannel()` mounts under
 * `/eve/v1/session*`. That makes this the one place a turn can be counted
 * before it costs anything, and the only gate a hand-written `fetch` cannot
 * walk around. Gating in the chat components would stop the button, not the
 * request.
 *
 * Proxy runs on the Node.js runtime in Next 16, so the Prisma client and the
 * session verifier work here exactly as they do in a route handler.
 */

/** Only these two POSTs start a turn. */
function startsTurn(pathname: string): boolean {
  if (pathname === "/eve/v1/session") return true;
  // `/eve/v1/session/:id` and nothing deeper: /cancel, /clear, /compact and
  // /reset are housekeeping on a turn that already happened, and charging for
  // them would bill someone for stopping the thing they are being billed for.
  const match = /^\/eve\/v1\/session\/([^/]+)$/.exec(pathname);
  return match !== null;
}

function sessionIdOf(pathname: string): string | null {
  return /^\/eve\/v1\/session\/([^/]+)$/.exec(pathname)?.[1] ?? null;
}

function paywall(capability: string, message: string, extra: Record<string, unknown> = {}) {
  // 402 rather than 403: the client tells the two apart to decide between "you
  // cannot do this" and "this costs money", and only the second one opens the
  // upgrade dialog.
  return NextResponse.json({ error: "paywall", capability, message, ...extra }, { status: 402 });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (request.method !== "POST" || !startsTurn(pathname)) return NextResponse.next();

  const session = sessionFromRequest(request);
  // No app cookie: the eve channel's other authenticators (Vercel OIDC, local
  // dev) own this request. Metering a developer's REPL turn against a user who
  // is not there would be worse than not metering it.
  if (!session) return NextResponse.next();

  const { userId } = session;
  const sessionId = sessionIdOf(pathname);

  /*
   * Follow-up chat on a finished application is a paid capability. It is
   * checked against the application the session belongs to rather than the URL
   * the browser came from, because the URL is the client's word for it.
   *
   * A session whose application has produced nothing yet stays open: the first
   * run can die halfway through, and answering "upgrade to try again" to
   * somebody whose one free application failed is indefensible.
   */
  if (sessionId !== null && !can(await planFor(userId), "applicationChat")) {
    const finished = await db.application.findFirst({
      where: {
        userId,
        chatSession: { path: ["sessionId"], equals: sessionId },
        NOT: { variants: { equals: null } },
      },
      select: { id: true },
    });
    if (finished) {
      return paywall("applicationChat", "Follow-up chat on a tailored CV is part of Pro.", {
        applicationId: finished.id,
      });
    }
  }

  const turn = await consumeAgentTurn(userId);
  if (!turn.ok) {
    return paywall(
      "agentTurns",
      `You have used all ${turn.limit} agent messages on the ${turn.plan} plan.`,
      { used: turn.used, limit: turn.limit },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/eve/v1/session/:path*",
};
