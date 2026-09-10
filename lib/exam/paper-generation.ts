import "server-only";

import { randomInt } from "node:crypto";

import { prisma } from "@/lib/db";
import {
  LESSON_GROUPS_PER_PAPER,
  LESSON_SECTION,
  QUESTIONS_PER_LESSON_GROUP,
  SECTION_BLUEPRINT,
  TOTAL_MARKS,
  TOTAL_QUESTIONS,
  type SectionCode,
} from "@/lib/exam-settings/exam-blueprint";
import type { OptionKey } from "@/lib/generated/prisma/enums";

import {
  DIFFICULTY_ORDER,
  allocateDifficultyCounts,
  type DifficultyCounts,
  type DifficultyMix,
} from "./difficulty-allocation";

const OPTION_KEYS: OptionKey[] = ["a", "b", "c", "d"];

/// Internal reasons, for server logs and admin diagnosis. Candidates never see
/// these; the caller turns any failure into one generic message.
export type GenerationFailure =
  | { code: "ATTEMPT_NOT_FOUND" }
  | { code: "ATTEMPT_NOT_IN_PROGRESS" }
  | { code: "SECTION_INSUFFICIENT_QUESTIONS"; section: string; required: number; available: number }
  | { code: "LESSON_SECTION_INSUFFICIENT_GROUPS"; available: number }
  | { code: "PAPER_INVARIANT_FAILED"; problems: string[] };

export type GenerationResult =
  | { ok: true; created: boolean; questionCount: number }
  | { ok: false; failure: GenerationFailure };

type SelectedQuestion = {
  questionId: string;
  /// The historical ordinal, written to the AttemptQuestion snapshot. The code
  /// itself is not stored on a drawn paper: the snapshot keeps the numbering the
  /// exam was recorded under.
  section: number;
  sectionCode: SectionCode;
  questionText: string;
  codeBlock: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: OptionKey;
  explanation: string | null;
  lessonText: string | null;
  lessonGroup: string | null;
  marks: string;
  scored: boolean;
};

type PoolQuestion = SelectedQuestion & { difficulty: string };

/// Fisher-Yates using a crypto-quality source by default. The generator draws
/// papers candidates sit for, so predictable ordering is a real weakness, not a
/// theoretical one. Tests inject a deterministic `rand` instead.
export function shuffle<T>(items: T[], rand: (max: number) => number = randomInt): T[] {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = rand(index + 1);
    [result[index], result[swap]] = [result[swap], result[index]];
  }

  return result;
}

function shuffledOptions(rand?: (max: number) => number): OptionKey[] {
  return shuffle(OPTION_KEYS, rand);
}

function toSelected(row: PoolQuestion): SelectedQuestion {
  return {
    questionId: row.questionId,
    section: row.section,
    sectionCode: row.sectionCode,
    questionText: row.questionText,
    codeBlock: row.codeBlock,
    optionA: row.optionA,
    optionB: row.optionB,
    optionC: row.optionC,
    optionD: row.optionD,
    correct: row.correct,
    explanation: row.explanation,
    lessonText: row.lessonText,
    lessonGroup: row.lessonGroup,
    marks: row.marks,
    scored: row.scored,
  };
}

/// Picks `count` questions from a pool, honouring the difficulty mix as closely
/// as the pool allows.
function pickWithMix(
  pool: PoolQuestion[],
  count: number,
  mix: DifficultyMix,
  rand?: (max: number) => number,
): SelectedQuestion[] | null {
  const buckets = new Map<string, PoolQuestion[]>();
  for (const key of DIFFICULTY_ORDER) {
    buckets.set(key, []);
  }
  for (const question of pool) {
    buckets.get(question.difficulty)?.push(question);
  }

  const available = Object.fromEntries(
    DIFFICULTY_ORDER.map((key) => [key, buckets.get(key)?.length ?? 0]),
  ) as DifficultyCounts;

  const allocation = allocateDifficultyCounts(count, mix, available);

  if (!allocation) {
    return null;
  }

  const chosen: SelectedQuestion[] = [];
  for (const key of DIFFICULTY_ORDER) {
    const bucket = shuffle(buckets.get(key) ?? [], rand);
    chosen.push(...bucket.slice(0, allocation[key]).map(toSelected));
  }

  // Mix the difficulties together so a section does not read easy-then-hard.
  return shuffle(chosen, rand);
}

