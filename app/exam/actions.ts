"use server";

import { getExamSessionAttemptId } from "@/lib/exam/exam-session";
import { getAttemptTiming, type TimingState } from "@/lib/exam/exam-timer";
import {
  finalizeAttempt,
  getSubmissionSummary,
  type FinalizeResult,
  type SubmissionSummary,
} from "@/lib/exam/finalize-attempt";
import { saveProgress, type SaveProgressResult } from "@/lib/exam/exam-progress";
import { saveAnswer, type SaveResult } from "@/lib/exam/save-answer";
import { recordViolation } from "@/lib/exam/anti-cheating/service";
import type { RecordViolationResult, ViolationType } from "@/lib/exam/anti-cheating/types";

export type TimingResponse =
  | { kind: "ok"; timing: TimingState }
  | { kind: "unauthorized" }
  | { kind: "finished" };

/// Both actions resolve the attempt from the session cookie. Neither accepts an
/// attempt id, so there is no argument a candidate can change to reach another
/// candidate's exam.

export async function fetchTiming(): Promise<TimingResponse> {
  const attemptId = await getExamSessionAttemptId();

  if (!attemptId) {
    return { kind: "unauthorized" };
  }

  const timing = await getAttemptTiming(attemptId);

  if (timing.kind === "not-found") {
    return { kind: "unauthorized" };
  }

  if (timing.kind === "finished") {
    return { kind: "finished" };
  }

  return { kind: "ok", timing: timing.timing };
}

export async function fetchSubmissionSummary(): Promise<SubmissionSummary> {
  const attemptId = await getExamSessionAttemptId();

  if (!attemptId) {
    return { kind: "not-found" };
  }

  return getSubmissionSummary(attemptId);
}

/// `intent` only expresses which button was pressed. The server decides the
/// resulting status from its own clock, so a manual submit after the deadline
/// still records auto_submitted.
export async function submitExam(intent: "manual" | "automatic"): Promise<FinalizeResult> {
  const attemptId = await getExamSessionAttemptId();

  if (!attemptId) {
    return { kind: "not-found" };
  }

  return finalizeAttempt(attemptId, intent === "automatic" ? "automatic" : "manual");
}

/// Records which question the candidate is on, and that they have seen it.
///
/// `sequence` orders the reports so a stale one cannot overwrite a newer
/// position; it carries no authority of its own. Like every other action here
/// it takes no attempt id — the attempt comes from the session cookie.
export async function persistProgress(
  attemptQuestionId: string,
  sequence: number,
): Promise<SaveProgressResult> {
  const attemptId = await getExamSessionAttemptId();

  if (!attemptId) {
    return { kind: "unauthorized" };
  }

  return saveProgress(attemptId, attemptQuestionId, sequence);
}

/// Reports a detected anti-cheating event. `type` only names what the browser
/// saw; the attempt, the running count and the limit are all resolved and
/// enforced server-side — see recordViolation for the full contract.
export async function reportViolation(
  type: ViolationType,
  metadata?: Record<string, unknown>,
): Promise<RecordViolationResult> {
  return recordViolation(type, metadata);
}

export async function persistAnswer(
  attemptQuestionId: string,
  value: { selectedOption?: string | null; textAnswer?: string | null },
): Promise<SaveResult> {
  const attemptId = await getExamSessionAttemptId();

  if (!attemptId) {
    return { kind: "unauthorized" };
  }

  return saveAnswer(attemptId, attemptQuestionId, value);
}
