import "server-only";

import { prisma } from "@/lib/db";
import { getExamSettings } from "@/lib/exam-settings";
import { normalizeMobile } from "@/lib/integrations/candidate-payload";

const MAX_NAME = 200;
const MAX_EMAIL = 320;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StartOutcome =
  | { kind: "started"; resumed: boolean }
  | { kind: "closed" }
  | { kind: "ineligible" }
  | { kind: "completed" }
  | { kind: "invalid"; errors: { field: string; message: string }[] }
  | { kind: "failed" };

export type StartInput = { name: string; email: string; mobile: string };

function readInput(form: FormData): StartInput {
  return {
    name: String(form.get("name") ?? "").trim(),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    mobile: String(form.get("mobile") ?? "").trim(),
  };
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
/// browser supplies only the three typed fields — never a candidate id, an
/// attempt id, or a start time.
export async function startOrResumeExam(form: FormData): Promise<StartOutcome> {
  const input = readInput(form);
  const errors: { field: string; message: string }[] = [];

  if (!input.name) {
    errors.push({ field: "name", message: "Full name is required." });
  } else if (input.name.length > MAX_NAME) {
    errors.push({ field: "name", message: "Full name is too long." });
  }

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
  const mobile = normalizeMobile(input.mobile);

  if (!mobile) {
    // A malformed number cannot match any application record. Reported as
    // ineligible rather than as a format error, so the response is identical
    // whether or not the number exists.
    return { kind: "ineligible" };
  }

  // Checked immediately before the write, not at page render: an admin may have
  // closed the exam while the candidate sat on the form.
  if (!(await getExamSettings()).isOpen) {
    return { kind: "closed" };
  }

  // Mobile is the eligibility key. The typed name and email are recorded on the
  // attempt but never used to find the candidate.
  const candidate = await prisma.candidate.findFirst({
    where: { mobile },
    select: { id: true },
    orderBy: { registeredAt: "asc" },
  });

  if (!candidate) {
    return { kind: "ineligible" };
  }

  const existing = await prisma.attempt.findFirst({
    where: { candidateId: candidate.id },
    select: { status: true },
    orderBy: { startedAt: "desc" },
  });

  if (existing?.status === "in_progress") {
    // Crash recovery: the same attempt continues, and startedAt is left alone so
    // the timer keeps running from the real start.
    return { kind: "started", resumed: true };
  }

  if (existing) {
    // Anything that is not in progress is submitted or auto-submitted, and a
    // candidate gets one exam.
    return { kind: "completed" };
  }

  try {
    // startedAt and status come from the schema defaults, so neither can be set
    // by the request. No AttemptQuestion rows are created here: generating the
    // paper is a later phase.
    await prisma.attempt.create({
      data: {
        candidateId: candidate.id,
        enteredName: input.name,
        enteredEmail: input.email,
      },
      select: { id: true },
    });

    return { kind: "started", resumed: false };
  } catch (error) {
    // A double-click can race two creates. The partial unique index rejects the
    // loser, whose attempt already exists, so resuming is the correct answer
    // rather than an error.
    if (isUniqueViolation(error)) {
      return { kind: "started", resumed: true };
    }

    console.error("Exam start failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { kind: "failed" };
  }
}
