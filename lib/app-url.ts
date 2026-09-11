/**
 * The public origin this deployment answers on.
 *
 * Every link that leaves the process — a verification email, a Stripe return
 * URL, an OAuth callback — is built from this. A wrong value is silent from
 * inside: the page renders, the mail sends, and the recipient lands on a host
 * that is not us. So the localhost default is confined to development, and a
 * production boot without an origin fails instead of guessing.
 *
 * `VERCEL_PROJECT_PRODUCTION_URL` is the fallback because a Git-connected
 * deploy has it before anyone has set `APP_URL`, and it names the production
 * domain rather than the per-deployment one — a preview must not mail out
 * links that die with the next push.
 */
export function baseUrl(): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit;

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing APP_URL. Set it to the public origin (e.g. https://example.com) — verification links, OAuth callbacks and Stripe return URLs are built from it.",
    );
  }

  return "http://localhost:3000";
}

/** Absolute URL for `path` against this deployment's origin. */
export function appUrl(path: string): string {
  return new URL(path, baseUrl()).toString();
}
