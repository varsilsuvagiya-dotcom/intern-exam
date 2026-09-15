import "server-only";

import { normalizeMobile } from "@/lib/integrations/candidate-payload";

import {
  CANDIDATE_COLUMNS,
  CANONICAL_EMAIL_HEADER,
  IGNORED_EMAIL_HEADER,
  IGNORED_HEADERS,
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_TEXT_LENGTH,
  OPTIONAL_COLUMNS,
  isSupportedColumn,
  normalizeHeader,
  type CandidateColumn,
} from "./csv-contract";
import type { RawSheet } from "./read-csv-file";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// One validated candidate row, ready to be matched against the database.
/// Every optional field is `null` rather than `""` when the source cell was
/// blank, so the write layer can tell "blank in the CSV" (preserve existing
/// value) from "a real empty string" (there is no such value in this contract).
export type CandidateImportRow = {
  rowNumber: number;
  name: string;
  email: string;
  mobile: string;
  sourceTimestamp: Date | null;
  currentCity: string | null;
  willingFullTimeSurat: string | null;
  dateOfBirth: Date | null;
  highestQualification: string | null;
  collegeName: string | null;
  yearOfPassing: string | null;
  cgpaOrPercentage: string | null;
  technologies: string | null;
  projectInfo: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  liveProjectUrl: string | null;
  selfLearningInfo: string | null;
  aiToolsInfo: string | null;
  reasonForJoining: string | null;
  resumeUrl: string | null;
  termsAgreement: string | null;
  informationConfirmation: string | null;
  hearAboutProgram: string | null;
};

export type RowError = {
  row: number;
  field: string;
  name?: string;
  email?: string;
  message: string;
};

/// Header problems fail the whole file (`ok: false`) — nothing downstream can
/// be trusted to mean what it says. Row problems are partial: `ok: true`
/// carries both the rows that validated and the rows that didn't, so 95 good
/// rows import even when 5 rows are bad (brief §8, §22).
export type ParseResult =
  | { ok: true; rows: CandidateImportRow[]; rowErrors: RowError[] }
  | { ok: false; errors: RowError[] };

/// Header is row 1, so the first data row is presented to the admin as 2.
const FIRST_DATA_ROW = 2;

/// Maps each supported column to the index it occupies in this sheet, plus the
/// canonical email column's own index (matched separately, by exact text).
type ColumnMap = {
  byName: Map<CandidateColumn, number>;
  email: number;
};

/// Validates the header row and builds the column map.
///
/// Every column present that is neither an explicitly ignored header nor a
/// column this contract knows how to map is a configuration error: silently
/// dropping an unrecognised column would violate the "every field must be
/// stored" requirement, so the whole import is rejected rather than guessed
/// at. The canonical email column is matched by exact text
/// (`CANONICAL_EMAIL_HEADER`), never through the generic normalizer — see the
/// comment on that constant for why.
function buildColumnMap(headers: string[], errors: RowError[]): ColumnMap | null {
  const byName: Map<CandidateColumn, number> = new Map();
  const seenNormalized = new Map<string, number>();
  let emailIndex: number | undefined;
  const before = errors.length;

  headers.forEach((header, index) => {
    if (header === CANONICAL_EMAIL_HEADER) {
      if (emailIndex !== undefined) {
        errors.push({
          row: 1,
          field: "email",
          message: `Duplicate column "${CANONICAL_EMAIL_HEADER}" also appears at column ${emailIndex + 1}. Remove one of them.`,
        });
        return;
      }
      emailIndex = index;
      return;
    }

    if (header === IGNORED_EMAIL_HEADER || IGNORED_HEADERS.has(header)) {
      return;
    }

    const normalized = normalizeHeader(header);

    if (normalized === "") {
      return;
    }

    const first = seenNormalized.get(normalized);
    if (first !== undefined) {
      errors.push({
        row: 1,
        field: normalized,
        message: `Duplicate column "${header}" also appears at column ${first + 1}. Remove one of them.`,
      });
      return;
    }
    seenNormalized.set(normalized, index);

    if (isSupportedColumn(normalized)) {
      byName.set(normalized, index);
    } else {
      errors.push({
        row: 1,
        field: normalized,
        message: `Unrecognised column "${header}". Every non-ignored column must be mapped — update the field mapping or remove this column.`,
      });
    }
  });

  if (emailIndex === undefined) {
    errors.push({
      row: 1,
      field: "email",
      message: `Missing required column: "${CANONICAL_EMAIL_HEADER}" (the canonical candidate email).`,
    });
  }

  for (const column of CANDIDATE_COLUMNS) {
    if (!byName.has(column) && !OPTIONAL_COLUMNS.has(column)) {
      errors.push({ row: 1, field: column, message: `Missing required column: ${column}` });
    }
  }

  return errors.length > before || emailIndex === undefined
    ? null
    : { byName, email: emailIndex };
}

