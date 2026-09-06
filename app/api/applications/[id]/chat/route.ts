import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/agent/generated/prisma/client.ts";
import { db } from "@/agent/lib/db.ts";
import { getCurrentUser } from "@/app/lib/current-user";

/**
 * The eve stream events are stored verbatim — the client replays them into
 * `initialEvents`, so re-encoding them here would only risk drift. Only the
 * session cursor is validated, since that is what continues the conversation.
 */
const Body = z.object({
  events: z.array(z.unknown()),
  session: z.object({ sessionId: z.string(), streamIndex: z.number() }).optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { id } = await params;
  const { count } = await db.application.updateMany({
    where: { id, userId: user.userId },
    data: {
      chatEvents: parsed.data.events as object[],
      chatSession: parsed.data.session ?? undefined,
    },
  });
  if (count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ saved: parsed.data.events.length });
}

/**
 * Forgets this application's conversation so the next message opens a brand new
 * eve session.
 *
 * A turn that dies mid-flight (a provider outage, a rate-limit rejection) can
 * leave the durable history malformed — most often a tool result whose
 * originating tool call never settled. Strict providers reject every later
 * request against that history, which brands the thread permanently. Nothing
 * here can repair a session's server-side history, so the escape hatch is to
 * stop pointing at it. The CV, PDFs and ATS reports are untouched.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  // `undefined` would mean "leave unchanged"; DbNull is what actually clears a
  // nullable Json column.
  const { count } = await db.application.updateMany({
    where: { id, userId: user.userId },
    data: { chatEvents: Prisma.DbNull, chatSession: Prisma.DbNull },
  });
  if (count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ reset: id });
}
