import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "cv_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type AppSession = {
  userId: string;
  email: string;
  exp: number; // unix seconds
};

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 16 characters.");
  }
  return value;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/**
 * Mints an HMAC-signed session token. Deliberately small: swapping in Auth.js
 * or Clerk later means replacing this file and the `appSession()` AuthFn in
 * agent/channels/eve.ts — nothing else reads the cookie directly.
 */
export function signSession(userId: string, email: string): { token: string; maxAge: number } {
  const session: AppSession = {
    userId,
    email,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const payload = b64url(JSON.stringify(session));
  return { token: `${payload}.${sign(payload)}`, maxAge: MAX_AGE_SECONDS };
}

export function verifySession(token: string | undefined | null): AppSession | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as AppSession;
    if (typeof session.userId !== "string" || typeof session.exp !== "number") return null;
    if (session.exp * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/** Reads the session cookie straight off a Request (used by the eve channel). */
export function sessionFromRequest(request: Request): AppSession | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  return verifySession(decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)));
}
