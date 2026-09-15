import "server-only";

import { prisma } from "@/lib/db";

import { parseSelectionSheet, type RowError } from "./parse-selection";
import { readSelectionFile } from "./read-selection-file";
import { selectCandidates, type SelectionSummary } from "./select-candidates";

export type SelectionImportResult =
  | { ok: false; errors: RowError[] }
  | {
      ok: true;
      totalRows: number;
      selected: number;
      alreadySelected: number;
      notFound: number;
      conflicts: number;
      failed: number;
      errors: RowError[];
    };

/// Confirms `examId` names a real ExamSetting before anything is written, so
/// a typo or a stale id can never produce orphan CandidateExam rows (brief
/// §33). The application currently has only the ExamSetting singleton
/// (lib/exam-settings/index.ts's `SETTINGS_ID`), but this checks whatever id
/// is actually passed in rather than assuming that constant — see
/// `importSelectedCandidatesFromFile`'s own doc comment for why the id is an
/// explicit parameter instead of being hardcoded here.
async function examSettingExists(examId: string): Promise<boolean> {
  const exam = await prisma.examSetting.findUnique({ where: { id: examId }, select: { id: true } });
  return exam !== null;
}

/// Full pipeline for one uploaded selected-candidate file: read -> parse
/// header/rows -> match against existing Candidate rows (canonical email
/// "Email Address2" first, "Mobile Number (WhatsApp)" fallback) -> create
/// CandidateExam -> aggregate result. Mirrors lib/candidate-import/run-import.ts's
/// shape for the live candidate import, adapted for this file's contract
/// (CSV or XLSX, CandidateExam instead of Candidate).
///
/// `examId` is an explicit parameter rather than a hardcoded constant: the
/// application currently has only the ExamSetting singleton, but the caller
/// (an admin server action) is what should decide which exam a selection
/// applies to, not this module — see docs/selected-candidate-import.md.
export async function importSelectedCandidatesFromFile(
  file: File,
  examId: string,
): Promise<SelectionImportResult> {
  if (!(await examSettingExists(examId))) {
    return {
      ok: false,
      errors: [{ row: 0, field: "examId", message: "The selected exam could not be found." }],
    };
  }

  const read = await readSelectionFile(file);

  if (!read.ok) {
    return { ok: false, errors: [{ row: 0, field: "file", message: read.message }] };
  }

  const parsed = parseSelectionSheet(read.sheet);

  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const summary: SelectionSummary = await selectCandidates(parsed.rows, examId);

  return {
    ok: true,
    totalRows: parsed.rows.length + parsed.rowErrors.length,
    selected: summary.selected,
    alreadySelected: summary.alreadySelected,
    notFound: summary.notFound,
    conflicts: summary.conflicts,
    // Row-level parse failures (blank/invalid email) are validation failures,
    // not database-matching outcomes — counted under `failed`, same as a
    // database error, distinct from `notFound` (valid email, no match).
    failed: summary.failed + parsed.rowErrors.length,
    errors: [...parsed.rowErrors, ...summary.errors],
  };
}
