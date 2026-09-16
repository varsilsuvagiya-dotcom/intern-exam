"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import {
  setSectionEnabled,
  updateExamSettings,
  validateSettings,
  type SettingsError,
} from "@/lib/exam-settings";

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

export type SectionToggleState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string };

export async function toggleSection(
  _prev: SectionToggleState,
  formData: FormData,
): Promise<SectionToggleState> {
  await requireAdmin();

  const code = String(formData.get("code") ?? "").trim();
  const enabled = formData.get("enabled") === "true";

  if (!code) {
    return { status: "error", message: "The section could not be identified." };
  }

  try {
    const result = await setSectionEnabled(code, enabled);

    if (!result.ok) {
      const message =
        result.error.code === "LAST_SECTION"
          ? "At least one section must stay active — a paper cannot be drawn with none."
          : "That section is not part of the current exam blueprint.";
      return { status: "error", message };
    }
  } catch (error) {
    console.error("Section toggle failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { status: "error", message: "The change could not be saved." };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/exam/start");
  return { status: "saved" };
}
