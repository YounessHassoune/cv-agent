import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/agent/lib/session.ts";
import { consumeVerification } from "@/agent/lib/verification.ts";
import { profileCompleteness } from "@/app/lib/profile-completeness";

/**
 * The target of the link in the verification email. Clicking it both proves the
 * address and signs the user in, so a fresh account never has to type its
 * password twice.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const result = await consumeVerification(token);

  if (result.status !== "ok") {
    return NextResponse.redirect(
      new URL(`/verify-email?error=${result.status === "expired" ? "expired" : "bad_token"}`, request.url),
      303,
    );
  }

  const { token: session, maxAge } = signSession(result.user.id, result.user.email);
  // Fresh accounts have an empty profile, so this is the builder in practice —
  // but a user who verifies late keeps whatever they already filled in.
  const { complete } = await profileCompleteness(result.user.id);
  const destination = complete ? "/dashboard?verified=1" : "/dashboard/profile?verified=1";
  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  response.cookies.set(SESSION_COOKIE, session, sessionCookieOptions(maxAge));
  return response;
}