/// Section 7 is drawn as whole lessons. The unit of choice is the group, so
/// this scores every complete group's difficulty profile against the target and
/// picks the closest pair, choosing at random among equally close pairs.
function pickLessonGroups(
  pool: PoolQuestion[],
  mix: DifficultyMix,
  rand?: (max: number) => number,
): SelectedQuestion[] | { insufficient: number } {
  const groups = new Map<string, PoolQuestion[]>();

  for (const question of pool) {
    if (!question.lessonGroup || !question.lessonText) continue;
    const existing = groups.get(question.lessonGroup) ?? [];
    existing.push(question);
    groups.set(question.lessonGroup, existing);
  }

  // A partial lesson is unusable: the candidate must see all three questions.
  const complete = [...groups.entries()]
    .filter(([, questions]) => questions.length === QUESTIONS_PER_LESSON_GROUP)
    // Stable internal order so the three questions always appear as authored.
    .map(([name, questions]) => ({
      name,
      questions: [...questions].sort((a, b) => a.questionId.localeCompare(b.questionId)),
    }));

  if (complete.length < LESSON_GROUPS_PER_PAPER) {
    return { insufficient: complete.length };
  }

  const target = {
    easy: (QUESTIONS_PER_LESSON_GROUP * LESSON_GROUPS_PER_PAPER * mix.easy) / 100,
    medium: (QUESTIONS_PER_LESSON_GROUP * LESSON_GROUPS_PER_PAPER * mix.medium) / 100,
    hard: (QUESTIONS_PER_LESSON_GROUP * LESSON_GROUPS_PER_PAPER * mix.hard) / 100,
  };

  const scored = [];
  for (let i = 0; i < complete.length; i += 1) {
    for (let j = i + 1; j < complete.length; j += 1) {
      const pair = [complete[i], complete[j]];
      const counts = { easy: 0, medium: 0, hard: 0 } as DifficultyCounts;
      for (const group of pair) {
        for (const question of group.questions) {
          if (question.difficulty in counts) {
            counts[question.difficulty as keyof DifficultyCounts] += 1;
          }
        }
      }
      const distance = DIFFICULTY_ORDER.reduce(
        (sum, key) => sum + Math.abs(counts[key] - target[key]),
        0,
      );
      scored.push({ pair, distance });
    }
  }

  const best = Math.min(...scored.map((entry) => entry.distance));
  const closest = scored.filter((entry) => entry.distance === best);
  const picked = shuffle(closest, rand)[0];

  // Group order may vary; order *within* a group never does.
  return shuffle(picked.pair, rand).flatMap((group) => group.questions.map(toSelected));
}

