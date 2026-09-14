import "server-only";

import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { getExamSessionAttemptId } from "@/lib/exam/exam-session";
import { terminateForViolation } from "@/lib/exam/finalize-attempt";

import { reachesLimit, type RecordViolationResult, type ViolationType } from "./types";

/// Records one detected anti-cheating event and decides whether it ends the
/// attempt.
///
/// The attempt is always the one on the session cookie — this never takes an
/// attempt id from the browser, so there is no argument a candidate can
/// change to affect another attempt. The violation count and the limit are
/// both read from the server; the browser only ever names *which* event it
/// saw.
///
/// Race safety: the violation row and the counter increment are written in
/// one transaction, and the increment is a conditional `updateMany` guarded
/// on `status = in_progress` — the same idiom `saveProgress` and
/// `finalizeAttempt` already use elsewhere in this codebase. Two violations
/// arriving at the same instant (e.g. a tab switch and a copy attempt firing
/// together) each get their own row and their own turn at the counter; there
/// is no read-modify-write gap for them to clobber.
export async function recordViolation(
  type: ViolationType,
  metadata?: Record<string, unknown>,
): Promise<RecordViolationResult> {
  const attemptId = await getExamSessionAttemptId();

  if (!attemptId) {
    return { kind: "unauthorized" };
  }

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { status: true },
  });

  if (!attempt) {
    return { kind: "unauthorized" };
  }

  if (attempt.status !== "in_progress") {
    return { kind: "already-final" };
  }

  const settings = await prisma.examSetting.findUniqueOrThrow({
    where: { id: "singleton" },
    select: { unauthorizedActivityLimit: true },
  });
  const limit = settings.unauthorizedActivityLimit;

  const [priorCount, incremented] = await prisma.$transaction(async (tx) => {
    const count = await tx.examViolation.count({ where: { attemptId } });

    await tx.examViolation.create({
      data: {
        attemptId,
        type,
        sequence: count + 1,
        metadata: (metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });

    // Guarded exactly like every other attempt write here: only applies while
    // the attempt is still in progress, so a violation that loses a race
    // against finalization cannot resurrect a count on a finished attempt.
    const updated = await tx.attempt.updateMany({
      where: { id: attemptId, status: "in_progress" },
      data: { violationCount: { increment: 1 } },
    });

    return [count, updated.count === 1] as const;
  });

  if (!incremented) {
    // The attempt finished between the status check above and this write
    // (a manual submit, an auto-submit, or another violation reaching the
    // limit first). The event is already recorded for the audit trail; it
    // just does not get to end an attempt that is already over.
    return { kind: "already-final" };
  }

  const newCount = priorCount + 1;

  if (!reachesLimit(newCount, limit)) {
    return { kind: "warning", count: newCount, limit };
  }

  const outcome = await terminateForViolation(attemptId);

  if (outcome.kind === "terminated") {
    return { kind: "terminated", count: newCount, limit };
  }

  // Someone else (a submit, an auto-submit) finalized it first. The
  // violation is still recorded; the attempt simply ended a different way.
  return { kind: "already-final" };
}
