import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/*
 * Serverless multiplies pools, not requests. Every warm instance holds its own
 * pg pool, so the default of 10 connections each empties a small Postgres the
 * moment traffic spreads across a few instances — the failure is P2037, and it
 * arrives all at once rather than gradually.
 *
 * A low ceiling per instance trades a little queueing inside one instance for
 * headroom across all of them, which is the right way round: a request waiting
 * 20ms for a free connection beats a request that cannot get one at all.
 * Idle connections are dropped quickly for the same reason — an instance that
 * has gone quiet should not be sitting on slots a busy one needs.
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    }),
  });

globalForPrisma.prisma = db;