/// Pure invariant check over a fully assembled paper. Kept separate so it can be
/// tested on its own, and so nothing reaches the database unvalidated.
export function validateGeneratedPaper(
  rows: { section: number; displayOrder: number; questionId: string; marks: string; shuffledOptionOrder: OptionKey[]; lessonGroup: string | null }[],
): string[] {
  const problems: string[] = [];

  if (rows.length !== TOTAL_QUESTIONS) {
    problems.push(`expected ${TOTAL_QUESTIONS} questions, assembled ${rows.length}`);
  }

  const totalMarks = rows.reduce((sum, row) => sum + Number(row.marks), 0);
  if (Math.abs(totalMarks - TOTAL_MARKS) > 0.001) {
    problems.push(`expected ${TOTAL_MARKS} marks, assembled ${totalMarks}`);
  }

  if (new Set(rows.map((row) => row.questionId)).size !== rows.length) {
    problems.push("the same question appears more than once");
  }

  const orders = rows.map((row) => row.displayOrder).sort((a, b) => a - b);
  const ordersValid =
    new Set(orders).size === rows.length &&
    orders[0] === 1 &&
    orders[orders.length - 1] === rows.length;
  if (!ordersValid) {
    problems.push("display order is not a gapless 1..n sequence");
  }

  // Sections must occupy consecutive blocks in blueprint order.
  let cursor = 0;
  for (const section of SECTION_BLUEPRINT) {
    const block = rows
      .filter((row) => row.section === section.ordinal)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    if (block.length !== section.questionCount) {
      problems.push(
        `section ${section.code} has ${block.length} questions, expected ${section.questionCount}`,
      );
      continue;
    }

    const expectedStart = cursor + 1;
    if (block[0].displayOrder !== expectedStart) {
      problems.push(`section ${section.code} starts at ${block[0].displayOrder}, expected ${expectedStart}`);
    }
    cursor += section.questionCount;
  }

  const lessonOrdinal = SECTION_BLUEPRINT.find((entry) => entry.code === LESSON_SECTION)?.ordinal;
  const lessonRows = rows.filter((row) => row.section === lessonOrdinal);
  const lessonGroups = new Set(lessonRows.map((row) => row.lessonGroup));
  if (lessonGroups.size !== LESSON_GROUPS_PER_PAPER) {
    problems.push(`section ${LESSON_SECTION} has ${lessonGroups.size} lesson groups, expected ${LESSON_GROUPS_PER_PAPER}`);
  }
  for (const group of lessonGroups) {
    const size = lessonRows.filter((row) => row.lessonGroup === group).length;
    if (size !== QUESTIONS_PER_LESSON_GROUP) {
      problems.push(`lesson group ${group} contributes ${size} questions, expected ${QUESTIONS_PER_LESSON_GROUP}`);
    }
  }
  // Each group must be contiguous, so its three questions stay together.
  for (const group of lessonGroups) {
    const positions = lessonRows
      .filter((row) => row.lessonGroup === group)
      .map((row) => row.displayOrder)
      .sort((a, b) => a - b);
    if (positions[positions.length - 1] - positions[0] !== positions.length - 1) {
      problems.push(`lesson group ${group} is split across the paper`);
    }
  }

  for (const row of rows) {
    const order = row.shuffledOptionOrder;
    if (order.length !== 4 || new Set(order).size !== 4 || !OPTION_KEYS.every((key) => order.includes(key))) {
      problems.push(`question ${row.questionId} has an invalid option order`);
    }
  }

  return problems;
}

