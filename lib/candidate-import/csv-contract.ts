import "server-only";

/// The live candidate-sheet import contract (Phase 13).
///
/// Field-by-field reasoning lives in docs/candidate-import-field-mapping.md,
/// finalized during Phase 12 against the copy of the live sheet in this repo
/// (`untill tow 101.xlsx`, 100 rows). This file is the code-level mirror of
/// that document: change one, update the other.
///
/// The canonical email header is "Email Address2", per explicit business
/// confirmation. Note: the repo's own copy of the live sheet does not
/// currently contain a header with a "2" — its second email column reads
/// "Email Address" (no "2"), one letter's case away from "Email address".
/// This constant is set to "Email Address2" anyway, on direct instruction,
/// because the file in the repo may not be the latest export. If a real
/// upload's header truly reads "Email Address" (no "2"), header validation
/// below will reject the file as missing the canonical email column rather
/// than silently falling back to the wrong column — see
/// docs/candidate-import-field-mapping.md for the full discrepancy record.
export const IGNORED_EMAIL_HEADER = "Email address";
export const CANONICAL_EMAIL_HEADER = "Email Address2";

/// Explicitly ignored per the business requirement. Never stored under any
/// field, and never required to be mapped.
export const IGNORED_HEADERS = new Set<string>([IGNORED_EMAIL_HEADER, "Column 24", "Column 25"]);

/// Every other column, matched by normalized header name (trimmed, lowercased,
/// internal whitespace collapsed) so harmless spreadsheet formatting
/// differences don't break the match. The canonical email column is deliberately
/// absent from this map — it is matched separately, by exact text, in
/// `buildColumnMap`.
export const CANDIDATE_COLUMNS = [
  "timestamp",
  "full_name",
  "mobile_number_(whatsapp)",
  "current_city",
  "are_you_willing_to_work_full-time_from_our_surat_office?",
  "date_of_birth",
  "highest_qualification",
  "college_/_institute_name",
  "year_of_passing_/_expected_passing",
  "cgpa_or_percentage",
  "which_technologies_have_you_worked_with?",
  "have_you_built_any_project?",
  "describe_your_best_project_in_your_own_words.",
  "github_profile_link",
  "linkedin_profile_link",
  "any_live_project_link",
  "tell_us_about_one_thing_you_learned_on_your_own,_outside_college._how_did_you_learn_it?",
  "which_ai_tools_have_you_used?",
  "why_do_you_want_to_join_this_training_program?",
  "paste_a_link_to_your_resume_(google_drive_/_pdf_link)",
  "i_have_read_and_understood_all_the_above_terms,_and_i_agree_to_them.",
  "i_confirm_that_all_information_provided_in_this_form_is_true_and_correct.",
  "where_did_you_hear_about_this_training_program?",
] as const;

export type CandidateColumn = (typeof CANDIDATE_COLUMNS)[number];

/// Columns that may be blank on a row without failing it. Everything not
/// listed here is required per docs/candidate-import-field-mapping.md and
/// existing candidate business rules (name, mobile are already required for a
/// manually-added candidate; email and mobile are the import matching keys).
export const OPTIONAL_COLUMNS = new Set<CandidateColumn>([
  "current_city",
  "are_you_willing_to_work_full-time_from_our_surat_office?",
  "date_of_birth",
  "highest_qualification",
  "college_/_institute_name",
  "year_of_passing_/_expected_passing",
  "cgpa_or_percentage",
  "which_technologies_have_you_worked_with?",
  "have_you_built_any_project?",
  "describe_your_best_project_in_your_own_words.",
  "github_profile_link",
  "linkedin_profile_link",
  "any_live_project_link",
  "tell_us_about_one_thing_you_learned_on_your_own,_outside_college._how_did_you_learn_it?",
  "which_ai_tools_have_you_used?",
  "why_do_you_want_to_join_this_training_program?",
  "paste_a_link_to_your_resume_(google_drive_/_pdf_link)",
  "i_have_read_and_understood_all_the_above_terms,_and_i_agree_to_them.",
  "i_confirm_that_all_information_provided_in_this_form_is_true_and_correct.",
  "where_did_you_hear_about_this_training_program?",
]);

