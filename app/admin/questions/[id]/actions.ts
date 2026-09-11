"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { invalidateQuestionPool } from "@/lib/exam/question-pool";
import type { FieldError } from "@/lib/question-bank/question-rules";
import {
  setQuestionActive,
  updateQuestion,
  validateQuestionEdit,
} from "@/lib/question-bank/update-question";

export type EditState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; errors: FieldError[] };

function fail(message: string, field = "form"): EditState {
  return { status: "error", errors: [{ field, message }] };
}

export async function saveQuestion(_prev: EditState, formData: FormData): Promise<EditState> {
  await requireAdmin();

  // The id comes from the form but is only ever used to locate the row; it is
  // never written, so it cannot be renamed from the client.
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    return fail("The question could not be identified.");
  }

  const validation = validateQuestionEdit(formData);

  if (!validation.ok) {
    return { status: "error", errors: validation.errors };
  }

  try {
    const updated = await updateQuestion(id, validation.value);

    if (!updated) {
      return fail("That question no longer exists.");
    }
  } catch (error) {
    console.error("Question update failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return fail("The question could not be saved.");
  }

  revalidatePath(`/admin/questions/${id}`);
  revalidatePath("/admin/questions");
  // An edit can change a question's text, marks or eligibility, so a new
  // paper must not keep drawing the old copy from this process's cache.
  invalidateQuestionPool();
  return { status: "saved" };
}

export async function toggleActive(_prev: EditState, formData: FormData): Promise<EditState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const isActive = formData.get("isActive") === "true";

  if (!id) {
    return fail("The question could not be identified.");
  }

  try {
    const updated = await setQuestionActive(id, isActive);

    if (!updated) {
      return fail("That question no longer exists.");
    }
  } catch (error) {
    console.error("Question activation change failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return fail("The change could not be saved.");
  }

  revalidatePath(`/admin/questions/${id}`);
  revalidatePath("/admin/questions");
  // An edit can change a question's text, marks or eligibility, so a new
  // paper must not keep drawing the old copy from this process's cache.
  invalidateQuestionPool();
  return { status: "saved" };
}
