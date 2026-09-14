import "server-only";

import { prisma } from "@/lib/db";
import type { OptionKey } from "@/lib/generated/prisma/enums";

/// The eligible question pool, cached per process for a short time.
///
/// Every exam start reads the whole pool of ready, active questions to draw a
/// paper from. That read is identical for every candidate and changes only when
/// an administrator edits the question bank, so re-reading it once per start is
/// pure waste: at a 100-candidate exam opening it is 100 identical scans of the
/// same rows across a ~110ms link.
///
/// Why a per-process cache is safe here, and does not need Redis:
///
///  1. It is never the source of truth for a sat paper. The drawn paper is
///     snapshotted into AttemptQuestion, and every later read — rendering,
///     scoring, review — goes to that snapshot. A stale pool can only influence
///     which questions a *new* paper draws from.
///  2. Every paper is validated before it is written. `validateGeneratedPaper`
///     checks the question count, the total marks, section blocks and order,
///     lesson-group completeness and contiguity, and option permutations. A
///     paper built from a stale pool either satisfies the blueprint exactly or
///     is refused; it cannot be written in a broken state.
///  3. Staleness is bounded and benign. The worst case is that a question
///     activated or deactivated within the TTL is briefly still drawable, or
///     briefly not. Both are states the exam already tolerates: an admin edit
///     has never applied retroactively to papers already drawn.
///  4. Instances need not agree. Two instances holding different pool
///     snapshots each draw a valid paper. Papers are per-candidate and
///     independently randomized anyway, so there is nothing for them to agree
///     about.
///
/// The TTL is deliberately short. It is long enough to collapse a start spike —
/// the case that matters — and short enough that an administrator activating a
/// question sees it take effect in about the time it takes to navigate back to
/// the questions list.
const POOL_TTL_MS = 30_000;

/// Exactly the columns paper generation and the AttemptQuestion snapshot need.
///
/// `verifyCode` is deliberately absent: it is internal verification data and
/// has no place in a drawn paper, so it is not loaded at all rather than being
/// loaded and then dropped. `correct`, `explanation` and `lessonGroup` *are*
/// loaded, because the snapshot stores them for scoring and admin review — they
/// are withheld from the candidate later, by `getCandidatePaper`, which names
/// every field it sends.
export type PoolRow = {
  id: string;
  section: string;
  difficulty: string;
  question: string;
  codeBlock: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: OptionKey;
  explanation: string | null;
  lessonText: string | null;
  lessonGroup: string | null;
  marks: string;
  scored: boolean;
};

type CacheEntry = { rows: PoolRow[]; expiresAt: number };

/// Held on globalThis for the same reason the Prisma client is: a dev hot
/// reload would otherwise leave the old cache behind on every module reload.
const globalForPool = globalThis as unknown as {
  questionPool: CacheEntry | undefined;
  questionPoolInFlight: Promise<PoolRow[]> | undefined;
};

async function readPool(): Promise<PoolRow[]> {
  const rows = await prisma.question.findMany({
    where: { isActive: true },
    select: {
      id: true,
      section: true,
      difficulty: true,
      question: true,
      codeBlock: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      correct: true,
      explanation: true,
      lessonText: true,
      lessonGroup: true,
      marks: true,
      scored: true,
    },
  });

  // Decimal is converted once here rather than per draw: it is not structurally
  // cloneable and the generator wants the string form anyway.
  return rows.map((row) => ({ ...row, marks: row.marks.toString() }));
}

/// The eligible pool, from cache when it is fresh.
///
/// Concurrent callers that arrive on a cold cache share one query rather than
/// each issuing their own — without this, a start spike would still send one
/// scan per candidate, which is the exact problem being solved.
export async function getQuestionPool(): Promise<PoolRow[]> {
  const cached = globalForPool.questionPool;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.rows;
  }

  const inFlight = globalForPool.questionPoolInFlight;

  if (inFlight) {
    return inFlight;
  }

  const request = readPool()
    .then((rows) => {
      globalForPool.questionPool = { rows, expiresAt: Date.now() + POOL_TTL_MS };
      return rows;
    })
    .finally(() => {
      globalForPool.questionPoolInFlight = undefined;
    });

  globalForPool.questionPoolInFlight = request;

  return request;
}

/// Drops the cached pool in this process.
///
/// Called after an administrator changes the question bank so their own next
/// view reflects the edit immediately. It is explicitly *not* a distributed
/// invalidation: other instances keep their copy until it expires, which is
/// safe for the reasons above. Correctness never depends on this being called.
export function invalidateQuestionPool(): void {
  globalForPool.questionPool = undefined;
}
