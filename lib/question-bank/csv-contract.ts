import "server-only";

import { Difficulty, OptionKey, QuestionStatus } from "@/lib/generated/prisma/enums";

/// The CURRENT question-bank CSV contract. The production spreadsheet has not
/// been provided yet, so when it arrives this file is the one place to adjust:
/// column names, required/optional status, accepted enum and boolean spellings,
/// numeric limits, and the cross-field rules below. Nothing outside this module
/// should hard-code a CSV column name.

export const CSV_COLUMNS = [
  "id",
  "section",
  "topic",
  "difficulty",
  "question",
  "code_block",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct",
  "explanation",
  "lesson_text",
  "lesson_group",
  "scored",
  "marks",
  "ai_verified",
  "trainer_verified",
  "status",
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];

/// Columns that may be blank. Everything else must carry a value.
export const OPTIONAL_COLUMNS = new Set<CsvColumn>([
  "code_block",
  "explanation",
  "lesson_text",
  "lesson_group",
]);

export const VALID_SECTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/// The section whose questions are drawn as whole lessons, and the unscored one.
export const LESSON_SECTION = 7;
export const UNSCORED_SECTION = 8;

/// Accepted spellings, matched case-insensitively after trimming. Deliberately
/// narrow: an unrecognised value is an error, never a silent default.
export const DIFFICULTY_VALUES: Record<string, Difficulty> = {
  easy: Difficulty.easy,
  medium: Difficulty.medium,
  hard: Difficulty.hard,
};

export const STATUS_VALUES: Record<string, QuestionStatus> = {
  draft: QuestionStatus.draft,
  review: QuestionStatus.review,
  ready: QuestionStatus.ready,
};

export const OPTION_VALUES: Record<string, OptionKey> = {
  a: OptionKey.a,
  b: OptionKey.b,
  c: OptionKey.c,
  d: OptionKey.d,
};

export const BOOLEAN_VALUES: Record<string, boolean> = {
  true: true,
  false: false,
  "1": true,
  "0": false,
  yes: true,
  no: false,
};

/// Question.marks is Decimal(4,2): at most 4 significant digits with 2 decimal
/// places, so the largest storable value is 99.99. Rejecting rather than
/// rounding keeps the CSV the source of truth for what a question is worth.
export const MARKS_MAX = 99.99;
export const MARKS_DECIMAL_PLACES = 2;

export const MAX_ID_LENGTH = 64;
export const MAX_TOPIC_LENGTH = 200;

/// 5 MB holds a question bank of several thousand rows with room to spare.
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function describeAccepted(values: Record<string, unknown>): string {
  return Object.keys(values).join(", ");
}
