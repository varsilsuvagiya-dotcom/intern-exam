"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { importSelectedCandidatesFromFile } from "@/lib/candidate-selection-import/run-selection-import";
import type { RowError } from "@/lib/candidate-selection-import/parse-selection";
import { SETTINGS_ID } from "@/lib/exam-settings";

export type ImportSelectedCandidatesState =
  | { stage: "idle" }
  | { stage: "invalid"; errors: RowError[] }
  | {
      stage: "done";
      totalRows: number;
      selected: number;
      alreadySelected: number;
      notFound: number;
      conflicts: number;
      failed: number;
      errors: RowError[];
    };

/// Backend entry point for the selected-candidate CSV/XLSX import (Phase 15).
///
/// No UI calls this yet — a later phase adds the admin button/dialog, the
/// same way Phase 14 wired up the live candidate import's action after Phase
/// 13 built it. `requireAdmin` is the same authorization every other admin
/// server action in this codebase uses.
///
/// The exam is the application's one ExamSetting singleton (`SETTINGS_ID`),
/// read here rather than hardcoded inside the import pipeline itself — see
/// `importSelectedCandidatesFromFile`'s doc comment. When the application
/// grows real multi-exam support, this is the one place that needs to change
/// to accept a chosen exam id from the caller instead.
export async function importSelectedCandidatesAction(
  _prev: ImportSelectedCandidatesState,
  formData: FormData,
): Promise<ImportSelectedCandidatesState> {
  await requireAdmin();

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return {
      stage: "invalid",
      errors: [{ row: 0, field: "file", message: "Choose a CSV or Excel file to upload." }],
    };
  }

  const result = await importSelectedCandidatesFromFile(file, SETTINGS_ID);

  if (!result.ok) {
    return { stage: "invalid", errors: result.errors };
  }

  // Selecting a candidate for the exam is visible on the candidates page
  // (a future eligibility indicator), so the same revalidation the live
  // import triggers applies here too.
  revalidatePath("/admin/candidates");

  return {
    stage: "done",
    totalRows: result.totalRows,
    selected: result.selected,
    alreadySelected: result.alreadySelected,
    notFound: result.notFound,
    conflicts: result.conflicts,
    failed: result.failed,
    errors: result.errors,
  };
}

export type SetCandidateSelectionResult = { ok: true } | { ok: false; message: string };

/// Manual per-candidate selection toggle, driven by the switch on the
/// candidates table. This is the one place besides the Selected Candidates
/// import that can write a `CandidateExam` row — and the only place that can
/// remove one. Unlike the import (which only ever matches candidates it finds
/// in an uploaded file), this always knows exactly which candidate it is
/// acting on, since the table already has their id.
///
/// `selected: true` creates the row (idempotent — `upsert` so flipping an
/// already-selected candidate to "on" again is a no-op, not an error).
/// `selected: false` deletes it. Deleting is a real, permanent removal of
/// exam eligibility: if the candidate has an `in_progress` attempt, their
/// next resume will be rejected by the Phase 17 eligibility gate
/// (lib/exam/start-exam.ts) the same as it would for any other unselected
/// candidate — this action does not special-case that.
export async function setCandidateSelection(
  candidateId: string,
  selected: boolean,
): Promise<SetCandidateSelectionResult> {
  await requireAdmin();

  if (!candidateId) {
    return { ok: false, message: "No candidate was specified." };
  }

  try {
    if (selected) {
      await prisma.candidateExam.upsert({
        where: { candidateId_examId: { candidateId, examId: SETTINGS_ID } },
        create: { candidateId, examId: SETTINGS_ID },
        update: {},
      });
    } else {
      // `deleteMany` rather than `delete`: toggling an already-unselected
      // candidate off again must not throw "record not found" — it is
      // already in the state the admin asked for.
      await prisma.candidateExam.deleteMany({
        where: { candidateId, examId: SETTINGS_ID },
      });
    }

    revalidatePath("/admin/candidates");
    return { ok: true };
  } catch (error) {
    // A stable message only — the error may carry the connection string.
    console.error("Candidate selection toggle failed.", {
      candidateId,
      selected,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { ok: false, message: "Could not update this candidate's selection. Try again." };
  }
}
