"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { updateExamSettings, validateSettings, type SettingsError } from "@/lib/exam-settings";

export type SettingsState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; errors: SettingsError[] };

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();

  const validation = validateSettings(formData);

  if (!validation.ok) {
    return { status: "error", errors: validation.errors };
  }

  try {
    const updated = await updateExamSettings(validation.value);

    if (!updated) {
      return {
        status: "error",
        errors: [{ field: "form", message: "Exam settings are missing. Run the database seed." }],
      };
    }
  } catch (error) {
    console.error("Exam settings update failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { status: "error", errors: [{ field: "form", message: "The settings could not be saved." }] };
  }

  revalidatePath("/admin/settings");
  return { status: "saved" };
}
