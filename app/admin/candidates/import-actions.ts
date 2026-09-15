"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { runCandidateImport } from "@/lib/candidate-import/run-import";
import type { RowError } from "@/lib/candidate-import/parse-candidates";

export type ImportCandidatesState =
  | { stage: "idle" }
  | { stage: "invalid"; errors: RowError[] }
  | {
      stage: "done";
      totalRows: number;
      created: number;
      updated: number;
      failed: number;
      conflicts: number;
      errors: RowError[];
    };

/// Backend entry point for the live candidate CSV import (Phase 13).
///
/// No UI calls this yet — Phase 14 adds the admin import button/dialog. This
/// exists now so Phase 14 has a server action to wire up without touching the
/// import pipeline itself. `requireAdmin` is the same authorization every
/// other admin server action in this codebase uses; there is no second auth
/// path here.
export async function importCandidatesFromCsv(
  _prev: ImportCandidatesState,
  formData: FormData,
): Promise<ImportCandidatesState> {
  await requireAdmin();

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return {
      stage: "invalid",
      errors: [{ row: 0, field: "file", message: "Choose a CSV or Excel (.xlsx) file to upload." }],
    };
  }

  const result = await runCandidateImport(file);

  if (!result.ok) {
    return { stage: "invalid", errors: result.errors };
  }

  revalidatePath("/admin/candidates");

  return {
    stage: "done",
    totalRows: result.totalRows,
    created: result.created,
    updated: result.updated,
    failed: result.failed,
    conflicts: result.conflicts,
    errors: result.errors,
  };
}
