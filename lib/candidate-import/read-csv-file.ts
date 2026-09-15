import "server-only";

import Papa from "papaparse";
import * as XLSX from "xlsx";

import { ACCEPTED_EXTENSIONS, MAX_FILE_SIZE_BYTES, MAX_ROWS } from "./csv-contract";

/// Turns an uploaded CSV or XLSX file into a raw header/row grid.
///
/// XLSX was added alongside CSV so an admin doesn't have to re-save an Excel
/// export as CSV before uploading it — the Selected Candidates import
/// (lib/candidate-selection-import/) already reads both the same way; this
/// mirrors that. Deliberately untyped: header matching and every domain rule
/// belong to the parser layer, not here.
export type RawSheet = {
  headers: string[];
  /// Row values aligned to `headers` by index. Short rows are padded.
  rows: string[][];
};

export type ReadResult = { ok: true; sheet: RawSheet } | { ok: false; message: string };

function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

function isAcceptedFile(fileName: string): boolean {
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(fileExtension(fileName));
}

/// A spreadsheet cell may arrive as a number, boolean or Date; everything
/// becomes a string before validation so downstream code has one shape to
/// handle regardless of source format. Only relevant for XLSX — Papa Parse
/// already hands back strings for CSV.
function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

function toRawSheet(grid: unknown[][]): RawSheet | null {
  const firstUsed = grid.findIndex((row) => row.some((cell) => cellText(cell).trim() !== ""));

  if (firstUsed === -1) {
    return null;
  }

  const headers = grid[firstUsed].map(cellText);
  const rows = grid
    .slice(firstUsed + 1)
    .map((row) => headers.map((_, index) => cellText(row[index])))
    // A trailing run of empty rows is normal in a spreadsheet export and is
    // not data.
    .filter((row) => row.some((cell) => cell.trim() !== ""));

  return { headers, rows };
}

function readCsv(text: string): ReadResult {
  if (text.trim() === "") {
    return { ok: false, message: "The file is empty." };
  }

  // Parsed without `header: true` so a duplicate header survives to be
  // reported, rather than Papa silently collapsing repeated keys into one.
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  const sheet = toRawSheet(parsed.data);

  if (!sheet) {
    return { ok: false, message: "The file has no header row." };
  }

  return { ok: true, sheet };
}

/// Reads only the first worksheet, same as the Selected Candidates import: no
/// requirement exists for a specific sheet name, and a workbook with
/// additional sheets is not an error — they are simply not read.
function readWorkbook(buffer: ArrayBuffer): ReadResult {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, {
      type: "array",
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      cellDates: true,
    });
  } catch {
    return { ok: false, message: "The file could not be read as a spreadsheet." };
  }

  if (workbook.SheetNames.length === 0) {
    return { ok: false, message: "Excel file contains no worksheets." };
  }

  const worksheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!worksheet) {
    return { ok: false, message: "Excel file contains no worksheets." };
  }

  const grid = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: true,
  });

  const sheet = toRawSheet(grid);

  if (!sheet) {
    return { ok: false, message: "The file has no header row." };
  }

  return { ok: true, sheet };
}

export async function readCsvFile(file: File): Promise<ReadResult> {
  if (!isAcceptedFile(file.name)) {
    return {
      ok: false,
      message: `Unsupported file type. Accepted formats: ${ACCEPTED_EXTENSIONS.join(", ")}.`,
    };
  }

  if (file.size === 0) {
    return { ok: false, message: "The file is empty." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      message: `The file is too large. Maximum size is ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB.`,
    };
  }

  const result =
    fileExtension(file.name) === ".csv" ? readCsv(await file.text()) : readWorkbook(await file.arrayBuffer());

  if (!result.ok) {
    return result;
  }

  if (result.sheet.rows.length > MAX_ROWS) {
    return {
      ok: false,
      message: `The file has too many rows (${result.sheet.rows.length}). Maximum is ${MAX_ROWS}.`,
    };
  }

  return result;
}
