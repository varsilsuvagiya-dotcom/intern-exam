import "server-only";

import { prisma } from "@/lib/db";
import {
  SECTION_BLUEPRINT,
  TOTAL_MARKS,
  sectionNameByOrdinal,
} from "@/lib/exam-settings/exam-blueprint";
import type { OptionKey } from "@/lib/generated/prisma/enums";

import { buildWhere, sortOrder, type AttemptFilters } from "./query-attempts";

/// Row generation for the admin exports.
///
/// These functions produce plain header/row data; `xlsx-export.ts` turns it
/// into the downloaded workbook. Both exports are read-only and both read
/// persisted data only: the summary takes the score columns Phase 12 wrote, and
/// the detailed export takes the `AttemptQuestion` snapshot. Neither touches
/// the live `Question` table, so an export produced today and the same export
/// produced after the question bank is edited are identical.

const OPTION_LABEL: Record<OptionKey, string> = { a: "A", b: "B", c: "C", d: "D" };

export const MAX_TOTAL = TOTAL_MARKS.toFixed(2);

/// Two decimals, always, straight from the Decimal's own string. A null score —
/// an attempt that is unfinished or unscored — exports as an empty cell rather
/// than as 0.00, which would read as "scored zero".
function score(value: { toString(): string } | null | undefined): string {
  return value === null || value === undefined ? "" : Number(value.toString()).toFixed(2);
}

function timestamp(value: Date | null): string {
  return value ? value.toISOString() : "";
}

