import { NextResponse } from "next/server";
import {
  authorizeUrl,
  createState,
  googleConfigured,
  OAUTH_STATE_COOKIE,
} from "@/agent/lib/google-oauth.ts";

/** Kicks off the Google OAuth redirect, stashing the CSRF state in a cookie. */
export async function GET(request: Request) {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/signin?error=google_unconfigured", request.url), 303);
  }

  const state = createState();
  const response = NextResponse.redirect(authorizeUrl(request, state), 303);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return response;
}
