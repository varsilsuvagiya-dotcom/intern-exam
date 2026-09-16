import "server-only";

import { prisma } from "@/lib/db";
import { getExamSettings, SETTINGS_ID } from "@/lib/exam-settings";
import { normalizeMobile } from "@/lib/integrations/candidate-payload";

import { createExamSession } from "./exam-session";
import { failureReason, type FailureReason } from "./failure-reason";
import { ensureExamPaper, type GenerationFailure } from "./paper-generation";

/// Turns an internal failure code into a plain sentence for the server log, so
/// an admin reading it does not have to decode the JSON `failure` object by
/// hand. Candidates never see this — only `console.error`.
function describeFailure(failure: GenerationFailure): string {
  switch (failure.code) {
    case "ATTEMPT_NOT_FOUND":
      return "the attempt row was not found.";
    case "ATTEMPT_NOT_IN_PROGRESS":
      return "the attempt is no longer in progress.";
    case "NO_ACTIVE_SECTIONS":
      return "no exam sections are active — enable at least one in Settings.";
    case "SECTION_INSUFFICIENT_QUESTIONS":
      return `section "${failure.section}" needs ${failure.required} active questions but only has ${failure.available} — import or activate more questions for this section.`;
    case "LESSON_SECTION_INSUFFICIENT_GROUPS":
      return `Learn-and-Apply needs 2 lesson groups of 3 but only has ${failure.available} — import or activate more Learn-and-Apply questions.`;
    case "PAPER_INVARIANT_FAILED":
      return `paper failed validation: ${failure.problems.join("; ")}`;
  }
}

const MAX_EMAIL = 320;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StartOutcome =
  | { kind: "started"; resumed: boolean }
  | { kind: "closed" }
  | { kind: "ineligible" }
  /// The candidate was found by mobile, but has no CandidateExam record for
  /// the current exam (lib/exam-settings's SETTINGS_ID) — the Selected
  /// Candidates import (Phase 15/16) never created one for them. Kept
  /// distinct from `ineligible` (which also covers "no such candidate at
  /// all") because the brief requires the UI to tell the two apart, even
  /// though that necessarily reveals slightly more than `ineligible` does —
  /// see the comment on the eligibility check itself for the reasoning.
  | { kind: "not_selected" }
  | { kind: "completed" }
  | { kind: "invalid"; errors: { field: string; message: string }[] }
  /// `reason` says which *kind* of failure this was, never which section or
  /// how many questions it was short. A candidate must be able to tell "this
  /// will not work until staff fix it" from "try again in a moment", because
  /// those call for opposite actions — but the bank's composition is not
  /// theirs to see, so the internals stay in the server log.
  ///
  /// - `not_ready`: the exam itself is not set up — no active sections, a
  ///   section short of questions, or a paper that failed validation. Retrying
  ///   cannot help; an administrator has to act.
  /// - `error`: anything transient or internal — the database threw, the
  ///   attempt vanished mid-start. Retrying may well work.
  | { kind: "failed"; reason: FailureReason };

export type StartInput = { email: string; mobile: string };

function readInput(form: FormData): StartInput {
  return {
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    mobile: String(form.get("mobile") ?? "").trim(),
  };
}

