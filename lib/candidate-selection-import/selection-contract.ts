import "server-only";

/// The Selected Candidates import contract (Phase 15, corrected).
///
/// Confirmed contract (explicit business direction — the live sheet's own
/// header naming, reused here since the selected file is a subset of the
/// same source data):
///
/// - "Email Address2" — canonical email, primary matching key. Trimmed and
///   lowercased, matched against Candidate.email.
/// - "Email address" — explicitly ignored. Never read, never used for
///   matching, exactly like the live candidate import
///   (lib/candidate-import/csv-contract.ts).
/// - "Mobile Number (WhatsApp)" — fallback matching key, used only when the
///   email is blank or does not match any existing candidate. Normalized
///   with the existing normalizeMobile() (lib/integrations/candidate-payload.ts) —
///   the same function the live import and Google Form sync use.
/// - "Full Name" — optional, read for error reporting only. Never used for
///   identity and never written to Candidate.
///
/// The two email headers are matched by exact, case-sensitive text — never
/// through a normalizer — for the same reason as the live import: "Email
/// address" and "Email Address2" must never be confused with each other.
export const CANONICAL_EMAIL_HEADER = "Email Address2";
export const IGNORED_EMAIL_HEADER = "Email address";
export const MOBILE_HEADER = "Mobile Number (WhatsApp)";
export const NAME_HEADER = "Full Name";

export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"] as const;

/// Same order of magnitude as the live import's limits (lib/candidate-import/csv-contract.ts).
/// A selected-candidate file is a subset of the live sheet, so it is never
/// larger, but the limit is independent in case that assumption changes.
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 20_000;

export const MAX_EMAIL_LENGTH = 320;
