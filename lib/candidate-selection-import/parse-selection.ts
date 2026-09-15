import "server-only";

import { normalizeMobile } from "@/lib/integrations/candidate-payload";

import { CANONICAL_EMAIL_HEADER, MAX_EMAIL_LENGTH, MOBILE_HEADER, NAME_HEADER } from "./selection-contract";
import type { RawSheet } from "./read-selection-file";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// One validated selected-candidate row. `email` and `mobile` are both
/// nullable: a row may carry only one of the two, and matching (see
/// match-selection.ts) tries email first, falling back to mobile. `name` is
/// carried for error reporting only — never used for identity, never written
/// to Candidate.
export type SelectionRow = {
  rowNumber: number;
  name: string | null;
  email: string | null;
  mobile: string | null;
};

export type RowError = {
  row: number;
  field: string;
  name?: string;
  email?: string;
  mobile?: string;
  message: string;
};

export type ParseResult =
  | { ok: true; rows: SelectionRow[]; rowErrors: RowError[] }
  | { ok: false; errors: RowError[] };

/// Header is row 1, so the first data row is presented to the admin as 2.
const FIRST_DATA_ROW = 2;

type ColumnMap = { email: number; mobile: number; name: number };

/// Validates the header row. The canonical email column is matched by exact,
/// case-sensitive text — never through a normalizer — so "Email address"
/// (ignored) and "Email Address2" (canonical) can never be confused with each
/// other, the same protection the live candidate import applies to these two
/// headers. Mobile and name are matched by exact text too, for the same
/// reason of not guessing at a close-but-different header.
function buildColumnMap(headers: string[], errors: RowError[]): ColumnMap | null {
  const email = headers.indexOf(CANONICAL_EMAIL_HEADER);
  const mobile = headers.indexOf(MOBILE_HEADER);
  const name = headers.indexOf(NAME_HEADER);

  if (email === -1) {
    errors.push({
      row: 1,
      field: "email",
      message: `Missing required column: "${CANONICAL_EMAIL_HEADER}".`,
    });
  }

  if (mobile === -1) {
    errors.push({
      row: 1,
      field: "mobile",
      message: `Missing required column: "${MOBILE_HEADER}".`,
    });
  }

  return errors.length > 0 ? null : { email, mobile, name };
}

function validateRow(values: string[], columns: ColumnMap, rowNumber: number): SelectionRow | RowError {
  const rawName = columns.name === -1 ? "" : (values[columns.name] ?? "").trim();
  const rawEmail = (values[columns.email] ?? "").trim();
  const rawMobile = (values[columns.mobile] ?? "").trim();

  const name = rawName || undefined;

  if (!rawEmail && !rawMobile) {
    return {
      row: rowNumber,
      field: "email",
      name,
      message: `Row has neither "${CANONICAL_EMAIL_HEADER}" nor "${MOBILE_HEADER}" — cannot identify a candidate.`,
    };
  }

  let email: string | null = null;
  if (rawEmail) {
    const normalized = rawEmail.toLowerCase();
    if (normalized.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(normalized)) {
      // An invalid email does not fail the row outright: a valid mobile can
      // still identify the candidate (brief's "email mismatch + valid mobile
      // works" case). Only a genuinely unusable email is dropped, not the row.
      email = null;
    } else {
      email = normalized;
    }
  }

  const mobile = rawMobile ? normalizeMobile(rawMobile) : null;

  if (!email && !mobile) {
    return {
      row: rowNumber,
      field: "email",
      name,
      email: rawEmail || undefined,
      mobile: rawMobile || undefined,
      message: "Neither the email nor the mobile number on this row is valid — cannot identify a candidate.",
    };
  }

  return { rowNumber, name: name ?? null, email, mobile };
}

function isRowError(value: SelectionRow | RowError): value is RowError {
  return "message" in value;
}

/// Parses and validates one selected-candidate sheet. A missing required
/// column fails the whole file (brief §22). Every data row is validated
/// independently — a bad row is reported and excluded, the rest of the file
/// still imports (brief §17).
export function parseSelectionSheet(sheet: RawSheet): ParseResult {
  const headerErrors: RowError[] = [];
  const columns = buildColumnMap(sheet.headers, headerErrors);

  if (!columns) {
    return { ok: false, errors: headerErrors };
  }

  if (sheet.rows.length === 0) {
    return { ok: false, errors: [{ row: 0, field: "file", message: "The file contains no candidate rows." }] };
  }

  const rows: SelectionRow[] = [];
  const rowErrors: RowError[] = [];

  sheet.rows.forEach((values, index) => {
    const rowNumber = index + FIRST_DATA_ROW;
    const result = validateRow(values, columns, rowNumber);

    if (isRowError(result)) {
      rowErrors.push(result);
    } else {
      rows.push(result);
    }
  });

  return { ok: true, rows, rowErrors };
}