/// Neutralises spreadsheet formula injection.
///
/// Excel and Sheets execute a cell whose text begins with =, +, - or @, and
/// also treat a leading tab or carriage return as a lead-in to one. A candidate
/// named `=cmd|'/c calc'!A1` would otherwise run on the admin's machine.
///
/// The value is prefixed with a single quote, which spreadsheets consume as
/// "treat what follows as text". The stored data is untouched — only the
/// exported representation changes — and ordinary text is left exactly as it is.
/// A genuinely negative number like -5 is quoted too; that is deliberate, since
/// there is no way to tell it apart from `-1+1` without parsing, and a visible
/// quote is a far smaller cost than executing a formula.
export function neutralize(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

// ---------------------------------------------------------------- summary ---

/// Score columns for sections the exam no longer runs.
///
/// These are not part of the blueprint and nothing writes them any more: they
/// exist so an attempt sat before the section was retired still exports the
/// score it was actually given. Dropping the columns would make a historical
/// result quietly incomplete, and would shift every column after it for anyone
/// reading the file by position.
///
/// An attempt sat under the current exam has no value here, so the cell is
/// blank rather than "0.00", which would read as "scored zero".
const RETIRED_SECTION_COLUMNS = [{ ordinal: 8, maxMarks: 0 }] as const;


export const SUMMARY_HEADERS = [
  "attempt_id",
  "candidate_name",
  "candidate_email",
  "candidate_mobile",
  "entered_name",
  "entered_email",
  "status",
  "started_at",
  "submitted_at",
  "scored_at",
  "total_score",
  "max_score",
  // Column names keep the historical section numbers so an export produced
  // before and after the section-code change lines up in the same spreadsheet.
  ...SECTION_BLUEPRINT.flatMap((s) => [`section_${s.ordinal}_score`, `section_${s.ordinal}_max`]),
  ...RETIRED_SECTION_COLUMNS.flatMap((s) => [`section_${s.ordinal}_score`, `section_${s.ordinal}_max`]),
] as const;

/// One row per attempt, honouring the filters the admin had applied.
///
/// A score column is blank unless the attempt is both finalized and scored, so
/// an in-progress or scoring-pending attempt can never be read as a result.
export async function buildSummaryRows(
  filters: AttemptFilters,
): Promise<Record<string, string>[]> {
  // The candidate id is resolved before use. An id that matches nothing yields
  // an empty export rather than silently dropping the filter and exporting
  // every candidate in the database.
  const candidate = filters.candidateId
    ? await prisma.candidate.findUnique({
        where: { id: filters.candidateId },
        select: { id: true },
      })
    : null;

  if (filters.candidateId !== "" && candidate === null) {
    return [];
  }

  const rows = await prisma.attempt.findMany({
    where: buildWhere(filters, candidate?.id ?? null),
    orderBy: sortOrder(filters.sort),
    select: {
      id: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      scoredAt: true,
      totalScore: true,
      section1Score: true,
      section2Score: true,
      section3Score: true,
      section4Score: true,
      section5Score: true,
      section6Score: true,
      section7Score: true,
      section8Score: true,
      enteredName: true,
      enteredEmail: true,
      candidate: { select: { name: true, email: true, mobile: true } },
    },
  });

  const sheetRows = rows.map((row) => {
    const sectionValues: Record<number, { toString(): string } | null> = {
      1: row.section1Score,
      2: row.section2Score,
      3: row.section3Score,
      4: row.section4Score,
      5: row.section5Score,
      6: row.section6Score,
      7: row.section7Score,
      8: row.section8Score,
    };

    // Scores are reported only once scoring has actually stored a result.
    const isScored = row.scoredAt !== null && row.totalScore !== null;

    const record: Record<string, string> = {
      attempt_id: row.id,
      candidate_name: row.candidate.name,
      candidate_email: row.candidate.email,
      candidate_mobile: row.candidate.mobile,
      entered_name: row.enteredName ?? "",
      entered_email: row.enteredEmail ?? "",
      status: row.status,
      started_at: timestamp(row.startedAt),
      submitted_at: timestamp(row.submittedAt),
      scored_at: timestamp(row.scoredAt),
      total_score: isScored ? score(row.totalScore) : "",
      max_score: MAX_TOTAL,
    };

    for (const blueprint of SECTION_BLUEPRINT) {
      record[`section_${blueprint.ordinal}_score`] = isScored
        ? score(sectionValues[blueprint.ordinal])
        : "";
      record[`section_${blueprint.ordinal}_max`] = (
        blueprint.questionCount * blueprint.marksPerQuestion
      ).toFixed(2);
    }

    // Retired sections export whatever was stored for them, and nothing at all
    // for an attempt that never had one.
    for (const retired of RETIRED_SECTION_COLUMNS) {
      const stored = sectionValues[retired.ordinal] ?? null;
      record[`section_${retired.ordinal}_score`] = stored === null ? "" : score(stored);
      record[`section_${retired.ordinal}_max`] = stored === null
        ? ""
        : retired.maxMarks.toFixed(2);
    }

    return record;
  });

  return sheetRows;
}

// --------------------------------------------------------------- detailed ---

export const DETAIL_HEADERS = [
  "attempt_id",
  "candidate_name",
  "candidate_email",
  "candidate_mobile",
  "attempt_status",
  "started_at",
  "submitted_at",
  "scored_at",
  "question_number",
  "section",
  "section_name",
  "question_text",
  "code_block",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "displayed_option_order",
  "candidate_answer",
  "candidate_answer_text",
  "correct_answer",
  "correct_answer_text",
  "result",
  "marks_awarded",
  "max_marks",
  "explanation",
  "lesson_group",
  "lesson_text",
  "scored",
] as const;

export type DetailRowsExport =
  | { kind: "ok"; rows: Record<string, string>[] }
  | { kind: "not-found" }
  /// The attempt has no stored result, so there is nothing to export — and for
  /// an in-progress attempt, exporting would hand over the answer key mid-exam.
  | { kind: "not-scored" };

/// One row per question for a single finalized, scored attempt.
///
/// Returns the plain row records so the same data can be serialized as CSV or
/// as a styled worksheet without querying twice.
export async function buildDetailRows(attemptId: string): Promise<DetailRowsExport> {
  if (typeof attemptId !== "string" || attemptId === "" || attemptId.length > 100) {
    return { kind: "not-found" };
  }

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      scoredAt: true,
      totalScore: true,
      candidate: { select: { name: true, email: true, mobile: true } },
    },
  });

  if (!attempt) {
    return { kind: "not-found" };
  }

  if (attempt.status === "in_progress" || attempt.scoredAt === null || attempt.totalScore === null) {
    return { kind: "not-scored" };
  }

  // Snapshot rows with their answers joined: one query for the whole paper,
  // and the question bank is not consulted at any point.
  const rows = await prisma.attemptQuestion.findMany({
    where: { attemptId },
    orderBy: { displayOrder: "asc" },
    select: {
      displayOrder: true,
      section: true,
      questionText: true,
      codeBlock: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      correct: true,
      explanation: true,
      lessonText: true,
      lessonGroup: true,
      marks: true,
      scored: true,
      shuffledOptionOrder: true,
      answer: {
        select: { selectedOption: true, textAnswer: true, isCorrect: true, marksAwarded: true },
      },
    },
  });

  const sheetRows = rows.map((row) => {
    const byKey: Record<OptionKey, string> = {
      a: row.optionA,
      b: row.optionB,
      c: row.optionC,
      d: row.optionD,
    };

    const selected = row.answer?.selectedOption ?? null;

    // Section 8 carries no notion of correctness, so it is never labelled right
    // or wrong; everything else keeps unanswered distinct from wrong.
    let result: string;
    if (!row.scored) {
      result = "Unscored";
    } else if (selected === null) {
      result = "Unanswered";
    } else {
      result = row.answer?.isCorrect === true ? "Correct" : "Wrong";
    }

    return {
      attempt_id: attempt.id,
      candidate_name: attempt.candidate.name,
      candidate_email: attempt.candidate.email,
      candidate_mobile: attempt.candidate.mobile,
      attempt_status: attempt.status,
      started_at: timestamp(attempt.startedAt),
      submitted_at: timestamp(attempt.submittedAt),
      scored_at: timestamp(attempt.scoredAt),
      question_number: String(row.displayOrder),
      section: String(row.section),
      section_name: sectionNameByOrdinal(row.section),
      question_text: row.questionText,
      code_block: row.codeBlock ?? "",
      option_a: row.optionA,
      option_b: row.optionB,
      option_c: row.optionC,
      option_d: row.optionD,
      // The order the candidate actually saw, as original option keys.
      displayed_option_order: row.shuffledOptionOrder.map((key) => OPTION_LABEL[key]).join(","),
      // Always the original snapshot key, never the displayed position.
      candidate_answer: selected ? OPTION_LABEL[selected] : "",
      // Section 8 free text, preserved exactly as stored.
      candidate_answer_text: row.answer?.textAnswer ?? "",
      // Section 8 has no correct answer, so both columns stay empty.
      correct_answer: row.scored ? OPTION_LABEL[row.correct] : "",
      correct_answer_text: row.scored ? byKey[row.correct] : "",
      result,
      marks_awarded: score(row.answer?.marksAwarded ?? null) || "0.00",
      max_marks: score(row.marks),
      // Not exported for section 8: an attitude question's note is not a
      // correctness explanation.
      explanation: row.scored ? (row.explanation ?? "") : "",
      lesson_group: row.lessonGroup ?? "",
      lesson_text: row.lessonText ?? "",
      scored: row.scored ? "true" : "false",
    };
  });

  return { kind: "ok", rows: sheetRows };
}


/// `cloudus-attempts-2026-09-09.xlsx`. Carries no candidate name, email or
/// mobile: a filename ends up in download histories and shared folders.
export function exportFilename(prefix: string, now = new Date(), extension = "xlsx"): string {
  return `${prefix}-${now.toISOString().slice(0, 10)}.${extension}`;
}
