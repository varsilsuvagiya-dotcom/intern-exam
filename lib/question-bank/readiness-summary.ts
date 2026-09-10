import "server-only";

import { prisma } from "@/lib/db";
import { SECTION_BLUEPRINT, type SectionCode } from "@/lib/exam-settings/exam-blueprint";

import {
  checkActivationReadiness,
  type ActivationCandidate,
} from "./activation-readiness";

/// What the admin needs to know before activating anything: how much of the
/// bank exists, how much of it is drawable, and which sections cannot yet
/// supply a paper.
///
/// Nothing here invents a number. A section with no source data reports zero
/// and is marked unavailable — it is never rounded up to "ready" because the
/// blueprint expects questions there.

/// The fields readiness is judged on. Selecting explicitly keeps `verifyCode`
/// out of the query entirely rather than relying on a later omission.
const READINESS_SELECT = {
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
  isActive: true,
} as const;

export type BankTotals = {
  total: number;
  active: number;
  inactive: number;
  draft: number;
  review: number;
  ready: number;
  /// Inactive questions that would pass validation if activated now.
  readyToActivate: number;
  /// Inactive questions that would be refused.
  notReady: number;
  /// Questions paper generation can actually draw: ready AND active.
  drawable: number;
};

export type SectionReadiness = {
  code: SectionCode;
  name: string;
  /// What the blueprint requires this section to supply per paper.
  requiredPerPaper: number;
  marksPerQuestion: number;
  total: number;
  active: number;
  inactive: number;
  draft: number;
  drawable: number;
  readyToActivate: number;
  notReady: number;
  /// True when enough drawable questions exist to fill the section today.
  sufficient: boolean;
  /// True when the section has no questions at all — the four missing sources.
  missing: boolean;
  /// Distinct source marks present, so a mismatch with the blueprint is
  /// visible without this module deciding what to do about it.
  distinctMarks: string[];
  /// Set when the stored marks do not match the blueprint. Surfaced, never
  /// corrected: reconciling it is a business decision.
  marksMismatch: boolean;
};

export type BankReadiness = {
  totals: BankTotals;
  sections: SectionReadiness[];
};

type Row = {
  id: string;
  section: string;
  difficulty: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: string;
  lessonText: string | null;
  lessonGroup: string | null;
  marks: { toString(): string };
  status: string;
  isActive: boolean;
};

function toCandidate(row: Row): ActivationCandidate {
  return { ...row, marks: row.marks.toString() };
}

/// Reads the whole bank once and derives every count from it. At a few thousand
/// questions this is a single cheap scan; splitting it into a dozen grouped
/// counts would cost more round trips and still not answer the readiness
/// question, which needs the row contents rather than just its status.
export async function getBankReadiness(): Promise<BankReadiness> {
  const rows = (await prisma.question.findMany({ select: READINESS_SELECT })) as Row[];

  const totals: BankTotals = {
    total: rows.length,
    active: 0,
    inactive: 0,
    draft: 0,
    review: 0,
    ready: 0,
    readyToActivate: 0,
    notReady: 0,
    drawable: 0,
  };

  // Group sizes come from the whole bank, since a lesson is complete or not
  // regardless of which of its questions happen to be selected.
  const groupSizes = new Map<string, number>();
  for (const row of rows) {
    if (row.lessonGroup) {
      groupSizes.set(row.lessonGroup, (groupSizes.get(row.lessonGroup) ?? 0) + 1);
    }
  }

  const bySection = new Map<string, Row[]>();
  for (const row of rows) {
    const existing = bySection.get(row.section) ?? [];
    existing.push(row);
    bySection.set(row.section, existing);
  }

  const tally = (row: Row, into: { active: number; inactive: number; draft: number; drawable: number; readyToActivate: number; notReady: number }) => {
    if (row.isActive) into.active += 1;
    else into.inactive += 1;
    if (row.status === "draft") into.draft += 1;
    if (row.status === "ready" && row.isActive) into.drawable += 1;

    if (!row.isActive) {
      const verdict = checkActivationReadiness(toCandidate(row));
      if (verdict.ready) into.readyToActivate += 1;
      else into.notReady += 1;
    }
  };

  for (const row of rows) {
    if (row.status === "review") totals.review += 1;
    if (row.status === "ready") totals.ready += 1;
    tally(row, totals);
  }

  const sections: SectionReadiness[] = SECTION_BLUEPRINT.map((blueprint) => {
    const sectionRows = bySection.get(blueprint.code) ?? [];
    const counts = { active: 0, inactive: 0, draft: 0, drawable: 0, readyToActivate: 0, notReady: 0 };

    for (const row of sectionRows) {
      tally(row, counts);
    }

    const distinctMarks = [...new Set(sectionRows.map((row) => row.marks.toString()))].sort();
    const expected = blueprint.marksPerQuestion;

    return {
      code: blueprint.code,
      name: blueprint.name,
      requiredPerPaper: blueprint.questionCount,
      marksPerQuestion: expected,
      total: sectionRows.length,
      ...counts,
      sufficient: counts.drawable >= blueprint.questionCount,
      missing: sectionRows.length === 0,
      distinctMarks,
      // A section with no questions has nothing to mismatch.
      marksMismatch:
        sectionRows.length > 0 && distinctMarks.some((value) => Number(value) !== expected),
    };
  });

  return { totals, sections };
}

/// The lesson-group sizes activation needs, read from the whole bank.
export async function getLessonGroupSizes(): Promise<Map<string, number>> {
  const rows = await prisma.question.findMany({
    where: { lessonGroup: { not: null } },
    select: { lessonGroup: true },
  });

  const sizes = new Map<string, number>();
  for (const row of rows) {
    if (row.lessonGroup) {
      sizes.set(row.lessonGroup, (sizes.get(row.lessonGroup) ?? 0) + 1);
    }
  }

  return sizes;
}
