import { NextResponse } from "next/server";
import { db } from "@/agent/lib/db.ts";
import { EMAIL_PATTERN, normalizeEmail } from "@/agent/lib/password.ts";
import { issueVerification } from "@/agent/lib/verification.ts";
import { clientIp, EMAIL_LIMIT, hit } from "@/lib/rate-limit";

/**
 * Mails a new link. The response never says whether the address has an account:
 * this route needs no password, so a truthful answer would turn it into an
 * account-existence oracle. Every outcome that is not a real failure reads the
 * same to the caller.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));

  const back = (status: string) =>
    NextResponse.redirect(
      new URL(`/verify-email?email=${encodeURIComponent(email)}&sent=${status}`, request.url),
      303,
    );

  if (!EMAIL_PATTERN.test(email)) return back("ok");

  // `issueVerification` already holds one account to one link a minute. This
  // holds one caller to a handful of accounts an hour, which is the part a
  // per-account cooldown cannot see.
  if (!hit(`resend:ip:${clientIp(request)}`, EMAIL_LIMIT).ok) return back("cooldown");

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.emailVerified) return back("ok");

  const result = await issueVerification(request, user);
  if (result.status === "cooldown") return back("cooldown");
  if (result.status === "failed") return back("failed");
  return back("ok");
}
