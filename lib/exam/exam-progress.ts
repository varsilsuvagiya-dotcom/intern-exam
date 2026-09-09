import "server-only";

import { prisma } from "@/lib/db";

/// Persisted navigation progress: where the candidate was, and which questions
/// they have opened.
///
/// This exists because both facts used to live only in React state, so a reload
/// returned the candidate to question 1 and forgot every question they had
/// looked at but not answered. Neither is derivable from anything else: an
/// unanswered question that has been read is indistinguishable from one that
/// has not unless the visit itself is recorded.
///
/// It deliberately does not touch answers, timing or status. Answered state is
/// still derived from the Answer row, the deadline is still computed from
/// `startedAt`, and nothing here can end or reopen an exam.

export type ProgressState = {
  /// AttemptQuestion.displayOrder, or null if the attempt has never reported a
  /// position. Callers open the first question in that case.
  currentDisplayOrder: number | null;
  /// AttemptQuestion ids the candidate has opened.
  visitedQuestionIds: string[];
  /// The highest sequence the server has accepted. A reloaded page continues
  /// counting from here; starting again from zero would make every report look
  /// older than what is already stored, and the candidate's position would stop
  /// being recorded for the rest of the exam.
  positionSeq: number;
};

export type SaveProgressResult =
  | { kind: "saved" }
  | { kind: "stale" }
  | { kind: "finished" }
  | { kind: "unauthorized" }
  | { kind: "invalid"; reason: string }
  | { kind: "failed" };

/// Reads progress for an attempt. The attempt id must already have been
/// resolved from the session cookie by the caller.
export async function loadProgress(attemptId: string): Promise<ProgressState> {
  const [attempt, visited] = await Promise.all([
    prisma.attempt.findUnique({
      where: { id: attemptId },
      select: { currentDisplayOrder: true, currentPositionSeq: true },
    }),
    prisma.attemptQuestion.findMany({
      where: { attemptId, visitedAt: { not: null } },
      select: { id: true },
    }),
  ]);

  return {
    currentDisplayOrder: attempt?.currentDisplayOrder ?? null,
    visitedQuestionIds: visited.map((row) => row.id),
    positionSeq: attempt?.currentPositionSeq ?? 0,
  };
}

/// Records that the candidate has opened a question.
///
/// The browser names the question; nothing else it sends is trusted. The
/// attempt comes from the session cookie, the question must be shown to belong
/// to that attempt, and the position written is the *stored* display order of
/// that row rather than any index the client claims — so a client cannot write
/// a position that does not correspond to a question it was actually given.
///
/// A submitted attempt is refused outright: progress must not mutate a finished
/// exam, and that is enforced here rather than by disabling anything in the UI.
export async function saveProgress(
  attemptId: string,
  attemptQuestionId: string,
  sequence: number,
): Promise<SaveProgressResult> {
  if (typeof attemptQuestionId !== "string" || attemptQuestionId === "") {
    return { kind: "invalid", reason: "missing question" };
  }

  if (!Number.isInteger(sequence) || sequence < 0) {
    return { kind: "invalid", reason: "invalid sequence" };
  }

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { status: true },
  });

  if (!attempt) {
    return { kind: "unauthorized" };
  }

  if (attempt.status !== "in_progress") {
    return { kind: "finished" };
  }

  // Scoped to the authenticated attempt, so a question id from another
  // candidate's paper simply does not resolve.
  const question = await prisma.attemptQuestion.findFirst({
    where: { id: attemptQuestionId, attemptId },
    select: { id: true, displayOrder: true },
  });

  if (!question) {
    return { kind: "unauthorized" };
  }

  try {
    // Both writes are guarded, and neither is a read-modify-write:
    //
    // - The visit is set only where it is still null, so it is recorded once
    //   and a later request can never erase an earlier visit. That is why
    //   visited state needs no sequence number of its own.
    //
    // - The position is set only where the stored sequence is older, so a slow
    //   write for an earlier question landing after a fast one for a later
    //   question is discarded rather than dragging the candidate backwards.
    //
    // The status guard is repeated inside the position write so an attempt
    // finalized between the check above and here cannot be modified.
    const [, position] = await prisma.$transaction([
      prisma.attemptQuestion.updateMany({
        where: { id: question.id, attemptId, visitedAt: null },
        data: { visitedAt: new Date() },
      }),
      prisma.attempt.updateMany({
        where: {
          id: attemptId,
          status: "in_progress",
          currentPositionSeq: { lt: sequence },
        },
        data: {
          currentDisplayOrder: question.displayOrder,
          currentPositionSeq: sequence,
        },
      }),
    ]);

    // The visit is recorded either way; only the position was out of date. The
    // caller does not need to retry — a newer report has already won.
    return position.count === 1 ? { kind: "saved" } : { kind: "stale" };
  } catch (error) {
    console.error("Progress save failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { kind: "failed" };
  }
}
