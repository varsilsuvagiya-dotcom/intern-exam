import "server-only";

import { LESSON_SECTION } from "@/lib/exam-settings/exam-blueprint";

import { MARKS_DECIMAL_PLACES, MARKS_MAX } from "./csv-contract";

/// Domain rules that hold for a question however it arrived — file import or
/// the admin editor. The import layer additionally deals with column names,
/// header matching and string parsing; those stay in csv-import.ts.

export type FieldError = { field: string; message: string };

export type QuestionShape = {
  section: string;
  marks: string;
  lessonText: string | null;
};

export function validateMarks(raw: string): string | null {
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    return `marks must be a non-negative number, received "${raw}"`;
  }

  if ((raw.split(".")[1]?.length ?? 0) > MARKS_DECIMAL_PLACES) {
    return `marks supports at most ${MARKS_DECIMAL_PLACES} decimal places, received "${raw}"`;
  }

  if (Number(raw) > MARKS_MAX) {
    return `marks must not exceed ${MARKS_MAX}, received "${raw}"`;
  }

  return null;
}

/// Learn-and-Apply is drawn as whole lessons, so its rows must carry the lesson
/// they belong to. The lesson *group* is not checked here: it is not a source
/// field, and the importer derives it from the lesson text once the whole batch
/// is known.
///
/// Marks are validated for shape only, never forced to a per-section value. The
/// source file is the truth for what a question is worth.
export function validateQuestionRules(question: QuestionShape): FieldError[] {
  const errors: FieldError[] = [];

  if (question.section === LESSON_SECTION && !question.lessonText) {
    errors.push({
      field: "lesson_text",
      message: "Learn-and-Apply (LRN) questions must have lesson text",
    });
  }

  return errors;
}