/// Parses `M/D/YYYY H:mm:ss` or `M/D/YY` style values, the formats the live
/// sheet's Timestamp and Date of Birth columns actually use (verified in
/// Phase 12 against the real file). `Date`'s own parser accepts both directly.
function parseSheetDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function validateRow(
  values: string[],
  columns: ColumnMap,
  rowNumber: number,
  errors: RowError[],
): CandidateImportRow | null {
  const before = errors.length;

  const readByName = (column: CandidateColumn): string => {
    const index = columns.byName.get(column);
    return index === undefined ? "" : (values[index] ?? "").trim();
  };

  const readOptional = (column: CandidateColumn): string | null => {
    const value = readByName(column);
    return value === "" ? null : value;
  };

  const rawEmail = (values[columns.email] ?? "").trim();
  const rawName = readByName("full_name");
  const rawMobile = readByName("mobile_number_(whatsapp)");

  const fail = (field: string, message: string): void => {
    errors.push({ row: rowNumber, field, name: rawName || undefined, email: rawEmail || undefined, message });
  };

  if (!rawName) {
    fail("full_name", "Full Name is required.");
  } else if (rawName.length > MAX_NAME_LENGTH) {
    fail("full_name", `Full Name must be at most ${MAX_NAME_LENGTH} characters.`);
  }

  const email = rawEmail.toLowerCase();
  if (!rawEmail) {
    fail("email", `${CANONICAL_EMAIL_HEADER} is required.`);
  } else if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    fail("email", `Invalid email format: "${rawEmail}".`);
  }

  if (!rawMobile) {
    fail("mobile_number_(whatsapp)", "Mobile Number (WhatsApp) is required.");
  }
  const mobile = rawMobile ? normalizeMobile(rawMobile) : null;
  if (rawMobile && !mobile) {
    fail("mobile_number_(whatsapp)", `Invalid mobile number: "${rawMobile}".`);
  }

  const rawTimestamp = readByName("timestamp");
  let sourceTimestamp: Date | null = null;
  if (!rawTimestamp) {
    fail("timestamp", "Timestamp is required.");
  } else {
    sourceTimestamp = parseSheetDate(rawTimestamp);
    if (!sourceTimestamp) {
      fail("timestamp", `Invalid timestamp: "${rawTimestamp}".`);
    }
  }

  const rawDob = readByName("date_of_birth");
  let dateOfBirth: Date | null = null;
  if (rawDob) {
    dateOfBirth = parseSheetDate(rawDob);
    if (!dateOfBirth) {
      fail("date_of_birth", `Invalid date of birth: "${rawDob}".`);
    }
  }

  for (const column of CANDIDATE_COLUMNS) {
    const value = readByName(column);
    if (value.length > MAX_TEXT_LENGTH) {
      fail(column, `${column} exceeds the maximum length of ${MAX_TEXT_LENGTH} characters.`);
    }
  }

  if (errors.length > before) {
    return null;
  }

  // "Have you built any project?" is a fixed-choice column the field mapping
  // does not give its own Candidate field to (see
  // docs/candidate-import-field-mapping.md) — folded into `projectInfo` as a
  // prefix so its value is still stored rather than discarded.
  const builtProject = readOptional("have_you_built_any_project?");
  const projectDescription = readOptional("describe_your_best_project_in_your_own_words.");
  const projectInfo =
    builtProject && projectDescription
      ? `${builtProject}: ${projectDescription}`
      : (builtProject ?? projectDescription);

  return {
    rowNumber,
    name: rawName,
    email,
    mobile: mobile as string,
    sourceTimestamp,
    currentCity: readOptional("current_city"),
    willingFullTimeSurat: readOptional("are_you_willing_to_work_full-time_from_our_surat_office?"),
    dateOfBirth,
    highestQualification: readOptional("highest_qualification"),
    collegeName: readOptional("college_/_institute_name"),
    yearOfPassing: readOptional("year_of_passing_/_expected_passing"),
    cgpaOrPercentage: readOptional("cgpa_or_percentage"),
    technologies: readOptional("which_technologies_have_you_worked_with?"),
    projectInfo,
    githubUrl: readOptional("github_profile_link"),
    linkedinUrl: readOptional("linkedin_profile_link"),
    liveProjectUrl: readOptional("any_live_project_link"),
    selfLearningInfo: readOptional(
      "tell_us_about_one_thing_you_learned_on_your_own,_outside_college._how_did_you_learn_it?",
    ),
    aiToolsInfo: readOptional("which_ai_tools_have_you_used?"),
    reasonForJoining: readOptional("why_do_you_want_to_join_this_training_program?"),
    resumeUrl: readOptional("paste_a_link_to_your_resume_(google_drive_/_pdf_link)"),
    termsAgreement: readOptional("i_have_read_and_understood_all_the_above_terms,_and_i_agree_to_them."),
    informationConfirmation: readOptional(
      "i_confirm_that_all_information_provided_in_this_form_is_true_and_correct.",
    ),
    hearAboutProgram: readOptional("where_did_you_hear_about_this_training_program?"),
  };
}

/// Parses and validates one CSV sheet. Every row is validated independently —
/// a bad row is reported and excluded, never enough to fail the whole file —
/// except a header problem, which fails the whole file since nothing downstream
/// can be trusted to mean what it says.
export function parseCandidateSheet(sheet: RawSheet): ParseResult {
  const headerErrors: RowError[] = [];
  const columns = buildColumnMap(sheet.headers, headerErrors);

  if (!columns) {
    return { ok: false, errors: headerErrors };
  }

  if (sheet.rows.length === 0) {
    return { ok: false, errors: [{ row: 0, field: "file", message: "The upload contained no data rows." }] };
  }

  const rows: CandidateImportRow[] = [];
  const rowErrors: RowError[] = [];

  sheet.rows.forEach((values, index) => {
    const rowNumber = index + FIRST_DATA_ROW;
    const row = validateRow(values, columns, rowNumber, rowErrors);
    if (row) {
      rows.push(row);
    }
  });

  return { ok: true, rows, rowErrors };
}
