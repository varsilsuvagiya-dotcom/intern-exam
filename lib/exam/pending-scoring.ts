import "server-only";

import { prisma } from "@/lib/db";

import { scoreAttempt, type ScoreResult } from "./scoring";

/// Recovery for attempts that were submitted but never scored.
///
/// Submission and scoring are deliberately separate: `finalizeAttempt` puts the
/// attempt into a terminal state first and only then scores it, because a
/// scoring failure must never undo a submission — reverting to in_progress
/// would hand a finished candidate their exam back. The consequence is that a
/// scoring failure leaves a real, submitted attempt with `scoredAt` still null.
///
/// Under load that stopped being hypothetical: 16 of 50 simultaneous
/// submissions ended with no score, because scoring's transaction could not
/// acquire a connection in time. The attempt and every answer were intact; only
/// the computed result was missing, and nothing ever went back for it.
///
/// This module is that "going back". It is the counterpart to the swallowed
/// error in `scoreFinalizedAttempt`: the failure is logged there and repaired
/// here. Scoring is idempotent — every run recomputes the whole result from the
/// stored paper and stored answers and writes it with ON CONFLICT DO UPDATE, so
/// re-running it is a no-op rather than a doubling. That is what makes an
/// at-least-once retry safe.

/// An attempt that is finished but has no score.
export type PendingAttempt = {
  id: string;
  status: "submitted" | "auto_submitted";
  submittedAt: Date | null;
  candidateName: string;
};

export type BackfillOutcome = {
  examined: number;
  scored: number;
  /// Attempts that were looked at and deliberately left alone — a paper drawn
  /// under an older blueprint, or one that cannot produce a valid score. These
  /// need a human, and retrying them forever would hide that.
  skipped: { attemptId: string; reason: ScoreResult["kind"] }[];
  /// Attempts whose scoring threw again. These stay pending and are retried by
  /// the next run.
  failed: { attemptId: string; error: string }[];
  /// True when this invocation declined because another run held the lock.
  /// Normal operation for a scheduler firing faster than the work completes —
  /// reported so a caller can tell "nothing to do" from "someone else is doing
  /// it", which look identical otherwise.
  skippedConcurrent?: boolean;
};

/// Every attempt still waiting for a score, oldest submission first.
///
/// This is the query the admin view and the retry both run. It is deliberately
/// the plain definition of the problem — finished, but unscored — rather than
/// anything cleverer, so there is no way for an attempt to be pending and yet
/// invisible to it.
export async function findPendingScoring(limit = 100): Promise<PendingAttempt[]> {
  const rows = await prisma.attempt.findMany({
    where: {
      status: { not: "in_progress" },
      scoredAt: null,
    },
    orderBy: { submittedAt: "asc" },
    take: limit,
    select: {
      id: true,
      status: true,
      submittedAt: true,
      candidate: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    // `status` is narrowed by the query: in_progress is excluded above.
    status: row.status as "submitted" | "auto_submitted",
    submittedAt: row.submittedAt,
    candidateName: row.candidate.name,
  }));
}

/// How many attempts are waiting. Cheap enough for an admin dashboard to poll.
export async function countPendingScoring(): Promise<number> {
  return prisma.attempt.count({
    where: { status: { not: "in_progress" }, scoredAt: null },
  });
}

/// Identifies this job to PostgreSQL's advisory lock space.
///
/// An arbitrary constant, chosen once and never derived from anything, so every
/// instance asks for the same lock. Advisory locks live in a single global
/// namespace, so the only requirement is that nothing else picks this number.
const BACKFILL_LOCK_KEY = 8_140_231;

/// Takes the backfill lock, if it is free.
///
/// The lock is transaction-scoped rather than session-scoped, and that
/// distinction is load-bearing. The application connects through Supabase's
/// pooler in transaction mode, which hands out a different backend per
/// transaction, so a session-level `pg_advisory_lock` is taken on one backend
/// and looked for on another and provides no mutual exclusion whatsoever. That
/// was measured rather than assumed: through the pooled URL two concurrent
/// callers *both* acquired a session lock, while the transaction-scoped form
/// correctly granted it to one and refused the other.
///
/// Because the lock lives and dies with its transaction, the caller must do its
/// work inside that transaction. PostgreSQL releases it on commit, rollback, or
/// a dropped connection, so there is nothing to unlock by hand and a crashed
/// run cannot wedge the job.
async function withBackfillLock<T>(
  run: () => Promise<T>,
  declined: () => T,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(${BACKFILL_LOCK_KEY}) AS locked
    `;

    return locked ? run() : declined();
  });
}

/// Scores everything that is still pending.
///
/// Attempts are processed one at a time rather than in parallel. That is the
/// whole point: this runs *because* the database was under pressure, and firing
/// a hundred concurrent scoring transactions at a pool that just failed to
/// serve them would reproduce the original failure. Sequential is slower and
/// cannot make things worse.
///
/// Only one run happens at a time, across every instance. A scheduler firing
/// every minute will eventually fire again while a previous run is still
/// working, and two runners would then score the same attempts twice.
/// Idempotency makes that *correct*, but it is still twice the transactions and
/// twice the connections at the exact moment the database is already
/// struggling — which is what produced the unscored attempts in the first
/// place. An advisory lock is the smallest thing that prevents it: no schema
/// change, no new infrastructure, no lock table to clean up. `try` rather than
/// a blocking acquire, so a second run declines immediately instead of piling
/// up behind the first.
///
/// Declining is reported, not thrown: a skipped run is normal operation for a
/// scheduler firing faster than the work completes, not an error to alert on.
///
/// The batch is bounded by `limit`, so the lock is held for a bounded time and
/// anything left over is picked up by the next run.
export async function backfillPendingScoring(limit = 20): Promise<BackfillOutcome> {
  return withBackfillLock(
    () => runBackfill(limit),
    () => {
      console.info("Scoring backfill skipped: another run is already in progress.");
      return { examined: 0, scored: 0, skipped: [], failed: [], skippedConcurrent: true };
    },
  );
}

async function runBackfill(limit: number): Promise<BackfillOutcome> {
  const pending = await findPendingScoring(limit);

  const outcome: BackfillOutcome = {
    examined: pending.length,
    scored: 0,
    skipped: [],
    failed: [],
  };

  for (const attempt of pending) {
    try {
      const result = await scoreAttempt(attempt.id);

      if (result.kind === "scored") {
        outcome.scored += 1;
        continue;
      }

      // Not an error to retry: these are states a rerun cannot improve.
      // `not-finalized` can only mean the attempt changed under us, which the
      // next run will see correctly.
      outcome.skipped.push({ attemptId: attempt.id, reason: result.kind });

      console.warn("Scoring backfill skipped an attempt.", {
        attemptId: attempt.id,
        reason: result.kind,
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "UnknownError";

      outcome.failed.push({ attemptId: attempt.id, error: name });

      // Left pending on purpose, so the next run picks it up again.
      console.error("Scoring backfill failed for an attempt; it remains pending.", {
        attemptId: attempt.id,
        name,
      });
    }
  }

  if (outcome.examined > 0) {
    console.info("Scoring backfill finished.", {
      examined: outcome.examined,
      scored: outcome.scored,
      skipped: outcome.skipped.length,
      failed: outcome.failed.length,
    });
  }

  return outcome;
}
