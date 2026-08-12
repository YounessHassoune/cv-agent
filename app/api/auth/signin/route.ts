import { NextResponse } from "next/server";
import { SESSION_COOKIE, signSession } from "@/agent/lib/session.ts";

/**
 * Minimal email-keyed sign-in: the email becomes the stable userId that scopes
 * every profile and application. Swap this route (and the `appSession()` AuthFn
 * in agent/channels/eve.ts) for Auth.js or Clerk when you need real identity.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.redirect(new URL("/signin?error=invalid", request.url), 303);
  }

  const { token, maxAge } = signSession(email, email);
  const response = NextResponse.redirect(new URL("/profile", request.url), 303);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return response;
}
