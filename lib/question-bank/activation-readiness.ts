import "server-only";

import {
  LESSON_SECTION,
  QUESTIONS_PER_LESSON_GROUP,
  isSectionCode,
} from "@/lib/exam-settings/exam-blueprint";
import { Difficulty, OptionKey, QuestionStatus } from "@/lib/generated/prisma/enums";

import { validateMarks } from "./question-rules";

/// Whether a question may be activated — the single server-side authority.
///
/// Activation is what makes a question drawable, so this is the last gate
/// before a question can reach a candidate. Paper generation draws on
/// `status: ready AND isActive: true`; this function decides whether a question
/// is fit to be given that second flag.
///
/// The rules here are deliberately only those the candidate exam already
/// depends on. Nothing about business intent — whether a question is *good*, or
/// whether its marks match the blueprint — is decided here. Marks are checked
/// for storable shape only, never against the blueprint's per-section value:
/// the source file is the truth for what a question is worth, and reconciling a
/// mismatch is a business decision rather than a validation rule.

/// Structured reasons, so the UI can explain a refusal rather than just deny it.
export type NotReadyReason =
  | "MISSING_QUESTION_TEXT"
  | "MISSING_OPTION"
  | "INVALID_CORRECT_ANSWER"
  | "INVALID_MARKS"
  | "INVALID_DIFFICULTY"
  | "INVALID_SECTION"
  | "INVALID_STATUS"
  | "MISSING_LESSON_TEXT"
  | "INVALID_LESSON_GROUP";

export const NOT_READY_MESSAGE: Record<NotReadyReason, string> = {
  MISSING_QUESTION_TEXT: "Question text is empty",
  MISSING_OPTION: "One or more options are empty",
  INVALID_CORRECT_ANSWER: "Correct answer is not one of A–D",
  INVALID_MARKS: "Marks are not a valid storable value",
  INVALID_DIFFICULTY: "Difficulty is not easy, medium or hard",
  INVALID_SECTION: "Section is not one of the seven active section codes",
  INVALID_STATUS: "Status is not a recognised authoring status",
  MISSING_LESSON_TEXT: "Learn-and-Apply questions must carry lesson text",
  INVALID_LESSON_GROUP: "Learn-and-Apply questions must belong to a lesson group",
};

/// The fields activation depends on. A plain shape rather than the Prisma row
/// type, so this stays testable without a database and callers can select only
/// what they need.
export type ActivationCandidate = {
  id: string;
  section: string;
  difficulty: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: string;
  lessonText: string | null;
  lessonGroup: string | null;
  marks: string;
  status: string;
};

export type ReadinessVerdict =
  | { ready: true }
  | { ready: false; reasons: NotReadyReason[] };

const DIFFICULTIES = new Set<string>(Object.values(Difficulty));
const OPTIONS = new Set<string>(Object.values(OptionKey));
const STATUSES = new Set<string>(Object.values(QuestionStatus));

function blank(value: string | null): boolean {
  return (value ?? "").trim() === "";
}

/// Every reason a question fails, not just the first: an admin fixing a
/// question should see the whole list rather than discover them one at a time.
export function checkActivationReadiness(question: ActivationCandidate): ReadinessVerdict {
  const reasons: NotReadyReason[] = [];

  // A retired or invented section code can never be activated. Section 8 is
  // gone from the blueprint, so it fails here by construction rather than by a
  // special case naming it.
  if (!isSectionCode(question.section)) {
    reasons.push("INVALID_SECTION");
  }

  if (blank(question.question)) {
    reasons.push("MISSING_QUESTION_TEXT");
  }

  if (
    blank(question.optionA) ||
    blank(question.optionB) ||
    blank(question.optionC) ||
    blank(question.optionD)
  ) {
    reasons.push("MISSING_OPTION");
  }

  if (!OPTIONS.has(question.correct)) {
    reasons.push("INVALID_CORRECT_ANSWER");
  }

  if (!DIFFICULTIES.has(question.difficulty)) {
    reasons.push("INVALID_DIFFICULTY");
  }

  if (!STATUSES.has(question.status)) {
    reasons.push("INVALID_STATUS");
  }

  if (validateMarks(question.marks) !== null) {
    reasons.push("INVALID_MARKS");
  }

  // Learn-and-Apply is drawn as whole lessons of three, so a question missing
  // either half of that pairing would break the draw rather than merely read
  // oddly. The group's *size* is checked across the batch, not here.
  if (question.section === LESSON_SECTION) {
    if (blank(question.lessonText)) {
      reasons.push("MISSING_LESSON_TEXT");
    }
    if (blank(question.lessonGroup)) {
      reasons.push("INVALID_LESSON_GROUP");
    }
  }

  return reasons.length === 0 ? { ready: true } : { ready: false, reasons };
}

export type BatchProblem = { id: string; reasons: NotReadyReason[] };

/// Checks a whole batch, including the one rule that cannot be judged from a
/// single row: a Learn-and-Apply lesson group is only usable at exactly three
/// questions, since a partial lesson can never be drawn.
///
/// `groupSizes` carries the size of each group as it stands in the database,
/// not merely within the selection — activating one question of a three-question
/// lesson is legitimate when the other two are already active.
export function checkActivationBatch(
  questions: ActivationCandidate[],
  groupSizes: Map<string, number>,
): BatchProblem[] {
  const problems: BatchProblem[] = [];

  for (const question of questions) {
    const verdict = checkActivationReadiness(question);
    const reasons = verdict.ready ? [] : [...verdict.reasons];

    if (
      question.section === LESSON_SECTION &&
      question.lessonGroup &&
      groupSizes.get(question.lessonGroup) !== QUESTIONS_PER_LESSON_GROUP &&
      !reasons.includes("INVALID_LESSON_GROUP")
    ) {
      reasons.push("INVALID_LESSON_GROUP");
    }

    if (reasons.length > 0) {
      problems.push({ id: question.id, reasons });
    }
  }

  return problems;
}
