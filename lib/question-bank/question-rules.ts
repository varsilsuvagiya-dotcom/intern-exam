import "server-only";

import {
  LESSON_SECTION,
  MARKS_DECIMAL_PLACES,
  MARKS_MAX,
  UNSCORED_SECTION,
} from "./csv-contract";

/// Domain rules that hold for a question however it arrived — CSV import or the
/// admin editor. The CSV layer additionally deals with column names, header
/// checks and string parsing; those stay in csv-import.ts.

export type FieldError = { field: string; message: string };

export type QuestionShape = {
  section: number;
  scored: boolean;
  marks: string;
  lessonText: string | null;
  lessonGroup: string | null;
};

/// Field names here are the domain names. The CSV layer maps them to column
/// names so its errors stay in the caller's vocabulary.
export const RULE_FIELDS = {
  lessonText: "lessonText",
  lessonGroup: "lessonGroup",
  scored: "scored",
  marks: "marks",
} as const;

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

/// Section 7 is drawn as whole lessons, so both lesson fields must be present.
/// Section 8 is stored but never scored, and marks must agree with `scored`
/// either way.
export function validateQuestionRules(question: QuestionShape): FieldError[] {
  const errors: FieldError[] = [];

  if (question.section === LESSON_SECTION) {
    if (!question.lessonGroup) {
      errors.push({
        field: RULE_FIELDS.lessonGroup,
        message: `section ${LESSON_SECTION} questions must have a lesson group`,
      });
    }
    if (!question.lessonText) {
      errors.push({
        field: RULE_FIELDS.lessonText,
        message: `section ${LESSON_SECTION} questions must have lesson text`,
      });
    }
  }

  if (question.section === UNSCORED_SECTION && question.scored) {
    errors.push({
      field: RULE_FIELDS.scored,
      message: `section ${UNSCORED_SECTION} questions are not scored, so scored must be false`,
    });
  }

  if (!question.scored && Number(question.marks) !== 0) {
    errors.push({
      field: RULE_FIELDS.marks,
      message: `unscored questions must have marks of 0, received "${question.marks}"`,
    });
  }

  if (question.scored && Number(question.marks) === 0) {
    errors.push({
      field: RULE_FIELDS.marks,
      message: "scored questions must have marks greater than 0",
    });
  }

  return errors;
}
