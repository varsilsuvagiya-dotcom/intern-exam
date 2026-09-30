import "server-only";

import * as XLSX from "xlsx";

/// Excel stores a date as a plain number carrying a date number format. That
/// makes a real date indistinguishable, at the value level, from a cell Excel
/// only guessed was a date — and Excel guesses aggressively. Text like `5/6`
/// or `1/2` typed into a General cell is silently stored as a date serial, so
/// an author who wrote the fraction "5/6" gets a cell holding 46178.
///
/// Reading such a cell as a Date and formatting it would replace the author's
/// own text with a date they never wrote. Their displayed text is the one
/// value that is right either way: a genuine date shows as the date, and a
/// mangled fraction shows as the fraction that was typed. So every
/// date-formatted cell is rewritten to its displayed text and read as a
/// string, and every other cell keeps its raw value, which preserves exact
/// numbers (`1.5` marks) rather than a rounded display form.
export function applyDisplayTextToDateCells(worksheet: XLSX.WorkSheet): void {
  for (const address of Object.keys(worksheet)) {
    // Sheet-level metadata (`!ref`, `!margins`) is not a cell.
    if (address.startsWith("!")) continue;

    const cell = worksheet[address] as XLSX.CellObject | undefined;

    // `w` is the text Excel displays. Without it there is nothing better to
    // fall back to than the raw number, so the cell is left alone.
    if (!cell || cell.t !== "n" || typeof cell.w !== "string") continue;

    if (!isDateFormatted(cell)) continue;

    cell.t = "s";
    cell.v = cell.w;
    // The date number format has to go with the value it described. Left on a
    // string cell it makes `sheet_to_json` read the cell back as null.
    delete cell.z;
    delete cell.w;
  }
}

/// A cell is date-formatted when its number format contains a date or time
/// token outside of a quoted literal. `z` may be a format string or, for the
/// built-in formats, a numeric index.
function isDateFormatted(cell: XLSX.CellObject): boolean {
  const format = cell.z;

  if (typeof format === "number") {
    return XLSX.SSF.is_date(XLSX.SSF._table[format] ?? "");
  }

  return typeof format === "string" && XLSX.SSF.is_date(format);
}
