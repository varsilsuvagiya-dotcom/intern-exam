"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { parseQuestionCsv, validateFile, type RowError } from "@/lib/question-bank/csv-import";
import { countExisting, importQuestions } from "@/lib/question-bank/import-questions";

export type PreviewRow = {
  row: number;
  id: string;
  section: number;
  topic: string;
  question: string;
  difficulty: string;
  correct: string;
  marks: string;
  status: string;
};

export type ImportState =
  | { stage: "idle" }
  | { stage: "invalid"; errors: RowError[] }
  | {
      stage: "preview";
      csv: string;
      rows: PreviewRow[];
      total: number;
      created: number;
      updated: number;
    }
  | { stage: "done"; total: number; created: number; updated: number };

const PREVIEW_LIMIT = 200;

export async function previewImport(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireAdmin();

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return { stage: "invalid", errors: [{ row: 0, field: "file", message: "Choose a CSV file to upload." }] };
  }

  const fileError = validateFile(file);
  if (fileError) {
    return { stage: "invalid", errors: [{ row: 0, field: "file", message: fileError }] };
  }

  const csv = await file.text();
  const parsed = parseQuestionCsv(csv);

  if (!parsed.ok) {
    return { stage: "invalid", errors: parsed.errors };
  }

  const existing = await countExisting(parsed.rows.map((row) => row.id));

  return {
    stage: "preview",
    csv,
    rows: parsed.rows.slice(0, PREVIEW_LIMIT).map((row, index) => ({
      row: index + 2,
      id: row.id,
      section: row.section,
      topic: row.topic,
      question: row.question,
      difficulty: row.difficulty,
      correct: row.correct,
      marks: row.marks,
      status: row.status,
    })),
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

  const csv = formData.get("csv");

  if (typeof csv !== "string" || csv === "") {
    return { stage: "invalid", errors: [{ row: 0, field: "file", message: "Upload the CSV again before importing." }] };
  }

  // Re-parsed and re-validated here: the preview counts came from the browser
  // and nothing the client returns is trusted.
  const parsed = parseQuestionCsv(csv);

  if (!parsed.ok) {
    return { stage: "invalid", errors: parsed.errors };
  }

  try {
    const summary = await importQuestions(parsed.rows);
    console.info(`Question bank import committed: ${summary.created} created, ${summary.updated} updated.`);
    return { stage: "done", ...summary };
  } catch (error) {
    console.error("Question bank import failed and was rolled back.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      stage: "invalid",
      errors: [{ row: 0, field: "file", message: "The import failed and no questions were changed." }],
    };
  }
}