/// Same normalization the question-bank importer uses: trimmed, lowercased,
/// internal whitespace collapsed. Deliberately never applied to the two email
/// headers — see the comment on `CANONICAL_EMAIL_HEADER` above.
export function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

const SUPPORTED = new Set<string>(CANDIDATE_COLUMNS);

export function isSupportedColumn(normalized: string): normalized is CandidateColumn {
  return SUPPORTED.has(normalized);
}

/// The exact header row an upload must carry, in sheet order, as the live
/// sheet spells it — the human-readable counterpart to `CANDIDATE_COLUMNS`
/// above, which holds the same columns normalized for matching. Served as the
/// downloadable template (app/admin/candidates/template/route.ts) so an admin
/// can start from a file the importer is guaranteed to accept. The ignored
/// columns ("Email address", "Column 24", "Column 25") are deliberately left
/// out: the importer never reads them, so a template should not suggest them.
export const TEMPLATE_HEADERS = [
  "Timestamp",
  "Full Name",
  "Mobile Number (WhatsApp)",
  CANONICAL_EMAIL_HEADER,
  "Current City",
  "Are you willing to work full-time from our Surat office?",
  "Date of Birth",
  "Highest Qualification",
  "College / Institute Name",
  "Year of Passing / Expected Passing",
  "CGPA or Percentage",
  "Which technologies have you worked with?",
  "Have you built any project?",
  "Describe your best project in your own words.",
  "GitHub profile link",
  "LinkedIn profile link",
  "Any live project link",
  "Tell us about one thing you learned on your own, outside college. How did you learn it?",
  "Which AI tools have you used?",
  "Why do you want to join this training program?",
  "Paste a link to your resume (Google Drive / PDF link)",
  "I have read and understood all the above terms, and I agree to them.",
  "I confirm that all information provided in this form is true and correct.",
  "Where did you hear about this training program?",
] as const;

/// One filled row, so the template shows the expected shape of each column
/// (date formats especially) rather than only its name.
export const TEMPLATE_EXAMPLE_ROW: Record<string, string> = {
  Timestamp: "7/30/2026 17:53:40",
  "Full Name": "Example Candidate",
  "Mobile Number (WhatsApp)": "9876543210",
  [CANONICAL_EMAIL_HEADER]: "example@gmail.com",
  "Current City": "Surat",
  "Are you willing to work full-time from our Surat office?": "Yes",
  "Date of Birth": "5/23/05",
  "Highest Qualification": "B.E. / B.Tech",
  "College / Institute Name": "Example Institute of Technology",
  "Year of Passing / Expected Passing": "2026",
  "CGPA or Percentage": "8.73",
  "Which technologies have you worked with?": "JavaScript, React / Next.js, Python",
  "Have you built any project?": "Yes — college project",
  "Describe your best project in your own words.": "A short description of the project.",
  "GitHub profile link": "https://github.com/example",
  "LinkedIn profile link": "https://www.linkedin.com/in/example",
  "Any live project link": "https://example.com",
  "Tell us about one thing you learned on your own, outside college. How did you learn it?":
    "Learned Next.js from the official docs and by building a small app.",
  "Which AI tools have you used?": "ChatGPT, Claude, GitHub Copilot",
  "Why do you want to join this training program?": "To work on real projects with a team.",
  "Paste a link to your resume (Google Drive / PDF link)": "https://drive.google.com/file/d/example",
  "I have read and understood all the above terms, and I agree to them.": "I agree",
  "I confirm that all information provided in this form is true and correct.": "I confirm",
  "Where did you hear about this training program?": "LinkedIn",
};

export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"] as const;

/// Conservative limits for a live candidate file. The sheet audited in Phase 12
/// held 100 rows; this leaves ample headroom for the file to grow without
/// admitting an arbitrarily large upload.
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 20_000;

export const MAX_NAME_LENGTH = 200;
export const MAX_EMAIL_LENGTH = 320;
/// Generous ceiling for the long free-text answers (project description,
/// reason for joining, etc.), not a realistic expected length.
export const MAX_TEXT_LENGTH = 20_000;

export function describeAccepted(values: readonly string[]): string {
  return values.join(", ");
}
