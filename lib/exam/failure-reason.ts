import type { GenerationFailure } from "./paper-generation";

/// What the candidate is told when their start fails.
///
/// - `not_ready`: the exam itself is not set up — no active sections, a section
///   short of active questions, or a paper that failed validation. Retrying
///   cannot help; an administrator has to act.
/// - `error`: transient or internal — the attempt row was not in the expected
///   state, or the database threw. Retrying may well work.
export type FailureReason = "not_ready" | "error";

/// Which candidate-facing category a generation failure falls into.
///
/// The distinction earns its keep because the two call for opposite actions: a
/// candidate facing `not_ready` should fetch a supervisor rather than click
/// Start again, and one facing `error` should click Start again rather than
/// queue for a supervisor. Getting this backwards wastes the candidate's exam
/// time either way.
///
/// It maps a failure to a *category* only. Which section is short, and by how
/// many, stays in the server log — that is the question bank's composition, and
/// an exam-taker is the one person who must not be shown it.
///
/// Deliberately free of Prisma (it imports only the failure *type*) so it can be
/// unit-tested in the database-free "domain" project — see vitest.config.ts.
export function failureReason(failure: GenerationFailure): FailureReason {
  switch (failure.code) {
    case "NO_ACTIVE_SECTIONS":
    case "SECTION_INSUFFICIENT_QUESTIONS":
    case "LESSON_SECTION_INSUFFICIENT_GROUPS":
    case "PAPER_INVARIANT_FAILED":
      return "not_ready";
    case "ATTEMPT_NOT_FOUND":
    case "ATTEMPT_NOT_IN_PROGRESS":
      return "error";
  }
}
