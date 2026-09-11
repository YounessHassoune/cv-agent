import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  /*
   * A stray pnpm-lock.yaml in the home directory makes Next pick C:\Users\pc as
   * the workspace root, so module traces and resolution run from the wrong
   * tree. Pin the root to this project.
   */
  turbopack: { root: import.meta.dirname },

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
