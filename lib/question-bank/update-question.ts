import "server-only";

import { prisma } from "@/lib/db";
import type { Difficulty, OptionKey, QuestionStatus } from "@/lib/generated/prisma/enums";

import { VALID_SECTIONS, isSectionCode } from "@/lib/exam-settings/exam-blueprint";

import {
  DIFFICULTY_VALUES,
  MAX_TOPIC_LENGTH,
  OPTION_VALUES,
  STATUS_VALUES,
  describeAccepted,
} from "./csv-contract";
import { validateMarks, validateQuestionRules, type FieldError } from "./question-rules";

export type QuestionEdit = {
  section: string;
  topic: string;
  difficulty: Difficulty;
  question: string;
  codeBlock: string | null;
  verifyCode: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: OptionKey;
  explanation: string | null;
  lessonText: string | null;
  lessonGroup: string | null;
  scored: boolean;
  marks: string;
  aiVerified: boolean;
  trainerVerified: boolean;
  status: QuestionStatus;
  isActive: boolean;
};

export type EditValidation =
  | { ok: true; value: QuestionEdit }
  | { ok: false; errors: FieldError[] };

/// Validates the editor's own submission. Note that `id` is absent by design:
/// it is the stable identity and the editor never accepts a new one.
export function validateQuestionEdit(form: FormData): EditValidation {
  const errors: FieldError[] = [];
  const text = (key: string): string => String(form.get(key) ?? "").trim();
  const flag = (key: string): boolean => form.get(key) === "on" || form.get(key) === "true";

  const required = (key: string, label: string): string => {
    const value = text(key);
    if (!value) {
      errors.push({ field: key, message: `${label} is required` });
    }
    return value;
  };

  const section = text("section").toUpperCase();
  if (!isSectionCode(section)) {
    errors.push({ field: "section", message: `Section must be one of ${VALID_SECTIONS.join(", ")}` });
  }

  const topic = required("topic", "Topic");
  if (topic.length > MAX_TOPIC_LENGTH) {
    errors.push({ field: "topic", message: `Topic must be at most ${MAX_TOPIC_LENGTH} characters` });
  }

  const question = required("question", "Question");
  const optionA = required("optionA", "Option A");
  const optionB = required("optionB", "Option B");
  const optionC = required("optionC", "Option C");
  const optionD = required("optionD", "Option D");

  const difficulty = DIFFICULTY_VALUES[text("difficulty").toLowerCase()];
  if (!difficulty) {
    errors.push({ field: "difficulty", message: `Difficulty must be one of ${describeAccepted(DIFFICULTY_VALUES)}` });
  }

  const correct = OPTION_VALUES[text("correct").toLowerCase()];
  if (!correct) {
    errors.push({ field: "correct", message: `Correct answer must be one of ${describeAccepted(OPTION_VALUES)}` });
  }

  const status = STATUS_VALUES[text("status").toLowerCase()];
  if (!status) {
    errors.push({ field: "status", message: `Status must be one of ${describeAccepted(STATUS_VALUES)}` });
  }

  const marks = text("marks");
  const marksError = marks ? validateMarks(marks) : "Marks is required";
  if (marksError) {
    errors.push({ field: "marks", message: marksError });
  }

  const scored = flag("scored");
  const lessonText = text("lessonText") || null;
  const lessonGroup = text("lessonGroup") || null;

  if (errors.length === 0) {
    errors.push(...validateQuestionRules({ section, marks, lessonText }));
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      section,
      topic,
      difficulty: difficulty as Difficulty,
      question,
      codeBlock: text("codeBlock") || null,
      verifyCode: text("verifyCode") || null,
      optionA,
      optionB,
      optionC,
      optionD,
      correct: correct as OptionKey,
      explanation: text("explanation") || null,
      lessonText,
      lessonGroup,
      scored,
      marks,
      aiVerified: flag("aiVerified"),
      trainerVerified: flag("trainerVerified"),
      status: status as QuestionStatus,
      isActive: flag("isActive"),
    },
  };
}

export async function updateQuestion(id: string, edit: QuestionEdit): Promise<boolean> {
  // Scoped by the stable id. Updating the bank deliberately leaves
  // AttemptQuestion alone: those rows carry their own snapshot of the question
  // as it was drawn, which is what keeps submitted attempts reviewable.
  const result = await prisma.question.updateMany({ where: { id }, data: edit });
  return result.count === 1;
}

export async function setQuestionActive(id: string, isActive: boolean): Promise<boolean> {
  // Deactivation is a flag change, never a delete: the row and every historical
  // reference to it stay exactly where they are.
  const result = await prisma.question.updateMany({ where: { id }, data: { isActive } });
  return result.count === 1;
}
