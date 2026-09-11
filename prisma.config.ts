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
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  async adapter() {
    return new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  },
});
