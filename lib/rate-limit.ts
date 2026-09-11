/**
 * A fixed-window rate limiter for the unauthenticated routes.
 *
 * In process memory on purpose, and honest about what that buys. On a
 * serverless deployment each instance keeps its own counters, so a caller
 * spread across many cold starts sees a higher effective ceiling than the
 * numbers below. That still removes the case these routes actually face: a
 * script hammering one endpoint from one connection, which is what turns an
 * eight-character password policy into a guessable one. A hard, shared limit
 * needs a store every instance can see (Redis, or a table with a unique index
 * on the window) — this is the version that costs nothing and ships today.
 *
 * Two keys per attempt is the useful shape: the address being targeted, so one
 * account cannot be ground down from a botnet, and the caller's IP, so one host
 * cannot walk a list of addresses.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Stops the map growing without bound on a long-lived instance. */
const MAX_KEYS = 10_000;

function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type RateLimit = {
  /** How many attempts are allowed inside the window. */
  readonly limit: number;
  /** Window length in milliseconds. */
  readonly windowMs: number;
};

export type RateLimitResult = {
  readonly ok: boolean;
  /** Seconds until the window resets — the value for `Retry-After`. */
  readonly retryAfter: number;
};

/**
 * Counts one attempt against `key`. The attempt is allowed while the count is
 * inside `limit`; the call is what increments, so only call it once per request.
 */
export function hit(key: string, { limit, windowMs }: RateLimit): RateLimitResult {
  const now = Date.now();
  if (windows.size > MAX_KEYS) sweep(now);

  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  current.count += 1;
  const retryAfter = Math.ceil((current.resetAt - now) / 1000);
  return { ok: current.count <= limit, retryAfter };
}

/**
 * The caller's address, as far as it can be known behind a proxy.
 *
 * `x-forwarded-for` is client-controlled except for the hop the platform
 * appends, so the *last* entry is the one a caller cannot forge on Vercel.
 * Falls back to a constant, which makes the IP limit global rather than absent
 * — deliberately, since a missing header should not open the gate.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Sign-in and password checks: tight, because each one is a guess. */
export const CREDENTIAL_LIMIT: RateLimit = { limit: 10, windowMs: 10 * 60 * 1000 };

/** Account creation and mail-sending: looser, but not a free relay. */
export const SIGNUP_LIMIT: RateLimit = { limit: 5, windowMs: 60 * 60 * 1000 };

/** Anything that sends an email to an address the caller typed. */
export const EMAIL_LIMIT: RateLimit = { limit: 5, windowMs: 60 * 60 * 1000 };
