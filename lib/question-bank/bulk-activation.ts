import "server-only";

import { prisma } from "@/lib/db";

import {
  checkActivationBatch,
  type ActivationCandidate,
  type BatchProblem,
} from "./activation-readiness";
import { getLessonGroupSizes } from "./readiness-summary";

/// Bulk activation and deactivation.
///
/// The ids arrive from the browser and are the only thing trusted about the
/// request — and only as identifiers. Every field activation depends on is read
/// back from the database, so a client cannot supply a section, status or marks
/// value to slip a question past validation.
///
/// Activation is all-or-nothing: if any selected question fails, none are
/// activated. A partly-applied batch would leave the admin unsure which half
/// took effect, which is exactly the state this workflow exists to avoid.

/// Guards against an unbounded `IN (...)` from a crafted request.
export const MAX_BULK_IDS = 1000;

export type BulkResult =
  | { ok: true; changed: number }
  | { ok: false; code: "EMPTY_SELECTION" }
  | { ok: false; code: "TOO_MANY"; limit: number }
  | { ok: false; code: "NOT_FOUND"; missing: string[] }
  | { ok: false; code: "NOT_READY"; problems: BatchProblem[] };

const ACTIVATION_SELECT = {
  id: true,
  section: true,
  difficulty: true,
  question: true,
  optionA: true,
  optionB: true,
  optionC: true,
  optionD: true,
  correct: true,
  lessonText: true,
  lessonGroup: true,
  marks: true,
  status: true,
} as const;

function normalizeIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter((id) => id !== ""))];
}

/// Activates a selection, refusing the whole batch if any question is unfit.
export async function activateQuestions(rawIds: string[]): Promise<BulkResult> {
  const ids = normalizeIds(rawIds);

  if (ids.length === 0) {
    return { ok: false, code: "EMPTY_SELECTION" };
  }

  if (ids.length > MAX_BULK_IDS) {
    return { ok: false, code: "TOO_MANY", limit: MAX_BULK_IDS };
  }

  const rows = await prisma.question.findMany({
    where: { id: { in: ids } },
    select: ACTIVATION_SELECT,
  });

  if (rows.length !== ids.length) {
    const found = new Set(rows.map((row) => row.id));
    return { ok: false, code: "NOT_FOUND", missing: ids.filter((id) => !found.has(id)) };
  }

  const candidates: ActivationCandidate[] = rows.map((row) => ({
    ...row,
    marks: row.marks.toString(),
  }));

  const problems = checkActivationBatch(candidates, await getLessonGroupSizes());

  if (problems.length > 0) {
    return { ok: false, code: "NOT_READY", problems };
  }

  // Scoped to the validated ids only. `updateMany` writes `isActive` alone:
  // status, marks, section and every other field are left exactly as they are.
  const result = await prisma.question.updateMany({
    where: { id: { in: ids } },
    data: { isActive: true },
  });

  return { ok: true, changed: result.count };
}

/// Deactivation needs no readiness check: removing a question from the drawable
/// pool is always safe, and refusing it would strand a bad question in play.
export async function deactivateQuestions(rawIds: string[]): Promise<BulkResult> {
  const ids = normalizeIds(rawIds);

  if (ids.length === 0) {
    return { ok: false, code: "EMPTY_SELECTION" };
  }

  if (ids.length > MAX_BULK_IDS) {
    return { ok: false, code: "TOO_MANY", limit: MAX_BULK_IDS };
  }

  const result = await prisma.question.updateMany({
    where: { id: { in: ids } },
    data: { isActive: false },
  });

  return { ok: true, changed: result.count };
}

/// Moves a selection along the authoring workflow without touching `isActive`.
///
/// Kept separate from activation on purpose: promoting a question to `ready`
/// records that review is done, and must not by itself make it drawable. The
/// two decisions stay two actions.
export async function setQuestionsStatus(
  rawIds: string[],
  status: "draft" | "review" | "ready",
): Promise<BulkResult> {
  const ids = normalizeIds(rawIds);

  if (ids.length === 0) {
    return { ok: false, code: "EMPTY_SELECTION" };
  }

  if (ids.length > MAX_BULK_IDS) {
    return { ok: false, code: "TOO_MANY", limit: MAX_BULK_IDS };
  }

  const result = await prisma.question.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  return { ok: true, changed: result.count };
}
