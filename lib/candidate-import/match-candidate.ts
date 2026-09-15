import "server-only";

/// Candidate identity matching for the CSV import.
///
/// Existing application logic (inspected before writing this) uses two
/// separate identity keys for two separate purposes, neither of which is a
/// database-unique constraint:
///
/// - Exam start (lib/exam/start-exam.ts) looks a candidate up by **mobile**.
///   This import does not touch that lookup or change what makes a candidate
///   eligible to start — it only decides which Candidate row a CSV row
///   belongs to.
/// - The admin "add/edit candidate" actions (app/admin/candidates/actions.ts)
///   treat a shared email *or* a shared mobile as a conflict to flag to the
///   admin, specifically because two real candidates can legitimately share a
///   household mobile number — so mobile alone is not a safe identity key for
///   deciding whether two rows are "the same candidate".
///
/// Matching priority for this import, consistent with both: **email first**
/// (the canonical identity the live sheet is keyed on), **mobile second**
/// (covers a candidate whose email changed between submissions), and a row is
/// only ever matched to one candidate. If email and mobile independently
/// match two *different* existing candidates, that is exactly the ambiguity
/// app/admin/candidates/actions.ts's conflict check exists to catch — this
/// import surfaces it as a reported conflict instead of guessing which
/// candidate is "right".
export type CandidateMatchInput = {
  rowNumber: number;
  name: string;
  email: string;
  mobile: string;
  /// Candidate id(s) whose `email` equals this row's normalized email.
  byEmail: { id: string }[];
  /// Candidate id(s) whose `mobile` equals this row's mobile.
  byMobile: { id: string }[];
};

export type CandidateMatchResult =
  | { kind: "create" }
  | { kind: "update"; candidateId: string }
  | { kind: "conflict"; message: string };

export function matchCandidate(input: CandidateMatchInput): CandidateMatchResult {
  const { byEmail, byMobile } = input;

  if (byEmail.length > 1) {
    return {
      kind: "conflict",
      message: `Email "${input.email}" matches ${byEmail.length} existing candidates. Not imported automatically.`,
    };
  }

  if (byMobile.length > 1) {
    return {
      kind: "conflict",
      message: `Mobile "${input.mobile}" matches ${byMobile.length} existing candidates. Not imported automatically.`,
    };
  }

  const emailMatch = byEmail[0];
  const mobileMatch = byMobile[0];

  if (emailMatch && mobileMatch && emailMatch.id !== mobileMatch.id) {
    return {
      kind: "conflict",
      message: `Email matches candidate #${emailMatch.id} but mobile matches a different candidate #${mobileMatch.id}. Identity conflict — not imported automatically.`,
    };
  }

  const matchId = emailMatch?.id ?? mobileMatch?.id;

  return matchId ? { kind: "update", candidateId: matchId } : { kind: "create" };
}
