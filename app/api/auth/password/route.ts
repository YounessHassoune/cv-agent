import { NextResponse } from "next/server";
import { db } from "@/agent/lib/db.ts";
import { hashPassword, passwordProblem, verifyPassword } from "@/agent/lib/password.ts";
import { getCurrentUser } from "@/app/lib/current-user";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: string;
    newPassword?: string;
  } | null;

  const newPassword = body?.newPassword ?? "";
  const problem = passwordProblem(newPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const account = await db.user.findUnique({
    where: { id: user.userId },
    select: { passwordHash: true },
  });
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Only accounts that already have a password must prove the old one; a
  // Google-only account is setting its first password.
  if (account.passwordHash) {
    const ok = await verifyPassword(body?.currentPassword ?? "", account.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
    }
  }

  await db.user.update({
    where: { id: user.userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return NextResponse.json({ ok: true });
}
