import { NextResponse } from "next/server";
import { db } from "@/agent/lib/db.ts";
import {
  EMAIL_PATTERN,
  hashPassword,
  normalizeEmail,
  passwordProblem,
} from "@/agent/lib/password.ts";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/agent/lib/session.ts";
import { issueVerification } from "@/agent/lib/verification.ts";
import { clientIp, hit, SIGNUP_LIMIT } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const email = normalizeEmail(form.get("email"));
  const password = String(form.get("password") ?? "");

  const fail = (error: string) =>
    NextResponse.redirect(
      new URL(
        `/signup?error=${error}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`,
        request.url,
      ),
      303,
    );

  /** Signing up does not sign you in — the verification link does that. */
  const pending = (error?: string) =>
    NextResponse.redirect(
      new URL(
        `/verify-email?email=${encodeURIComponent(email)}${error ? `&error=${error}` : ""}`,
        request.url,
      ),
      303,
    );

  const signedIn = (user: { id: string; email: string }) => {
    const { token, maxAge } = signSession(user.id, user.email);
    const response = NextResponse.redirect(new URL("/dashboard/profile", request.url), 303);
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
    return response;
  };

  if (!EMAIL_PATTERN.test(email)) return fail("email");
  if (passwordProblem(password)) return fail("password");

  // Every signup mints a verification email, so an unthrottled route is a mail
  // relay pointed at whatever addresses the caller types.
  if (!hit(`signup:ip:${clientIp(request)}`, SIGNUP_LIMIT).ok) return fail("throttled");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // A Google-first account can claim its password here; a password account
    // already exists and should sign in instead.
    if (existing.passwordHash) return fail("exists");
    const user = await db.user.update({
      where: { id: existing.id },
      data: { passwordHash: await hashPassword(password), name: existing.name ?? (name || null) },
    });
    // Its address is already proven by Google, so no second round trip.
    if (user.emailVerified) return signedIn(user);
    const result = await issueVerification(request, user);
    return result.status === "auto_verified"
      ? signedIn(user)
      : pending(result.status === "failed" ? "send_failed" : undefined);
  }

  const user = await db.user.create({
    data: { email, name: name || null, passwordHash: await hashPassword(password) },
  });

  // Seed the master profile so the builder opens with the name already filled.
  await db.profile.create({
    data: {
      userId: user.id,
      fullName: name || email.split("@")[0],
      contact: { email, links: [] },
    },
  });

  const result = await issueVerification(request, user);
  if (result.status === "auto_verified") return signedIn(user);
  return pending(result.status === "failed" ? "send_failed" : undefined);
}
