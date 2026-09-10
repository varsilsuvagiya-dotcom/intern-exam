import "server-only";

import { prisma } from "@/lib/db";
import { sectionBlueprintByOrdinal } from "@/lib/exam-settings/exam-blueprint";

import { computeTiming } from "./exam-timer";
import { scoreAttempt } from "./scoring";

export type TerminalStatus = "submitted" | "auto_submitted";

export type FinalizeResult =
  | { kind: "finalized"; status: TerminalStatus; alreadyFinal: boolean }
  /// An automatic submission arrived while time still remained; the exam stays open.
  | { kind: "not-expired" }
  | { kind: "not-found" };

export type SubmissionSummary =
  | {
      kind: "ok";
      total: number;
      answered: number;
      /// Display numbers, so the candidate sees "4, 8, 17" rather than row ids.
      unanswered: number[];
      expired: boolean;
    }
  | { kind: "not-found" }
  | { kind: "finished"; status: TerminalStatus };

/// A question counts as answered when the stored row holds something real: a
/// chosen option, or free text with more than whitespace in it. Read from the
/// database rather than from the browser, so the confirmation cannot overstate
/// what was actually saved.
function isAnswered(
  section: number,
  row: { selectedOption: string | null; textAnswer: string | null } | null | undefined,
): boolean {
  if (!row) {
    return false;
  }

  const blueprint = sectionBlueprintByOrdinal(section);
  const freeText = blueprint === undefined;

  return freeText ? (row.textAnswer ?? "").trim() !== "" : row.selectedOption !== null;
}

/// What the confirmation dialog needs, computed entirely from persisted state.
export async function getSubmissionSummary(attemptId: string): Promise<SubmissionSummary> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { status: true, startedAt: true },
  });

  if (!attempt) {
    return { kind: "not-found" };
  }

  if (attempt.status !== "in_progress") {
    return { kind: "finished", status: attempt.status };
  }

  const settings = await prisma.examSetting.findUniqueOrThrow({
    where: { id: "singleton" },
    select: { durationMinutes: true },
  });

  const questions = await prisma.attemptQuestion.findMany({
    where: { attemptId },
    orderBy: { displayOrder: "asc" },
    select: {
      displayOrder: true,
      section: true,
      answer: { select: { selectedOption: true, textAnswer: true } },
    },
  });

  const unanswered = questions
    .filter((question) => !isAnswered(question.section, question.answer))
    .map((question) => question.displayOrder);

  return {
    kind: "ok",
    total: questions.length,
    answered: questions.length - unanswered.length,
    unanswered,
    expired: computeTiming(attempt.startedAt, settings.durationMinutes).expired,
  };
}

/// Scores an attempt that has just been finalized.
///
/// Finalization deliberately does not depend on this succeeding. The attempt is
/// already in a terminal state by the time this runs, and a scoring failure must
/// not undo that — reverting to in_progress would hand a submitted candidate
/// their exam back. So a failure is logged and swallowed, leaving the attempt
/// finalized with `scoredAt` still null, which is exactly the state a later
/// re-run of scoreAttempt() picks up and completes.
async function scoreFinalizedAttempt(attemptId: string): Promise<void> {
  try {
    const result = await scoreAttempt(attemptId);

    if (result.kind !== "scored") {
      console.error("Scoring did not complete for a finalized attempt.", {
        attemptId,
        kind: result.kind,
      });
    }
  } catch (error) {
    console.error("Scoring threw for a finalized attempt; it remains finalized and unscored.", {
      attemptId,
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

/// Ends an attempt.
///
/// The status is decided by the server clock, not by the caller: a manual submit
/// that arrives after the deadline is recorded as auto_submitted, because the
/// exam had already ended when the request landed.
///
/// The write is a conditional update guarded on `status = in_progress`, so
/// exactly one request can ever perform the transition. A second submit, a
/// racing auto-submit, or a retry all find zero rows updated and return the
/// state that won, leaving its `submittedAt` untouched. Nothing here scores
/// anything or alters answers.
export async function finalizeAttempt(
  attemptId: string,
  intent: "manual" | "automatic",
): Promise<FinalizeResult> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { status: true, startedAt: true },
  });

  if (!attempt) {
    return { kind: "not-found" };
  }

  if (attempt.status !== "in_progress") {
    return { kind: "finalized", status: attempt.status, alreadyFinal: true };
  }

  const settings = await prisma.examSetting.findUniqueOrThrow({
    where: { id: "singleton" },
    select: { durationMinutes: true },
  });

  const timing = computeTiming(attempt.startedAt, settings.durationMinutes);

  // An automatic submission is only honoured once the server agrees the time is
  // up; a browser claiming zero remaining proves nothing, and the exam stays
  // open rather than being ended early on the client's say-so.
  if (intent === "automatic" && !timing.expired) {
    return { kind: "not-expired" };
  }

  const status: TerminalStatus = timing.expired ? "auto_submitted" : "submitted";

  const result = await prisma.attempt.updateMany({
    where: { id: attemptId, status: "in_progress" },
    data: { status, submittedAt: new Date() },
  });

  if (result.count === 1) {
    console.info(`Attempt finalized as ${status}.`);
    await scoreFinalizedAttempt(attemptId);
    return { kind: "finalized", status, alreadyFinal: false };
  }

  // Someone else got there first. Report their outcome rather than overwriting.
  const settled = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { status: true },
  });

  if (!settled || settled.status === "in_progress") {
    return { kind: "not-found" };
  }

  return { kind: "finalized", status: settled.status, alreadyFinal: true };
}
