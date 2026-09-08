import "server-only";

import Papa from "papaparse";

import type { Difficulty, OptionKey, QuestionStatus } from "@/lib/generated/prisma/enums";

import {
  BOOLEAN_VALUES,
  CSV_COLUMNS,
  DIFFICULTY_VALUES,
  MAX_FILE_BYTES,
  MAX_ID_LENGTH,
  MAX_TOPIC_LENGTH,
  OPTIONAL_COLUMNS,
  OPTION_VALUES,
  STATUS_VALUES,
  VALID_SECTIONS,
  describeAccepted,
  type CsvColumn,
} from "./csv-contract";
import { validateMarks, validateQuestionRules } from "./question-rules";

export type QuestionRow = {
  id: string;
  section: number;
  topic: string;
  difficulty: Difficulty;
  question: string;
  codeBlock: string | null;
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
};

export type RowError = { row: number; field: string; message: string };

export type ParseResult =
  | { ok: true; rows: QuestionRow[] }
  | { ok: false; errors: RowError[] };

/// Row 1 is the header, so the first data row is presented to the admin as 2.
const FIRST_DATA_ROW = 2;

function validateHeader(fields: string[]): RowError[] {
  const errors: RowError[] = [];
  const present = new Set(fields);

  for (const column of CSV_COLUMNS) {
    if (!present.has(column)) {
      errors.push({ row: 1, field: column, message: `Missing required column: ${column}` });
    }
  }

  const expected = new Set<string>(CSV_COLUMNS);
  for (const field of fields) {
    if (!expected.has(field)) {
      errors.push({ row: 1, field, message: `Unexpected column: ${field}` });
    }
  }

  return errors;
}

function parseBoolean(raw: string): boolean | null {
  return BOOLEAN_VALUES[raw.toLowerCase()] ?? null;
}

/// Maps a domain rule's field name back to the CSV column it came from, so
/// errors stay in the spreadsheet's vocabulary.
const RULE_FIELD_TO_COLUMN: Record<string, CsvColumn> = {
  lessonText: "lesson_text",
  lessonGroup: "lesson_group",
  scored: "scored",
  marks: "marks",
};

function validateRow(
  record: Record<string, string>,
  rowNumber: number,
  errors: RowError[],
): QuestionRow | null {
  const fail = (field: CsvColumn, message: string): null => {
    errors.push({ row: rowNumber, field, message });
    return null;
  };

  const read = (column: CsvColumn): string => (record[column] ?? "").trim();
  const before = errors.length;

  // Presence check for every non-optional column, driven by the contract.
  for (const column of CSV_COLUMNS) {
    if (!OPTIONAL_COLUMNS.has(column) && read(column) === "") {
      fail(column, `${column} is required`);
    }
  }

  if (errors.length > before) {
    return null;
  }

  const id = read("id");
  if (id.length > MAX_ID_LENGTH) {
    fail("id", `id must be at most ${MAX_ID_LENGTH} characters`);
  }

  const sectionRaw = read("section");
  const section = Number(sectionRaw);
  if (!Number.isInteger(section) || !VALID_SECTIONS.includes(section as (typeof VALID_SECTIONS)[number])) {
    fail("section", `section must be one of ${VALID_SECTIONS.join(", ")}, received "${sectionRaw}"`);
  }

  const topic = read("topic");
  if (topic.length > MAX_TOPIC_LENGTH) {
    fail("topic", `topic must be at most ${MAX_TOPIC_LENGTH} characters`);
  }

  const difficulty = DIFFICULTY_VALUES[read("difficulty").toLowerCase()];
  if (!difficulty) {
    fail("difficulty", `difficulty must be one of ${describeAccepted(DIFFICULTY_VALUES)}, received "${read("difficulty")}"`);
  }

  const correct = OPTION_VALUES[read("correct").toLowerCase()];
  if (!correct) {
    fail("correct", `correct must be one of ${describeAccepted(OPTION_VALUES)}, received "${read("correct")}"`);
  }

  const status = STATUS_VALUES[read("status").toLowerCase()];
  if (!status) {
    fail("status", `status must be one of ${describeAccepted(STATUS_VALUES)}, received "${read("status")}"`);
  }

  const scored = parseBoolean(read("scored"));
  if (scored === null) {
    fail("scored", `scored must be one of ${describeAccepted(BOOLEAN_VALUES)}, received "${read("scored")}"`);
  }

  const aiVerified = parseBoolean(read("ai_verified"));
  if (aiVerified === null) {
    fail("ai_verified", `ai_verified must be one of ${describeAccepted(BOOLEAN_VALUES)}, received "${read("ai_verified")}"`);
  }

  const trainerVerified = parseBoolean(read("trainer_verified"));
  if (trainerVerified === null) {
    fail("trainer_verified", `trainer_verified must be one of ${describeAccepted(BOOLEAN_VALUES)}, received "${read("trainer_verified")}"`);
  }

  const marks = read("marks");
  const marksError = validateMarks(marks);
  if (marksError) {
    fail("marks", marksError);
  }

  if (errors.length > before) {
    return null;
  }

  const lessonText = read("lesson_text") || null;
  const lessonGroup = read("lesson_group") || null;

  for (const ruleError of validateQuestionRules({
    section,
    scored: scored as boolean,
    marks,
    lessonText,
    lessonGroup,
  })) {
    fail(RULE_FIELD_TO_COLUMN[ruleError.field] ?? "id", ruleError.message);
  }

  if (errors.length > before) {
    return null;
  }

  return {
    id,
    section,
    topic,
    difficulty: difficulty as Difficulty,
    question: read("question"),
    codeBlock: record["code_block"]?.trim() ? record["code_block"] : null,
    optionA: read("option_a"),
    optionB: read("option_b"),
    optionC: read("option_c"),
    optionD: read("option_d"),
    correct: correct as OptionKey,
    explanation: read("explanation") || null,
    lessonText,
    lessonGroup,
    scored: scored as boolean,
    marks,
    aiVerified: aiVerified as boolean,
    trainerVerified: trainerVerified as boolean,
    status: status as QuestionStatus,
  };
}

export function parseQuestionCsv(content: string): ParseResult {
  if (content.trim() === "") {
    return { ok: false, errors: [{ row: 0, field: "file", message: "The CSV file is empty." }] };
  }

  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const fields = parsed.meta.fields ?? [];

  if (fields.length === 0) {
    return { ok: false, errors: [{ row: 1, field: "file", message: "The CSV file has no header row." }] };
  }

  const headerErrors = validateHeader(fields);
  if (headerErrors.length > 0) {
    return { ok: false, errors: headerErrors };
  }

  if (parsed.data.length === 0) {
    return { ok: false, errors: [{ row: 1, field: "file", message: "The CSV file contains no data rows." }] };
  }

  const errors: RowError[] = [];
  const rows: QuestionRow[] = [];
  const seenIds = new Map<string, number>();

  parsed.data.forEach((record, index) => {
    const rowNumber = index + FIRST_DATA_ROW;
    const row = validateRow(record, rowNumber, errors);

    if (!row) {
      return;
    }

    const firstSeen = seenIds.get(row.id);
    if (firstSeen !== undefined) {
      errors.push({
        row: rowNumber,
        field: "id",
        message: `Duplicate id "${row.id}", already used on row ${firstSeen}`,
      });
      return;
    }

    seenIds.set(row.id, rowNumber);
    rows.push(row);
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, rows };
}

export function validateFile(file: File): string | null {
  if (file.size === 0) {
    return "The selected file is empty.";
  }

  if (file.size > MAX_FILE_BYTES) {
    return `The file is larger than the ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB limit.`;
  }

  return null;
}
