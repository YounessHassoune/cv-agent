import { PrismaPg } from "@prisma/adapter-pg";
import { defineConfig } from "prisma/config";

// Node 24 native .env loading; absent file is fine (e.g. CI with real env vars).
try {
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  /*
   * Migrations take DIRECT_URL when it is set, the pooled URL otherwise.
   * A connection pooler in transaction mode cannot run DDL — it hands each
   * statement a different backend, so the advisory lock `migrate deploy`
   * takes is gone by the statement that needs it. The runtime adapter below
   * keeps the pooled URL, which is the one it wants.
   */
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
  async adapter() {
    return new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  },
});
