import "server-only";

import { LESSON_SECTION, resolveSectionCode, type SectionCode } from "@/lib/exam-settings/exam-blueprint";
import type { Difficulty, OptionKey, QuestionStatus } from "@/lib/generated/prisma/enums";

import {
  DIFFICULTY_VALUES,
  MAX_ID_LENGTH,
  MAX_TOPIC_LENGTH,
  OPTIONAL_COLUMNS,
  OPTION_VALUES,
  SOURCE_COLUMNS,
  STATUS_VALUES,
  describeAccepted,
  describeSectionCodes,
  isSupportedColumn,
  normalizeHeader,
  type SourceColumn,
} from "./csv-contract";
import { validateMarks, validateQuestionRules } from "./question-rules";
import { fileExtension, readSourceFile, type RawSheet } from "./read-source-file";

/// One validated row, ready to be written to the question bank.
///
/// `section` is the canonical section code taken from the source file's own
/// `section` column, normalized to its blueprint spelling. It is written to the
/// database exactly as it appears here, and is never guessed from a filename.
export type QuestionRow = {
  id: string;
  section: SectionCode;
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
  marks: string;
  status: QuestionStatus;
};

/// Where a problem was found. `file` and `sheet` are present because one import
/// may span many files and a workbook may span many sheets, so a bare row
/// number would not identify anything.
export type RowError = {
  file?: string;
  sheet?: string | null;
  row: number;
  field: string;
  message: string;
};

/// A sheet that was read but not imported, and why. Reported alongside a
/// successful import so a skipped sheet is never silent.
export type SkippedSheet = { file: string; sheet: string; reason: string };

export type ParseResult =
  | { ok: true; rows: QuestionRow[]; skipped: SkippedSheet[] }
  | { ok: false; errors: RowError[]; skipped: SkippedSheet[] };

/// Header is row 1, so the first data row is presented to the admin as 2.
const FIRST_DATA_ROW = 2;

/// Maps each supported column to the index it occupies in this sheet.
///
/// Matching is by normalized header name, so column order is irrelevant and two
/// files with completely different layouts both import correctly. Unsupported
/// columns are left out of the map and their values are never read, which is
/// how extra source columns are ignored rather than stored.
type ColumnMap = Map<SourceColumn, number>;

function buildColumnMap(
  headers: string[],
  errors: RowError[],
  context: { file: string; sheet: string | null },
): ColumnMap | null {
  const map: ColumnMap = new Map();
  const seen = new Map<string, number>();
  const before = errors.length;

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);

    if (normalized === "") {
      return;
    }

    // Two columns that normalize to the same name make every read from either
    // of them ambiguous, so the file is rejected rather than guessed at.
    const first = seen.get(normalized);
    if (first !== undefined) {
      errors.push({
        ...context,
        row: 1,
        field: normalized,
        message: `Duplicate column "${header}" also appears at column ${first + 1}. Remove one of them.`,
      });
      return;
    }

    seen.set(normalized, index);

    if (isSupportedColumn(normalized)) {
      map.set(normalized, index);
    }
  });

  for (const column of SOURCE_COLUMNS) {
    if (!map.has(column)) {
      errors.push({
        ...context,
        row: 1,
        field: column,
        message: `Missing required column: ${column}`,
      });
    }
  }

  return errors.length > before ? null : map;
}