/// Discards an attempt that never got a paper.
///
/// An attempt row is created before its paper is drawn, so a generation failure
/// used to leave behind an attempt that was `in_progress` with zero questions.
/// That is worse than no attempt at all: the candidate's next start resumes it
/// rather than creating a fresh one, so they are told they already have an exam
/// in progress and are handed the same empty attempt again.
///
/// Deleting it restores the state the candidate was in before they pressed
/// start, so retrying behaves like a first attempt. The delete is guarded on the
/// attempt still being in progress and still having no questions, so it can
/// never remove an attempt that has a paper or has been finalized. Answers
/// cannot exist yet — there are no questions to answer.
///
/// This runs only for an attempt this call created. A resumed attempt is never
/// discarded: its paper generation failing means an existing sitting could not
/// be loaded, and deleting it would destroy a real exam.
async function discardEmptyAttempt(attemptId: string): Promise<void> {
  try {
    const removed = await prisma.attempt.deleteMany({
      where: {
        id: attemptId,
        status: "in_progress",
        attemptQuestions: { none: {} },
      },
    });

    if (removed.count === 0) {
      // Left alone on purpose: something else gave it a paper or finalized it
      // between the failure and here, so it is a real attempt now.
      console.warn("Empty attempt was not discarded; it is no longer empty.", { attemptId });
    }
  } catch (error) {
    // The candidate already has a failure to report. A cleanup that cannot run
    // must not turn into a second, different error on top of it.
    console.error("Could not discard an attempt whose paper generation failed.", {
      attemptId,
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

/// Makes sure the attempt has its paper before reporting success. A generation
/// failure is logged with its internal reason for an admin to act on, while the
/// candidate only ever sees the generic failure state.
///
/// `created` says whether this call made the attempt. Only a freshly created
/// attempt is discarded when generation fails; a resumed one is left exactly as
/// it was.
async function withPaper(
  attemptId: string,
  resumed: boolean,
  created: boolean,
): Promise<StartOutcome> {
  try {
    const result = await ensureExamPaper(attemptId);

    if (!result.ok) {
      console.error(`Exam paper could not be generated: ${describeFailure(result.failure)}`, {
        failure: result.failure,
      });
      if (created) await discardEmptyAttempt(attemptId);
      return { kind: "failed", reason: failureReason(result.failure) };
    }
  } catch (error) {
    console.error("Exam paper generation threw.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    if (created) await discardEmptyAttempt(attemptId);
    // A thrown generation is not a configuration verdict — the bank may be
    // perfectly fine and the database merely unreachable.
    return { kind: "failed", reason: "error" };
  }

  // Issued only now, once eligibility and the paper are both settled. The cookie
  // is what lets /exam identify this candidate's attempt without the browser
  // ever naming one.
  await createExamSession(attemptId);

  return { kind: "started", resumed };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/// Decides whether a candidate may begin, and creates or resumes their attempt.
///
/// Every decision is made here from server state: the exam's open flag, the
/// candidate looked up by mobile, and that candidate's existing attempts. The
/// browser supplies only the two typed fields — never a candidate id, an
/// attempt id, or a start time.
export async function startOrResumeExam(form: FormData): Promise<StartOutcome> {
  const input = readInput(form);
  const errors: { field: string; message: string }[] = [];

  if (!input.email) {
    errors.push({ field: "email", message: "Email is required." });
  } else if (input.email.length > MAX_EMAIL || !EMAIL_PATTERN.test(input.email)) {
    errors.push({ field: "email", message: "Enter a valid email address." });
  }

  if (!input.mobile) {
    errors.push({ field: "mobile", message: "Mobile number is required." });
  }

  if (errors.length > 0) {
    return { kind: "invalid", errors };
  }

  // Same normalization the Google Apps Script sync uses, so a number stored from
  // the application form matches whatever formatting the candidate types here.
  //
  // A number this rejects is no longer fatal on its own: the email below can
  // still identify the candidate, so a malformed mobile simply contributes no
  // match instead of ending the start.
  const mobile = normalizeMobile(input.mobile);

  // Checked immediately before the write, not at page render: an admin may have
  // closed the exam while the candidate sat on the form.
  if (!(await getExamSettings()).isOpen) {
    return { kind: "closed" };
  }

  // Mobile *or* email identifies the candidate — either one matching an
  // application record is enough to proceed, per the business rule that a
  // candidate who mistypes one of the two should not be locked out of their
  // own exam.
  //
  // This is deliberately weaker than the previous mobile-only rule: whoever
  // knows either a selected candidate's number or their email address can
  // start that candidate's exam. There is no OTP or password behind it, so
  // the selection list (CandidateExam, checked below) remains the only real
  // gate.
  //
  // Email is compared lowercased because `readInput` lowercases it, and
  // `mode: "insensitive"` makes a record stored with different casing match
  // anyway. A null `mobile` (normalization rejected it) contributes no clause
  // rather than an `undefined` filter that would match every row.
  const candidate = await prisma.candidate.findFirst({
    where: {
      OR: [
        ...(mobile ? [{ mobile }] : []),
        { email: { equals: input.email, mode: "insensitive" as const } },
      ],
    },
    select: { id: true },
    orderBy: { registeredAt: "asc" },
  });

  if (!candidate) {
    return { kind: "ineligible" };
  }

  // Selection is the actual eligibility gate, checked once the candidate is
  // identified and before any Attempt/ExamSession can be created or resumed.
  // A CandidateExam row for the current exam (SETTINGS_ID — the same id
  // getExamSettings() above just read) is what the Selected Candidates
  // import (Phase 15/16) creates; its mere existence is the selection signal,
  // so this is an existence check, not a status check.
  //
  // Checked before the existing-attempt lookup below: an ineligible candidate
  // must never resume or create an attempt, so eligibility has to be settled
  // first (brief's required ordering). A candidate who was eligible when they
  // started but had their CandidateExam row disappear is not a real scenario
  // this phase needs to handle — there is no deselection feature, so a row
  // once created is never removed.
  const selection = await prisma.candidateExam.findUnique({
    where: { candidateId_examId: { candidateId: candidate.id, examId: SETTINGS_ID } },
    select: { id: true },
  });

  if (!selection) {
    return { kind: "not_selected" };
  }

  const existing = await prisma.attempt.findFirst({
    where: { candidateId: candidate.id },
    select: { id: true, status: true },
    orderBy: { startedAt: "desc" },
  });

  if (existing?.status === "in_progress") {
    // Crash recovery: the same attempt continues, and startedAt is left alone so
    // the timer keeps running from the real start. The paper is ensured rather
    // than redrawn, so the candidate sees exactly what they saw before.
    // Resumed, not created: never discarded on failure.
    return withPaper(existing.id, true, false);
  }

  if (existing) {
    // Anything that is not in progress is submitted or auto-submitted, and a
    // candidate gets one exam.
    return { kind: "completed" };
  }

  try {
    // startedAt and status come from the schema defaults, so neither can be set
    // by the request.
    const attempt = await prisma.attempt.create({
      // `enteredName` is left null: the form no longer asks for a name, so
      // there is nothing typed to record. Every reader of it already handles
      // null (see lib/admin/attempt-result.ts and lib/exam/candidate-paper.ts),
      // and the candidate's real name still comes from the Candidate row.
      data: {
        candidateId: candidate.id,
        enteredEmail: input.email,
      },
      select: { id: true },
    });

    // Created here, so an unusable attempt is cleaned up rather than left to
    // be resumed on the candidate's next try.
    return withPaper(attempt.id, false, true);
  } catch (error) {
    // A double-click can race two creates. The partial unique index rejects the
    // loser, whose attempt already exists, so resuming is the correct answer
    // rather than an error.
    if (isUniqueViolation(error)) {
      const attempt = await prisma.attempt.findFirst({
        where: { candidateId: candidate.id, status: "in_progress" },
        select: { id: true },
      });

      // The winner of the race created this attempt, not us. Treated as a
      // resume so a concurrent start cannot delete the attempt that won.
      return attempt ? withPaper(attempt.id, true, false) : { kind: "failed", reason: "error" };
    }

    console.error("Exam start failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { kind: "failed", reason: "error" };
  }
}
