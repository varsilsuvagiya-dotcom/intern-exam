import "server-only";

/// Pure matching decision for one selected-candidate row, given what the
/// database lookups found. Separated from select-candidates.ts's actual
/// Prisma calls the same way lib/candidate-import/match-candidate.ts
/// separates the live import's matching decision — so the decision itself is
/// testable without a database.
///
/// Matching priority (confirmed business direction, corrected from an
/// earlier email-only draft — see docs/selected-candidate-import.md):
///
/// 1. Canonical email ("Email Address2") — if it matches exactly one existing
///    candidate, that candidate is selected.
/// 2. Mobile Number (WhatsApp) — tried only when the email is blank or
///    matches no candidate, mirroring the live import's own email-then-mobile
///    priority (lib/candidate-import/match-candidate.ts).
/// 3. If email identifies one candidate and mobile identifies a *different*
///    one, that is an identity conflict — nothing is selected.
/// 4. If either key matches more than one existing candidate on its own,
///    that is also a conflict — a pre-existing data-quality issue in
///    Candidate, not something this import resolves by guessing.
/// 5. Neither key matches anything → not found.
export type SelectionMatchInput = {
  /// Candidate id(s) whose `email` equals this row's normalized email.
  /// Empty when the row had no usable email.
  byEmail: { id: string }[];
  /// Candidate id(s) whose `mobile` equals this row's normalized mobile.
  /// Empty when the row had no usable mobile.
  byMobile: { id: string }[];
};

export type SelectionMatchResult =
  | { kind: "found"; candidateId: string }
  | { kind: "notFound" }
  | { kind: "conflict"; message: string };

export function matchSelectionRow(
  input: SelectionMatchInput,
  identity: { email: string | null; mobile: string | null },
): SelectionMatchResult {
  const { byEmail, byMobile } = input;

  if (byEmail.length > 1) {
    return {
      kind: "conflict",
      message: `Email "${identity.email}" matches ${byEmail.length} existing candidates. Not selected automatically.`,
    };
  }

  if (byMobile.length > 1) {
    return {
      kind: "conflict",
      message: `Mobile "${identity.mobile}" matches ${byMobile.length} existing candidates. Not selected automatically.`,
    };
  }

  const emailMatch = byEmail[0];
  const mobileMatch = byMobile[0];

  if (emailMatch && mobileMatch && emailMatch.id !== mobileMatch.id) {
    return {
      kind: "conflict",
      message: `Email identifies candidate #${emailMatch.id} but mobile identifies a different candidate #${mobileMatch.id}. Identity conflict — not selected automatically.`,
    };
  }

  const candidateId = emailMatch?.id ?? mobileMatch?.id;

  return candidateId ? { kind: "found", candidateId } : { kind: "notFound" };
}