/// Creates the paper for an attempt, or returns the one already stored.
///
/// A paper is drawn once and never redrawn: refresh, resume, a changed question
/// bank or a changed difficulty mix all leave an existing paper exactly as it
/// was. Everything happens in one transaction, so a failure part way through
/// leaves no partial paper behind.
export async function ensureExamPaper(
  attemptId: string,
  rand?: (max: number) => number,
): Promise<GenerationResult> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { id: true, status: true, _count: { select: { attemptQuestions: true } } },
  });

  if (!attempt) {
    return { ok: false, failure: { code: "ATTEMPT_NOT_FOUND" } };
  }

  if (attempt._count.attemptQuestions > 0) {
    return { ok: true, created: false, questionCount: attempt._count.attemptQuestions };
  }

  if (attempt.status !== "in_progress") {
    return { ok: false, failure: { code: "ATTEMPT_NOT_IN_PROGRESS" } };
  }

  const settings = await prisma.examSetting.findUniqueOrThrow({
    where: { id: "singleton" },
    select: { easyPercent: true, mediumPercent: true, hardPercent: true },
  });
  const mix: DifficultyMix = {
    easy: settings.easyPercent,
    medium: settings.mediumPercent,
    hard: settings.hardPercent,
  };

  // Only ready, active questions are eligible, per the requirements.
  const pool = await prisma.question.findMany({
    where: { status: "ready", isActive: true },
    select: {
      id: true,
      section: true,
      difficulty: true,
      question: true,
      codeBlock: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      correct: true,
      explanation: true,
      lessonText: true,
      lessonGroup: true,
      marks: true,
      scored: true,
    },
  });

  const blueprintFor = new Map(SECTION_BLUEPRINT.map((entry) => [entry.code as string, entry]));

  const bySection = new Map<string, PoolQuestion[]>();
  for (const row of pool) {
    // A question whose section is not an active code — the deactivated Attitude
    // rows, for instance — has no ordinal and is skipped. The query already
    // filters them out by is_active; this is the second line of defence.
    const active = blueprintFor.get(row.section);
    if (!active) {
      continue;
    }

    const entry: PoolQuestion = {
      questionId: row.id,
      section: active.ordinal,
      sectionCode: active.code,
      difficulty: row.difficulty,
      questionText: row.question,
      codeBlock: row.codeBlock,
      optionA: row.optionA,
      optionB: row.optionB,
      optionC: row.optionC,
      optionD: row.optionD,
      correct: row.correct,
      explanation: row.explanation,
      lessonText: row.lessonText,
      lessonGroup: row.lessonGroup,
      marks: row.marks.toString(),
      scored: row.scored,
    };
    const existing = bySection.get(row.section) ?? [];
    existing.push(entry);
    bySection.set(row.section, existing);
  }

  const selected: SelectedQuestion[] = [];

  for (const section of SECTION_BLUEPRINT) {
    const sectionPool = bySection.get(section.code) ?? [];

    if (section.code === LESSON_SECTION) {
      const groups = pickLessonGroups(sectionPool, mix, rand);

      if ("insufficient" in groups) {
        return {
          ok: false,
          failure: { code: "LESSON_SECTION_INSUFFICIENT_GROUPS", available: groups.insufficient },
        };
      }

      selected.push(...groups);
      continue;
    }

    const picked = pickWithMix(sectionPool, section.questionCount, mix, rand);

    if (!picked) {
      return {
        ok: false,
        failure: {
          code: "SECTION_INSUFFICIENT_QUESTIONS",
          section: section.code,
          required: section.questionCount,
          available: sectionPool.length,
        },
      };
    }

    selected.push(...picked);
  }

  // `sectionCode` is deliberately not carried onto the snapshot: a drawn paper
  // records the ordinal, which is the numbering it is read back under.
  const rows = selected.map((question, index) => ({
    questionId: question.questionId,
    section: question.section,
    questionText: question.questionText,
    codeBlock: question.codeBlock,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    correct: question.correct,
    explanation: question.explanation,
    lessonText: question.lessonText,
    lessonGroup: question.lessonGroup,
    marks: question.marks,
    scored: question.scored,
    displayOrder: index + 1,
    shuffledOptionOrder: shuffledOptions(rand),
  }));

  const problems = validateGeneratedPaper(rows);

  if (problems.length > 0) {
    return { ok: false, failure: { code: "PAPER_INVARIANT_FAILED", problems } };
  }

  let created = false;

  try {
    await prisma.$transaction(async (tx) => {
      // Re-checked inside the transaction, but two concurrent callers can each
      // see an empty table in their own snapshot. The unique constraints on
      // (attempt_id, display_order) and (attempt_id, question_id) are what
      // actually decide the winner: the loser's insert fails and is caught below.
      const existing = await tx.attemptQuestion.count({ where: { attemptId } });

      if (existing > 0) {
        return;
      }

      await tx.attemptQuestion.createMany({
        data: rows.map((row) => ({ attemptId, ...row })),
      });

      created = true;
    });
  } catch (error) {
    // The loser of a race violates one of those unique constraints. The paper it
    // wanted now exists, so the right answer is that paper, not an error.
    if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002") {
      const count = await prisma.attemptQuestion.count({ where: { attemptId } });
      return { ok: true, created: false, questionCount: count };
    }

    throw error;
  }

  const finalCount = await prisma.attemptQuestion.count({ where: { attemptId } });
  return { ok: true, created, questionCount: finalCount };
}

/// The stored paper is the source of truth for what a candidate sits, so this
/// reads AttemptQuestion and never rebuilds anything from the question bank.
export async function getExamPaper(attemptId: string) {
  return prisma.attemptQuestion.findMany({
    where: { attemptId },
    orderBy: { displayOrder: "asc" },
  });
}
