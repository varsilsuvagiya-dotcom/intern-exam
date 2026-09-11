import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";

/// Connection budget.
///
/// PostgreSQL is configured with max_connections = 60, of which 3 are reserved
/// for superusers and roughly 13 are permanently held by Supabase's own
/// services (Supavisor, PostgREST, pg_cron, postgres_exporter). That leaves
/// about 40 connections the application may safely claim in total — across
/// *every* running instance, not per instance.
///
/// The governing rule is therefore:
///
///     instances x POOL_SIZE <= 40
///
/// At the default pool size of 8 that permits 5 concurrent instances, which
/// covers the planned scaling path well past 500 candidates. Raising the pool
/// without lowering the instance count is how a horizontally scaled deployment
/// exhausts PostgreSQL, so the value is read from the environment and clamped:
/// a deployment that wants a bigger pool has to choose it deliberately.
///
/// Measured, not guessed: 500 concurrent transactions completed with zero
/// failures against a single instance holding a pool of 25, because Supavisor
/// multiplexes many client connections onto far fewer server connections. Pool
/// size was never the limiting factor — the transaction acquisition timeout
/// below was.
const DEFAULT_POOL_SIZE = 8;
const MAX_POOL_SIZE = 20;

function poolSize(): number {
  const raw = Number(process.env.DATABASE_POOL_SIZE);

  if (!Number.isInteger(raw) || raw < 1) {
    return DEFAULT_POOL_SIZE;
  }

  // Clamped rather than trusted: a single instance must not be able to claim
  // the whole cluster budget and starve its siblings.
  return Math.min(raw, MAX_POOL_SIZE);
}

/// Transaction settings.
///
/// `maxWait` is how long a transaction may wait to acquire a connection from
/// the pool; `timeout` is how long it may then run. Prisma's defaults are 2s
/// and 5s, and the 2s default is what actually broke under load: with a ~110ms
/// round trip to the database, an interactive transaction costs several round
/// trips, so requests queue. Once the queue is deeper than 2s, Prisma aborts
/// with P2028 *before* PostgreSQL is ever asked to do any work.
///
/// Measured on this database, identical workload and pool size:
///
///     N=200, pool=50, maxWait=2000ms   -> 96 of 200 failed (P2028)
///     N=200, pool=50, maxWait=10000ms  -> 0 of 200 failed
///     N=500, pool=25, maxWait=10000ms  -> 0 of 500 failed
///
/// 10s is chosen because it is long enough to absorb a start or submission
/// spike at the concurrency levels above, and short enough that a genuinely
/// stuck pool still surfaces as an error rather than hanging a candidate's
/// request indefinitely. It is deliberately well under the 30s flush timeout
/// the exam client already applies to in-flight saves, so a save that cannot
/// get a connection fails and is retried rather than being silently dropped.
///
/// This is a queueing fix, not a licence to be chatty: it buys headroom while
/// the round-trip reductions elsewhere in this change do the real work.
export const TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 15_000,
} as const;

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: poolSize() }),
    transactionOptions: TRANSACTION_OPTIONS,
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Hot reload in dev would otherwise open a new pool on every module reload.
export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
