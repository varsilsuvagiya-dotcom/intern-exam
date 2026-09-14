"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { invalidateQuestionPool } from "@/lib/exam/question-pool";
import {
  NOT_READY_MESSAGE,
  type BatchProblem,
} from "@/lib/question-bank/activation-readiness";
import {
  activateQuestions,
  deactivateQuestions,
  type BulkResult,
} from "@/lib/question-bank/bulk-activation";

/// Bulk actions on a question selection.
///
/// Every one of these calls `requireAdmin()` first, which redirects an
/// unauthenticated caller to the login page before any question is read. A
/// Server Action is a POST endpoint, so this guard is the authority — not the
/// fact that the button lives on an admin page.

export type BulkState =
  | { status: "idle" }
  | { status: "done"; message: string }
  | { status: "error"; message: string; problems?: ProblemDetail[] };

export type ProblemDetail = { id: string; reasons: string[] };

function describe(problems: BatchProblem[]): ProblemDetail[] {
  return problems.map((problem) => ({
    id: problem.id,
    reasons: problem.reasons.map((reason) => NOT_READY_MESSAGE[reason]),
  }));
}

function readIds(formData: FormData): string[] {
  return formData
    .getAll("ids")
    .filter((entry): entry is string => typeof entry === "string")
    .flatMap((entry) => entry.split(","))
    .map((id) => id.trim())
    .filter((id) => id !== "");
}

function toState(result: BulkResult, verb: string): BulkState {
  if (result.ok) {
    return {
      status: "done",
      message: `${result.changed} question${result.changed === 1 ? "" : "s"} ${verb}.`,
    };
  }

  switch (result.code) {
    case "EMPTY_SELECTION":
      return { status: "error", message: "Select at least one question first." };
    case "TOO_MANY":
      return {
        status: "error",
        message: `Select at most ${result.limit} questions at a time.`,
      };
    case "NOT_FOUND":
      return {
        status: "error",
        message: `${result.missing.length} selected question${result.missing.length === 1 ? " no longer exists" : "s no longer exist"}. Nothing was changed.`,
      };
    case "NOT_READY":
      return {
        status: "error",
        message: `${result.problems.length} selected question${result.problems.length === 1 ? " is" : "s are"} not ready to activate. Nothing was activated.`,
        problems: describe(result.problems),
      };
  }
}

function refresh(): void {
  revalidatePath("/admin/questions");
  // Activation and deactivation change which questions a new paper may draw.
  // Dropping this process's cached pool makes the change visible here at once;
  // other instances pick it up when their own copy expires.
  invalidateQuestionPool();
}

export async function bulkActivate(_prev: BulkState, formData: FormData): Promise<BulkState> {
  await requireAdmin();

  try {
    const result = await activateQuestions(readIds(formData));
    if (result.ok) refresh();
    return toState(result, "activated");
  } catch (error) {
    console.error("Bulk activation failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { status: "error", message: "The change could not be saved." };
  }
}

export async function bulkDeactivate(_prev: BulkState, formData: FormData): Promise<BulkState> {
  await requireAdmin();

  try {
    const result = await deactivateQuestions(readIds(formData));
    if (result.ok) refresh();
    return toState(result, "deactivated");
  } catch (error) {
    console.error("Bulk deactivation failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { status: "error", message: "The change could not be saved." };
  }
}

