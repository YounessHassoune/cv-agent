import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  /*
   * A stray pnpm-lock.yaml in the home directory makes Next pick C:\Users\pc as
   * the workspace root, so module traces and resolution run from the wrong
   * tree. Pin the root to this project.
   */
  turbopack: { root: import.meta.dirname },
};

export default withEve(nextConfig);
