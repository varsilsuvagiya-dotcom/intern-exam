"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { invalidateQuestionPool } from "@/lib/exam/question-pool";
import {
  parseQuestionFiles,
  type RowError,
  type SkippedSheet,
} from "@/lib/question-bank/csv-import";
import { countExisting, importQuestions } from "@/lib/question-bank/import-questions";
import { verifyRows } from "@/lib/question-bank/verify-rows";

export type PreviewRow = {
  id: string;
  /// Shown as the code the file used. Derived from the resolved section for
  /// display only — the database stores the section number, not this string.
  sectionCode: string;
  topic: string;
  question: string;
  difficulty: string;
  correct: string;
  marks: string;
  status: string;
};

/// What one upload contained, per section, so an admin can see at a glance that
/// a file held the sections they expected. Derived from the parsed rows for
/// display; nothing here is persisted.
export type SectionCount = { sectionCode: string; count: number };

export type ImportState =
  | { stage: "idle" }
  | { stage: "invalid"; errors: RowError[]; skipped: SkippedSheet[] }
  | {
      stage: "preview";
      /// The validated batch, carried forward to the confirm step. Re-validated
      /// server-side before anything is written; nothing here is trusted.
      payload: string;
      rows: PreviewRow[];
      sections: SectionCount[];
      /// Sheets that were read but are not question sheets. Reported so a
      /// skipped sheet is visible rather than silently absent.
      skipped: SkippedSheet[];
      fileCount: number;
      total: number;
      created: number;
      updated: number;
    }
  | { stage: "done"; total: number; created: number; updated: number };

const PREVIEW_LIMIT = 200;

function summarizeSections(rows: { section: string }[]): SectionCount[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(row.section, (counts.get(row.section) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([sectionCode, count]) => ({ sectionCode, count }))
    .sort((a, b) => a.sectionCode.localeCompare(b.sectionCode));
}

export async function previewImport(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireAdmin();

  // Any number of files: one, seven, or a hundred. Nothing here assumes a
  // particular count, and a file may carry rows for several sections.
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return {
      stage: "invalid",
      errors: [{ row: 0, field: "file", message: "Choose at least one file to upload." }],
      skipped: [],
    };
  }

  const parsed = await parseQuestionFiles(files);

  if (!parsed.ok) {
    return { stage: "invalid", errors: parsed.errors, skipped: parsed.skipped };
  }

  const existing = await countExisting(parsed.rows.map((row) => row.id));

  return {
    stage: "preview",
    payload: JSON.stringify(parsed.rows),
    rows: parsed.rows.slice(0, PREVIEW_LIMIT).map((row) => ({
      id: row.id,
      sectionCode: row.section,
      topic: row.topic,
      question: row.question,
      difficulty: row.difficulty,
      correct: row.correct,
      marks: row.marks,
      status: row.status,
    })),
    sections: summarizeSections(parsed.rows),
    skipped: parsed.skipped,
    fileCount: files.length,
    total: parsed.rows.length,
    created: parsed.rows.length - existing,
    updated: existing,
  };
}

export async function confirmImport(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireAdmin();

  const payload = formData.get("payload");

  if (typeof payload !== "string" || payload === "") {
    return {
      stage: "invalid",
      errors: [{ row: 0, field: "file", message: "Upload the files again before importing." }],
      skipped: [],
    };
  }

  // The payload made a round trip through the browser, so it is untrusted input
  // however it was produced. Every row is rebuilt and re-validated here before
  // anything is written.
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return {
      stage: "invalid",
      errors: [{ row: 0, field: "file", message: "Upload the files again before importing." }],
      skipped: [],
    };
  }

  const rows = verifyRows(parsed);

  if (!rows) {
    return {
      stage: "invalid",
      errors: [
        {
          row: 0,
          field: "file",
          message: "The upload could not be confirmed. Please upload the files again.",
        },
      ],
      skipped: [],
    };
  }

  try {
    const summary = await importQuestions(rows);
    // An import rewrites question rows in place, so the cached pool in this
    // process is stale the moment it succeeds.
    invalidateQuestionPool();
    return { stage: "done", ...summary };
  } catch (error) {
    console.error("Question bank import failed and was rolled back.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      stage: "invalid",
      errors: [{ row: 0, field: "file", message: "The import failed and no questions were changed." }],
      skipped: [],
    };
  }
}
