import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.ts";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/*
 * Serverless multiplies pools, not requests. Every warm instance holds its own
 * pg pool, so the default of 10 connections each empties a small Postgres the
 * moment traffic spreads across a few instances — the failure is P2037, and it
 * arrives all at once rather than gradually.
 *
 * The count that matters is processes, not requests: the proxy is its own
 * function and the route handlers are grouped into others, so `max` is
 * multiplied by however many are awake. Against a 20-slot server that leaves
 * room for one connection each, and idle ones are returned quickly so a
 * function that has gone quiet is not sitting on a slot a busy one needs.
 *
 * One connection per process serializes queries inside a process. That is the
 * cost of fitting; a connection pooler in front of Postgres is what removes
 * the constraint rather than rationing it.
 */
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      max: 1,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
    }),
  });

globalForPrisma.prisma = db;
