import "server-only";

import * as XLSX from "xlsx";

import { TEMPLATE_EXAMPLE_ROW, TEMPLATE_HEADERS } from "@/lib/candidate-import/csv-contract";

import {
  DETAIL_HEADERS,
  SUMMARY_HEADERS,
  buildDetailRows,
  buildSummaryRows,
  neutralize,
} from "./sheet-export";
import type { AttemptFilters } from "./query-attempts";

/// Workbook generation for every admin download.
///
/// Every export is .xlsx rather than .csv: a CSV carries no formatting, so
/// Excel opens each column at its default width and a long question, code block
/// or free-text answer is unreadable until the admin autofits by hand. The rows
/// are exactly what `sheet-export.ts` produces — same snapshot, same order,
/// same guarding — only the container differs.

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/// Fallback for any column without an explicit width, so adding a header still
/// produces a usable sheet.
const DEFAULT_WIDTH = 18;

// ponytail: no cell styling (wrap, bold header, fills). The community `xlsx`
// build silently drops `cell.s` on write — verified, it round-trips as
// `{patternType:"none"}` — so styling needs a different library (exceljs).
// Column widths, freeze and autofilter are what it does write, and they are
// what actually fixes the unreadable-column complaint.

/// Builds a one-sheet workbook with sized columns, a frozen header row and an
/// autofilter over the used range.
export function buildWorkbook(
  headers: readonly string[],
  rows: Record<string, string>[],
  widths: Readonly<Partial<Record<string, number>>>,
  sheetName: string,
): Buffer {
  // The formula-injection guard applies to XLSX exactly as it did to CSV: Excel
  // executes a cell beginning with =, +, - or @ whichever format it came from.
  const grid: string[][] = [
    [...headers],
    ...rows.map((row) => headers.map((header) => neutralize(row[header] ?? ""))),
  ];

  const sheet = XLSX.utils.aoa_to_sheet(grid);

  sheet["!cols"] = headers.map((header) => ({ wch: widths[header] ?? DEFAULT_WIDTH }));
  sheet["!freeze"] = "A2";
  sheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: grid.length - 1, c: headers.length - 1 },
    }),
  };

  const workbook = XLSX.utils.book_new();
  // Excel rejects a sheet name over 31 characters or containing : \ / ? * [ ].
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

// --------------------------------------------------------------- detailed ---

const DETAIL_WIDTH: Partial<Record<(typeof DETAIL_HEADERS)[number], number>> = {
  attempt_id: 38,
  candidate_name: 20,
  candidate_email: 26,
  candidate_mobile: 14,
  attempt_status: 12,
  started_at: 20,
  submitted_at: 20,
  scored_at: 20,
  question_number: 9,
  section: 8,
  section_name: 24,
  question_text: 60,
  code_block: 48,
  option_a: 22,
  option_b: 22,
  option_c: 22,
  option_d: 22,
  displayed_option_order: 12,
  candidate_answer: 10,
  candidate_answer_text: 40,
  correct_answer: 10,
  correct_answer_text: 22,
  result: 12,
  marks_awarded: 10,
  max_marks: 10,
  explanation: 60,
  lesson_group: 20,
  lesson_text: 40,
  scored: 8,
};

export type XlsxExport =
  | { kind: "ok"; buffer: Buffer }
  | { kind: "not-found" }
  | { kind: "not-scored" };

/// One sheet per question for a single finalized, scored attempt.
export async function buildDetailXlsx(attemptId: string): Promise<XlsxExport> {
  const result = await buildDetailRows(attemptId);

  if (result.kind !== "ok") {
    return result;
  }

  return {
    kind: "ok",
    buffer: buildWorkbook(DETAIL_HEADERS, result.rows, DETAIL_WIDTH, "Result"),
  };
}

// ---------------------------------------------------------------- summary ---

/// Only the wide columns are listed; every score column takes DEFAULT_WIDTH.
const SUMMARY_WIDTH: Partial<Record<(typeof SUMMARY_HEADERS)[number], number>> = {
  attempt_id: 38,
  candidate_name: 22,
  candidate_email: 28,
  candidate_mobile: 14,
  entered_name: 22,
  entered_email: 28,
  status: 12,
  started_at: 20,
  submitted_at: 20,
  scored_at: 20,
  total_score: 11,
  max_score: 10,
};

/// One row per attempt, honouring the filters the admin had applied.
export async function buildSummaryXlsx(filters: AttemptFilters): Promise<Buffer> {
  const rows = await buildSummaryRows(filters);

  return buildWorkbook(SUMMARY_HEADERS, rows, SUMMARY_WIDTH, "Attempts");
}

// --------------------------------------------------------------- template ---

/// The candidate import template, as a workbook the importer already accepts —
/// `read-csv-file.ts` reads .xlsx as well as .csv, so a file started here can
/// be filled in Excel and uploaded back without a save-as step.
///
/// The free-text prompts are long questions used verbatim as headers, so every
/// column gets a generous width rather than a per-column table that would have
/// to be kept in step with the import contract.
const TEMPLATE_WIDTH = Object.fromEntries(TEMPLATE_HEADERS.map((header) => [header, 34]));

export function buildTemplateXlsx(): Buffer {
  return buildWorkbook(TEMPLATE_HEADERS, [TEMPLATE_EXAMPLE_ROW], TEMPLATE_WIDTH, "Candidates");
}
