import "server-only";

import { importCandidates, type ImportSummary } from "./import-candidates";
import { parseCandidateSheet } from "./parse-candidates";
import { readCsvFile } from "./read-csv-file";
import type { RowError } from "./parse-candidates";

export type ImportResult =
  | { ok: false; errors: RowError[] }
  | {
      ok: true;
      totalRows: number;
      created: number;
      updated: number;
      failed: number;
      conflicts: number;
      errors: RowError[];
    };

/// Full pipeline for one uploaded candidate CSV file: read -> parse/validate
/// header and rows -> match/create/update against the database -> aggregate
/// result. The only entry point admin code should call; every stage below is
/// exported separately for testing but callers outside this module should not
/// need to compose them by hand.
export async function runCandidateImport(file: File): Promise<ImportResult> {
  const read = await readCsvFile(file);

  if (!read.ok) {
    return { ok: false, errors: [{ row: 0, field: "file", message: read.message }] };
  }

  const parsed = parseCandidateSheet(read.sheet);

  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const summary: ImportSummary = await importCandidates(parsed.rows);

  return {
    ok: true,
    totalRows: parsed.rows.length + parsed.rowErrors.length,
    created: summary.created,
    updated: summary.updated,
    failed: summary.failed + parsed.rowErrors.length,
    conflicts: summary.conflicts,
    errors: [...parsed.rowErrors, ...summary.errors],
  };
}
