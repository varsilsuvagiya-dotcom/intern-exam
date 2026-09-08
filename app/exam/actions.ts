"use server";

import { getExamSessionAttemptId } from "@/lib/exam/exam-session";
import { getAttemptTiming, type TimingState } from "@/lib/exam/exam-timer";
import { saveAnswer, type SaveResult } from "@/lib/exam/save-answer";

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
