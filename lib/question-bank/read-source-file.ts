import "server-only";

import Papa from "papaparse";
import * as XLSX from "xlsx";

import { ACCEPTED_EXTENSIONS } from "./csv-contract";

/// Turns an uploaded CSV, XLS or XLSX file into raw header/row text.
///
/// The output is deliberately untyped and unvalidated: this layer only knows
/// how to get cells out of a container. Header matching, required-field checks
/// and every domain rule belong to the parser, so all three formats meet the
/// same validation on the far side of this boundary.

/// One sheet's worth of raw text. A CSV yields exactly one; a workbook yields
/// one per non-empty sheet, because a single file may hold several sections
/// and nothing may be skipped on the assumption of a sheet layout.
export type RawSheet = {
  /// For error messages only. Never used to determine a row's section.
  sheetName: string | null;
  headers: string[];
  /// Row values aligned to `headers` by index. Short rows are padded.
  rows: string[][];
};

export type ReadResult =
  | { ok: true; sheets: RawSheet[] }
  | { ok: false; message: string };

export function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

export function isAcceptedFile(fileName: string): boolean {
  return (ACCEPTED_EXTENSIONS as readonly string[]).includes(fileExtension(fileName));
}

/// Everything becomes a string before validation. A spreadsheet cell may arrive
/// as a number or a boolean, and `1.5` marks or a `0` option must not turn into
/// `"[object Object]"` or be lost. Dates are the one shape with no sensible
/// text form here, so they are rendered as an ISO date rather than a timestamp.
function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value);
}

/// A sheet as a grid, with the first non-empty row taken as the header.
///
/// Leading blank rows are skipped rather than treated as the header, which is
/// what a spreadsheet with a spacer row above the table would otherwise do.
function toRawSheet(grid: unknown[][], sheetName: string | null): RawSheet | null {
  const firstUsed = grid.findIndex((row) =>
    row.some((cell) => cellText(cell).trim() !== ""),
  );

  if (firstUsed === -1) {
    return null;
  }

  const headers = grid[firstUsed].map(cellText);
  const rows = grid
    .slice(firstUsed + 1)
    .map((row) => headers.map((_, index) => cellText(row[index])))
    // A trailing run of empty rows is normal in a spreadsheet and is not data.
    .filter((row) => row.some((cell) => cell.trim() !== ""));

  return { sheetName, headers, rows };
}

function readCsv(text: string): ReadResult {
  if (text.trim() === "") {
    return { ok: false, message: "The file is empty." };
  }

  // Parsed without `header: true` so duplicate headers survive to be reported.
  // Papa silently collapses repeated keys into one when building objects, which
  // would turn an ambiguous file into a quietly wrong import.
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  const sheet = toRawSheet(parsed.data, null);

  if (!sheet) {
    return { ok: false, message: "The file has no header row." };
  }

  return { ok: true, sheets: [sheet] };
}

function readWorkbook(buffer: ArrayBuffer): ReadResult {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(buffer, {
      type: "array",
      // Values only. Formulas, styles and embedded objects are not question
      // data and parsing them widens the surface for no benefit.
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      cellDates: true,
    });
  } catch {
    return { ok: false, message: "The file could not be read as a spreadsheet." };
  }

  const sheets: RawSheet[] = [];

  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    if (!worksheet) continue;

    // `header: 1` gives the raw grid; `defval` keeps blank cells positional so
    // a row's values stay aligned with the header row above them.
    const grid = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: "",
      blankrows: false,
      raw: true,
    });

    const sheet = toRawSheet(grid, name);
    if (sheet) {
      sheets.push(sheet);
    }
  }

  if (sheets.length === 0) {
    return { ok: false, message: "The workbook contains no readable sheets." };
  }

  return { ok: true, sheets };
}

/// Reads one uploaded file into its sheets.
///
/// The extension decides how the bytes are decoded, and nothing else: a
/// filename never determines which section its rows belong to. That comes from
/// each row's own `section` column.
export async function readSourceFile(file: File): Promise<ReadResult> {
  if (!isAcceptedFile(file.name)) {
    return {
      ok: false,
      message: `Unsupported file type. Accepted formats: ${ACCEPTED_EXTENSIONS.join(", ")}.`,
    };
  }

  if (file.size === 0) {
    return { ok: false, message: "The file is empty." };
  }

  if (fileExtension(file.name) === ".csv") {
    return readCsv(await file.text());
  }

  return readWorkbook(await file.arrayBuffer());
}
