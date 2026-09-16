import "server-only";

import { prisma } from "@/lib/db";

import { SECTION_BLUEPRINT, type SectionBlueprint } from "./exam-blueprint";

export const SETTINGS_ID = "singleton";

export const EXAM_NAME_MAX = 120;
export const DURATION_MIN = 1;
export const DURATION_MAX = 1440;
export const VIOLATION_LIMIT_MIN = 1;
export const VIOLATION_LIMIT_MAX = 20;

export type ExamSettings = {
  examName: string;
  durationMinutes: number;
  isOpen: boolean;
  easyPercent: number;
  mediumPercent: number;
  hardPercent: number;
  unauthorizedActivityLimit: number;
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
      unauthorizedActivityLimit: true,
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
  unauthorizedActivityLimit: number;
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

  const limitRaw = String(form.get("unauthorizedActivityLimit") ?? "").trim();
  const unauthorizedActivityLimit = Number(limitRaw);

  if (!/^\d+$/.test(limitRaw) || !Number.isInteger(unauthorizedActivityLimit)) {
    errors.push({
      field: "unauthorizedActivityLimit",
      message: "Unauthorized activity limit must be a whole number.",
    });
  } else if (unauthorizedActivityLimit < VIOLATION_LIMIT_MIN || unauthorizedActivityLimit > VIOLATION_LIMIT_MAX) {
    errors.push({
      field: "unauthorizedActivityLimit",
      message: `Unauthorized activity limit must be between ${VIOLATION_LIMIT_MIN} and ${VIOLATION_LIMIT_MAX}.`,
    });
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
      unauthorizedActivityLimit,
    },
  };
}

export async function updateExamSettings(value: SettingsUpdate): Promise<boolean> {
  const result = await prisma.examSetting.updateMany({ where: { id: SETTINGS_ID }, data: value });
  return result.count === 1;
}

/// Reads which blueprint sections currently take part in paper generation.
///
/// One row per section code; missing rows read as enabled, so a blueprint
/// section added in code before its settings row is seeded (or a database
/// that predates this table) behaves exactly as it always has — enabled —
/// rather than silently vanishing from every new paper.
export async function getActiveSectionCodes(): Promise<Set<string>> {
  const rows = await prisma.examSectionSetting.findMany({ select: { code: true, enabled: true } });
  const disabled = new Set(rows.filter((row) => !row.enabled).map((row) => row.code));

  return new Set(SECTION_BLUEPRINT.map((entry) => entry.code).filter((code) => !disabled.has(code)));
}

/// Carries the LAST_SECTION refusal out of the transaction callback, which can
/// only signal failure by throwing — it must roll the upsert back, not commit it.
class LastSectionError extends Error {}

export type SectionToggleError =
  | { code: "UNKNOWN_SECTION" }
  | { code: "LAST_SECTION" };

/// Flips one section's enabled flag. Refuses to leave zero sections enabled —
/// an exam with no active sections cannot draw a paper at all, so this would
/// otherwise brick every future exam start with no way back except a direct
/// database edit.
export async function setSectionEnabled(
  code: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: SectionToggleError }> {
  if (!SECTION_BLUEPRINT.some((entry) => entry.code === code)) {
    return { ok: false, error: { code: "UNKNOWN_SECTION" } };
  }

  if (!enabled) {
    // Guard and write in one serializable transaction. Read-then-write outside
    // one lets two concurrent disables both see two active sections, both pass
    // the guard, and between them leave zero — the bricked state this guard
    // exists to prevent, recoverable only by a direct database edit.
    try {
      await prisma.$transaction(
        async (tx) => {
          const rows = await tx.examSectionSetting.findMany({ select: { code: true, enabled: true } });
          const disabled = new Set(rows.filter((row) => !row.enabled).map((row) => row.code));
          const active = SECTION_BLUEPRINT.map((entry) => entry.code as string).filter(
            (entry) => !disabled.has(entry),
          );

          if (active.length <= 1 && active.includes(code)) {
            throw new LastSectionError();
          }

          await tx.examSectionSetting.upsert({
            where: { code },
            create: { code, enabled },
            update: { enabled },
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (error instanceof LastSectionError) {
        return { ok: false, error: { code: "LAST_SECTION" } };
      }
      throw error;
    }

    return { ok: true };
  }

  // Enabling can never produce the zero-section state, so it needs no guard.
  await prisma.examSectionSetting.upsert({
    where: { code },
    create: { code, enabled },
    update: { enabled },
  });

  return { ok: true };
}

/// Exposed for the settings screen, which shows the fixed paper alongside the
/// editable values. Only sections currently enabled contribute to the totals
/// and the list shown — a disabled section is not merely dimmed, since a
/// candidate starting from here would in fact not receive it.
export async function examBlueprintSummary(): Promise<{
  sections: readonly (SectionBlueprint & { enabled: boolean; available: number })[];
  totalQuestions: number;
  totalMarks: number;
}> {
  const [rows, bank] = await Promise.all([
    prisma.examSectionSetting.findMany({ select: { code: true, enabled: true } }),
    // What the bank actually holds per section. An enabled section with fewer
    // active questions than its blueprint count cannot be drawn, and paper
    // generation fails for every candidate — so the shortfall is shown here,
    // next to the toggle that causes it, rather than only in the server log.
    prisma.question.groupBy({ by: ["section"], where: { isActive: true }, _count: { _all: true } }),
  ]);

  const enabledByCode = new Map(rows.map((row) => [row.code, row.enabled]));
  const availableByCode = new Map(bank.map((row) => [row.section, row._count._all]));

  const sections = SECTION_BLUEPRINT.map((entry) => ({
    ...entry,
    // Missing row reads as enabled — see getActiveSectionCodes for why.
    enabled: enabledByCode.get(entry.code) ?? true,
    available: availableByCode.get(entry.code) ?? 0,
  }));

  const active = sections.filter((entry) => entry.enabled);

  return {
    sections,
    totalQuestions: active.reduce((total, entry) => total + entry.questionCount, 0),
    totalMarks: active.reduce((total, entry) => total + entry.questionCount * entry.marksPerQuestion, 0),
  };
}
