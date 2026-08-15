import { NextResponse } from "next/server";
import { db } from "@/agent/lib/db.ts";
import { EMAIL_PATTERN, normalizeEmail, verifyPassword } from "@/agent/lib/password.ts";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/agent/lib/session.ts";

/**
 * Email + password sign-in. The signed cookie carries the `User.id`, which is
 * the key every profile and application is scoped by (see agent/lib/auth.ts).
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  const password = String(form.get("password") ?? "");

  const fail = (error: string) =>
    NextResponse.redirect(
      new URL(`/signin?error=${error}&email=${encodeURIComponent(email)}`, request.url),
      303,
    );

  if (!EMAIL_PATTERN.test(email) || password.length === 0) return fail("invalid");

  const user = await db.user.findUnique({ where: { email } });

  // Same message whether the account is missing, Google-only, or the password
  // is wrong — otherwise this route doubles as an account-existence oracle.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail("credentials");
  }

  const { token, maxAge } = signSession(user.id, user.email);
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return response;
}
