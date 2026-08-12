import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/agent/lib/db.ts";
import { getCurrentUser } from "@/app/lib/current-user";

const Body = z.object({
  status: z.enum(["PENDING_REVIEW", "APPROVED", "APPLIED", "REJECTED"]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { id } = await params;
  const { count } = await db.application.updateMany({
    where: { id, userId: user.userId },
    data: { status: parsed.data.status },
  });
  if (count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ status: parsed.data.status });
}
