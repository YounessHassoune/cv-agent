/**
 * Runs `prisma migrate deploy` during a Vercel build, but only for production.
 *
 * Preview deployments share the production DATABASE_URL unless someone gave
 * them their own, so an unguarded migrate in the build command means every
 * push to every branch rewrites the live schema — usually before the code that
 * needs it is merged. Guarding on VERCEL_ENV keeps previews read-only against
 * whatever schema production is already on.
 *
 * Outside Vercel this is a no-op, so a local `pnpm build` never touches a
 * remote database.
 */
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (env !== "production") {
  console.log(`deploy-migrate: skipped (VERCEL_ENV=${env ?? "unset"}).`);
  process.exit(0);
}

if (!process.env.DIRECT_URL && !process.env.DATABASE_URL) {
  console.error("deploy-migrate: neither DIRECT_URL nor DATABASE_URL is set.");
  process.exit(1);
}

const result = spawnSync("prisma", ["migrate", "deploy"], {
  stdio: "inherit",
  shell: true,
});

process.exit(result.status ?? 1);
