import { NextResponse } from "next/server";
import { db } from "@/agent/lib/db.ts";
import { EMAIL_PATTERN, normalizeEmail, verifyPassword } from "@/agent/lib/password.ts";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/agent/lib/session.ts";
import { landingPath } from "@/app/lib/profile-completeness";
import { CREDENTIAL_LIMIT, clientIp, hit } from "@/lib/rate-limit";

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

  /*
   * Two counters, because the two attacks have different shapes: one host
   * working through a list of addresses, and a botnet working through the
   * passwords of one address. Both are counted before the hash is computed, so
   * a flood costs no scrypt work either.
   */
  const ipAllowed = hit(`signin:ip:${clientIp(request)}`, CREDENTIAL_LIMIT).ok;
  const emailAllowed = hit(`signin:email:${email}`, CREDENTIAL_LIMIT).ok;
  if (!ipAllowed || !emailAllowed) return fail("throttled");

  const user = await db.user.findUnique({ where: { email } });

  // Same message whether the account is missing, Google-only, or the password
  // is wrong — otherwise this route doubles as an account-existence oracle.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return fail("credentials");
  }

  // The password is right, so naming the account here reveals nothing the
  // caller does not already know. Send them where a new link can be requested.
  if (!user.emailVerified) {
    return NextResponse.redirect(
      new URL(`/verify-email?email=${encodeURIComponent(email)}&error=unverified`, request.url),
      303,
    );
  }

  const { token, maxAge } = signSession(user.id, user.email);
  // A thin master profile is the one thing that makes every tailored CV worse,
  // so sign-in lands on the builder until it is filled in.
  const response = NextResponse.redirect(new URL(await landingPath(user.id), request.url), 303);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return response;
}