function validateRow(
  values: string[],
  columns: ColumnMap,
  rowNumber: number,
  errors: RowError[],
  context: { file: string; sheet: string | null },
): QuestionRow | null {
  const fail = (field: string, message: string): null => {
    errors.push({ ...context, row: rowNumber, field, message });
    return null;
  };

  const read = (column: SourceColumn): string => {
    const index = columns.get(column);
    return index === undefined ? "" : (values[index] ?? "").trim();
  };

  const before = errors.length;

  for (const column of SOURCE_COLUMNS) {
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

  // The section comes from this row's own column. A file may hold rows for
  // several sections, and an unknown code is an error rather than a default.
  const sectionRaw = read("section");
  const section = resolveSectionCode(sectionRaw);
  if (!section) {
    fail("section", `section must be one of ${describeSectionCodes()}, received "${sectionRaw}"`);
  }

  const topic = read("topic");
  if (topic.length > MAX_TOPIC_LENGTH) {
    fail("topic", `topic must be at most ${MAX_TOPIC_LENGTH} characters`);
  }

  const difficulty = DIFFICULTY_VALUES[read("difficulty").toLowerCase()];
  if (!difficulty) {
    fail(
      "difficulty",
      `difficulty must be one of ${describeAccepted(DIFFICULTY_VALUES)}, received "${read("difficulty")}"`,
    );
  }

  const correct = OPTION_VALUES[read("correct").toLowerCase()];
  if (!correct) {
    fail(
      "correct",
      `correct must be one of ${describeAccepted(OPTION_VALUES)}, received "${read("correct")}"`,
    );
  }

  const status = STATUS_VALUES[read("status").toLowerCase()];
  if (!status) {
    fail(
      "status",
      `status must be one of ${describeAccepted(STATUS_VALUES)}, received "${read("status")}"`,
    );
  }

  const marks = read("marks");
  const marksError = validateMarks(marks);
  if (marksError) {
    fail("marks", marksError);
  }

  if (errors.length > before || !section) {
    return null;
  }

  const lessonText = read("lesson_text") || null;

  for (const ruleError of validateQuestionRules({
    section: section.code,
    marks,
    lessonText,
  })) {
    fail(ruleError.field, ruleError.message);
  }

  if (errors.length > before) {
    return null;
  }

  return {
    id,
    section: section.code,
    topic,
    difficulty: difficulty as Difficulty,
    question: read("question"),
    codeBlock: read("code_block") || null,
    verifyCode: read("verify_code") || null,
    optionA: read("option_a"),
    optionB: read("option_b"),
    optionC: read("option_c"),
    optionD: read("option_d"),
    correct: correct as OptionKey,
    explanation: read("explanation") || null,
    lessonText,
    // Not a source column. Learn-and-Apply grouping is derived once the whole
    // batch is known, in deriveLessonGroups() below.
    lessonGroup: null,
    marks,
    status: status as QuestionStatus,
  };
}

/// The columns that identify a row. A sheet without both of these cannot say
/// which question it holds or which section that question belongs to, so it is
/// not a question sheet whatever else it carries.
const IDENTIFYING_COLUMNS: SourceColumn[] = ["id", "section"];

/// Whether a sheet is a question sheet at all.
///
/// A workbook often carries a working sheet beside the real data — a filtered
/// copy, a scratch tab — and importing one would either fail the batch or, worse,
/// quietly double the bank. Such a sheet is skipped and reported rather than
/// treated as a broken question sheet.
///
/// The line is drawn at the identifying columns rather than at a proportion of
/// the contract: a sheet missing `id` cannot be imported under any
/// circumstances, while a sheet that has both `id` and `section` but is missing,
/// say, `marks` is a real question sheet with a real mistake in it, and must be
/// reported as an error rather than skipped past.
///
/// The test is the headers themselves, never the sheet's name.
function looksLikeQuestionSheet(headers: string[]): boolean {
  const present = new Set(headers.map(normalizeHeader).filter((header) => header !== ""));

  return IDENTIFYING_COLUMNS.every((column) => present.has(column));
}

/// Validates one sheet, appending to the shared row and error collections so a
/// duplicate id is caught across every file in the same import.
function parseSheet(
  sheet: RawSheet,
  fileName: string,
  rows: QuestionRow[],
  errors: RowError[],
  seenIds: Map<string, string>,
  skipped: SkippedSheet[],
  isWorkbook: boolean,
): void {
  const context = { file: fileName, sheet: sheet.sheetName };

  // Only a workbook can hold sheets that are not question sheets. A CSV is one
  // sheet by definition, so a bad header there is an error, never a skip.
  if (isWorkbook && !looksLikeQuestionSheet(sheet.headers)) {
    skipped.push({
      file: fileName,
      sheet: sheet.sheetName ?? "",
      reason: "the header row does not name the question columns, so this is not a question sheet",
    });
    return;
  }

  const columns = buildColumnMap(sheet.headers, errors, context);

  if (!columns) {
    return;
  }

  sheet.rows.forEach((values, index) => {
    const rowNumber = index + FIRST_DATA_ROW;
    const row = validateRow(values, columns, rowNumber, errors, context);

    if (!row) {
      return;
    }

    // Ids are unique across the whole import, not merely within one file: two
    // files carrying the same id would otherwise have the later one silently
    // overwrite the earlier inside a single transaction.
    const firstSeen = seenIds.get(row.id);
    if (firstSeen !== undefined) {
      errors.push({
        ...context,
        row: rowNumber,
        field: "id",
        message: `Duplicate id "${row.id}", already used in ${firstSeen}`,
      });
      return;
    }

    const where = sheet.sheetName ? `${fileName} (sheet ${sheet.sheetName})` : fileName;
    seenIds.set(row.id, `${where} row ${rowNumber}`);
    rows.push(row);
  });
}

/// Groups Learn-and-Apply rows into lessons.
///
/// The source carries `lesson_text` but no group column, and the exam draws the
/// lesson section as whole lessons, so the group has to be derived. Rows sharing
/// identical lesson text belong to one lesson — that is what a lesson is — and
/// the identifier produced here is internal: it is never read from the source
/// and never sent to a candidate.
///
/// Grouping deliberately does not enforce a size of three. A short or long
/// lesson is a data problem for an admin to see in the bank, and paper
/// generation already refuses to draw an incomplete group.
function deriveLessonGroups(rows: QuestionRow[]): void {
  const groups = new Map<string, string>();

  for (const row of rows) {
    if (row.section !== LESSON_SECTION || !row.lessonText) {
      continue;
    }

    const existing = groups.get(row.lessonText);
    const group = existing ?? `LRN-LESSON-${groups.size + 1}`;

    if (!existing) {
      groups.set(row.lessonText, group);
    }

    row.lessonGroup = group;
  }
}

/// Reads and validates every uploaded file as one batch.
///
/// The number of files is not constrained: one file, seven, or a hundred all
/// behave the same way, and any file may carry rows for any combination of
/// sections. Validation is all-or-nothing — if any row in any file fails,
/// nothing is written.
export async function parseQuestionFiles(files: File[]): Promise<ParseResult> {
  if (files.length === 0) {
    return {
      ok: false,
      errors: [{ row: 0, field: "file", message: "Choose at least one file to upload." }],
      skipped: [],
    };
  }

  const rows: QuestionRow[] = [];
  const errors: RowError[] = [];
  const skipped: SkippedSheet[] = [];
  const seenIds = new Map<string, string>();

  for (const file of files) {
    const read = await readSourceFile(file);

    if (!read.ok) {
      errors.push({ file: file.name, row: 0, field: "file", message: read.message });
      continue;
    }

    const isWorkbook = fileExtension(file.name) !== ".csv";

    for (const sheet of read.sheets) {
      parseSheet(sheet, file.name, rows, errors, seenIds, skipped, isWorkbook);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, skipped };
  }

  if (rows.length === 0) {
    return {
      ok: false,
      errors: [{ row: 0, field: "file", message: "The upload contained no data rows." }],
      skipped,
    };
  }

  deriveLessonGroups(rows);

  return { ok: true, rows, skipped };
}
