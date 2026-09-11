import { withEve } from "eve/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * A stray pnpm-lock.yaml in the home directory makes Next pick C:\Users\pc as
   * the workspace root, so module traces and resolution run from the wrong
   * tree. Pin the root to this project.
   */
  turbopack: { root: import.meta.dirname },

  /*
   * Baseline security headers.
   *
   * The CSP here deliberately stops short of `script-src`: Next injects inline
   * bootstrap scripts and hydration payloads, and a policy strict enough to be
   * worth having needs a per-request nonce through middleware. What is here
   * costs nothing and closes the cheap attacks — clickjacking, MIME sniffing,
   * `<base>` rewriting, plugin embedding, and a form posting credentials to
   * somebody else's origin.
   *
   * HSTS is sent in production only: on http://localhost a browser that
   * remembers it would refuse the dev server for the next two years.
   */
  async headers() {
    const csp = [
      "default-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    const headers = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      { key: "Content-Security-Policy-Report-Only", value: csp },
    ];

    if (process.env.NODE_ENV === "production") {
      headers.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [{ source: "/:path*", headers }];
  },
  /*
   * The app used to live at the root, so every link anyone has bookmarked,
   * mailed themselves, or left open in a tab points at the old paths. These
   * keep those working instead of answering a returning user with a 404.
   *
   * Permanent, because the move is not coming back — but note that browsers
   * cache a 308 hard, so a path that ever needs to mean something else again
   * would have to be `permanent: false`.
   */

  async redirects() {
    return [
      { source: "/profile", destination: "/dashboard/profile", permanent: true },
      { source: "/settings", destination: "/dashboard/settings", permanent: true },
      { source: "/applications", destination: "/dashboard/applications", permanent: true },
      {
        source: "/applications/:id",
        destination: "/dashboard/applications/:id",
        permanent: true,
      },
    ];
  },
};

export default withEve(nextConfig);
