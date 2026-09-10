import "server-only";

import { prisma } from "@/lib/db";
import { sectionBlueprintByOrdinal } from "@/lib/exam-settings/exam-blueprint";
import type { OptionKey } from "@/lib/generated/prisma/enums";

import { getAttemptTiming } from "./exam-timer";

/// Generous enough that no candidate hits it while writing a considered
/// paragraph, bounded so a single row cannot grow without limit.
export const MAX_TEXT_ANSWER = 5000;

const OPTION_KEYS = new Set<string>(["a", "b", "c", "d"]);

export type SaveResult =
  | { kind: "saved" }
  | { kind: "expired" }
  | { kind: "finished" }
  | { kind: "unauthorized" }
  | { kind: "invalid"; reason: string }
  | { kind: "failed" };

/// Persists one answer.
///
/// The browser names the question it is answering, but nothing else it sends is
/// trusted: the attempt comes from the session cookie, the question must be
/// shown to belong to that attempt, and whether the question is free-text is
/// decided from the stored section rather than from any client flag. Marks and
/// correctness are never accepted from the browser and are not computed here —
/// they stay null until scoring.
export async function saveAnswer(
  attemptId: string,
  attemptQuestionId: string,
  value: { selectedOption?: string | null; textAnswer?: string | null },
): Promise<SaveResult> {
  if (typeof attemptQuestionId !== "string" || attemptQuestionId === "") {
    return { kind: "invalid", reason: "missing question" };
  }

  const timing = await getAttemptTiming(attemptId);

  if (timing.kind === "not-found") {
    return { kind: "unauthorized" };
  }

  if (timing.kind === "finished") {
    return { kind: "finished" };
  }

  // Writes stop the moment the deadline passes, so a candidate cannot keep
  // answering by holding the page open.
  if (timing.timing.expired) {
    return { kind: "expired" };
  }

  // Scoped to the authenticated attempt, so a question id belonging to someone
  // else's paper simply does not resolve.
  const question = await prisma.attemptQuestion.findFirst({
    where: { id: attemptQuestionId, attemptId },
    select: { id: true, section: true },
  });

  if (!question) {
    return { kind: "unauthorized" };
  }

  const blueprint = sectionBlueprintByOrdinal(question.section);
  const isFreeText = blueprint === undefined;

  let selectedOption: OptionKey | null = null;
  let textAnswer: string | null = null;

  if (isFreeText) {
    const raw = value.textAnswer;

    if (typeof raw !== "string") {
      return { kind: "invalid", reason: "this question expects written text" };
    }

    if (raw.length > MAX_TEXT_ANSWER) {
      return { kind: "invalid", reason: "answer is too long" };
    }

    // Only the outer edges are trimmed; line breaks and indentation a candidate
    // typed on purpose are kept.
    textAnswer = raw.trim() === "" ? null : raw;
  } else {
    const raw = value.selectedOption;

    if (raw !== null && (typeof raw !== "string" || !OPTION_KEYS.has(raw))) {
      return { kind: "invalid", reason: "that is not one of the available options" };
    }

    selectedOption = (raw as OptionKey | null) ?? null;
  }

  try {
    await prisma.answer.upsert({
      where: { attemptQuestionId: question.id },
      create: { attemptId, attemptQuestionId: question.id, selectedOption, textAnswer },
      // isCorrect and marksAwarded are deliberately untouched: scoring owns them.
      update: { selectedOption, textAnswer },
    });

    return { kind: "saved" };
  } catch (error) {
    console.error("Answer save failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { kind: "failed" };
  }
}

/// Existing answers for an attempt, keyed by AttemptQuestion id so the exam UI
/// can restore them directly. Correctness columns are not selected.
export async function loadAnswers(attemptId: string): Promise<Record<string, string>> {
  const rows = await prisma.answer.findMany({
    where: { attemptId },
    select: { attemptQuestionId: true, selectedOption: true, textAnswer: true },
  });

  const answers: Record<string, string> = {};

  for (const row of rows) {
    const value = row.selectedOption ?? row.textAnswer;

    if (value !== null && value !== undefined) {
      answers[row.attemptQuestionId] = value;
    }
  }

  return answers;
}
