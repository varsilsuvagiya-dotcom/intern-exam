import "server-only";

import { SECTION_CODES } from "@/lib/exam-settings/exam-blueprint";
import { Difficulty, OptionKey, QuestionStatus } from "@/lib/generated/prisma/enums";

/// The question-bank import contract.
///
/// These are the sixteen source fields the client has confirmed. Everything
/// else a source file happens to carry is ignored rather than stored: an
/// unsupported column is not question data.
///
/// Columns are matched by normalized header name, never by position, so the
/// physical order of columns in an uploaded file is irrelevant.

export const SOURCE_COLUMNS = [
  "id",
  "section",
  "topic",
  "difficulty",
  "question",
  "code_block",
  "verify_code",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct",
  "explanation",
  "lesson_text",
  "marks",
  "status",
] as const;

export type SourceColumn = (typeof SOURCE_COLUMNS)[number];

/// Columns that may be blank. Everything else must carry a value.
///
/// `lesson_text` is optional at the column level because only Learn-and-Apply
/// rows carry a lesson; the per-row rule in question-rules.ts is what requires
/// it for LRN specifically.
export const OPTIONAL_COLUMNS = new Set<SourceColumn>([
  "code_block",
  "verify_code",
  "explanation",
  "lesson_text",
]);

/// Normalizes a header for matching: trimmed, lowercased, and internal runs of
/// whitespace collapsed. This covers the harmless formatting differences a
/// spreadsheet introduces — ` Question `, `QUESTION`, `option a` — without
/// inventing aliases for genuinely different names.
export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

const SUPPORTED = new Set<string>(SOURCE_COLUMNS);

export function isSupportedColumn(normalized: string): normalized is SourceColumn {
  return SUPPORTED.has(normalized);
}

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

/// Question.marks is Decimal(4,2): at most 4 significant digits with 2 decimal
/// places, so the largest storable value is 99.99. Rejecting rather than
/// rounding keeps the source file the truth for what a question is worth.
export const MARKS_MAX = 99.99;
export const MARKS_DECIMAL_PLACES = 2;

export const MAX_ID_LENGTH = 64;
export const MAX_TOPIC_LENGTH = 200;

/// The file extensions the importer accepts.
export const ACCEPTED_EXTENSIONS = [".csv", ".xls", ".xlsx"] as const;

export function describeAccepted(values: Record<string, unknown>): string {
  return Object.keys(values).join(", ");
}

export function describeSectionCodes(): string {
  return SECTION_CODES.join(", ");
}
