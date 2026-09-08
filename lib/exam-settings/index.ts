import "server-only";

import { prisma } from "@/lib/db";

import { SECTION_BLUEPRINT, TOTAL_MARKS, TOTAL_QUESTIONS } from "./exam-blueprint";

export const SETTINGS_ID = "singleton";

export const EXAM_NAME_MAX = 120;
export const DURATION_MIN = 1;
export const DURATION_MAX = 1440;

export type ExamSettings = {
  examName: string;
  durationMinutes: number;
  isOpen: boolean;
  easyPercent: number;
  mediumPercent: number;
  hardPercent: number;
  updatedAt: Date;
};

export type SettingsError = { field: string; message: string };

/// The single read path for exam configuration. Later phases should call this
/// rather than querying the table, so there is one place to change if the
/// storage ever moves.
///
/// Deliberately uncached: whether the exam is open gates candidate access, and
/// a stale `true` after an admin closes it would let candidates in. The read is
/// one indexed row by primary key.
export async function getExamSettings(): Promise<ExamSettings> {
  const settings = await prisma.examSetting.findUnique({
    where: { id: SETTINGS_ID },
    select: {
      examName: true,
      durationMinutes: true,
      isOpen: true,
      easyPercent: true,
      mediumPercent: true,
      hardPercent: true,
      updatedAt: true,
    },
  });

  if (!settings) {
    // The row is created by migration and by the seed. Its absence means the
    // database was not set up, which must not read as "the exam is open".
    throw new Error("Exam settings are missing. Run the database migrations and seed.");
  }

  return settings;
}

export async function isExamOpen(): Promise<boolean> {
  return (await getExamSettings()).isOpen;
}

export type SettingsUpdate = {
  examName: string;
  durationMinutes: number;
  isOpen: boolean;
  easyPercent: number;
  mediumPercent: number;
  hardPercent: number;
};

export function validateSettings(form: FormData):
  | { ok: true; value: SettingsUpdate }
  | { ok: false; errors: SettingsError[] } {
  const errors: SettingsError[] = [];

  const examName = String(form.get("examName") ?? "").trim();
  const durationRaw = String(form.get("durationMinutes") ?? "").trim();
  const statusRaw = String(form.get("status") ?? "").trim();

  if (!examName) {
    errors.push({ field: "examName", message: "Exam name is required." });
  } else if (examName.length > EXAM_NAME_MAX) {
    errors.push({ field: "examName", message: `Exam name must be at most ${EXAM_NAME_MAX} characters.` });
  }

  const durationMinutes = Number(durationRaw);
  if (!/^\d+$/.test(durationRaw) || !Number.isInteger(durationMinutes)) {
    errors.push({ field: "durationMinutes", message: "Duration must be a whole number of minutes." });
  } else if (durationMinutes < DURATION_MIN || durationMinutes > DURATION_MAX) {
    errors.push({
      field: "durationMinutes",
      message: `Duration must be between ${DURATION_MIN} and ${DURATION_MAX} minutes.`,
    });
  }

  if (statusRaw !== "open" && statusRaw !== "closed") {
    errors.push({ field: "status", message: "Exam status must be open or closed." });
  }

  const percents = (["easyPercent", "mediumPercent", "hardPercent"] as const).map((field) => {
    const raw = String(form.get(field) ?? "").trim();

    if (!/^\d+$/.test(raw)) {
      errors.push({ field, message: "Each difficulty share must be a whole percentage." });
      return Number.NaN;
    }

    return Number(raw);
  });

  const [easyPercent, mediumPercent, hardPercent] = percents;

  if (percents.every((value) => Number.isInteger(value))) {
    const total = easyPercent + mediumPercent + hardPercent;

    if (total !== 100) {
      errors.push({
        field: "difficultyMix",
        message: `The difficulty mix must add up to 100%, currently ${total}%.`,
      });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      examName,
      durationMinutes,
      isOpen: statusRaw === "open",
      easyPercent,
      mediumPercent,
      hardPercent,
    },
  };
}

export async function updateExamSettings(value: SettingsUpdate): Promise<boolean> {
  const result = await prisma.examSetting.updateMany({ where: { id: SETTINGS_ID }, data: value });
  return result.count === 1;
}

/// Exposed for the settings screen, which shows the fixed paper alongside the
/// editable values.
export function examBlueprintSummary() {
  return { sections: SECTION_BLUEPRINT, totalQuestions: TOTAL_QUESTIONS, totalMarks: TOTAL_MARKS };
}
