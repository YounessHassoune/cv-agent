import { NextResponse } from "next/server";
import { db } from "@/agent/lib/db.ts";
import { getCurrentUser } from "@/app/lib/current-user";

/** Deletes one application, including its compiled PDF and stored chat. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  // Scoped by userId so one account can never delete another's row.
  const { count } = await db.application.deleteMany({ where: { id, userId: user.userId } });
  if (count === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ deleted: id });
}
