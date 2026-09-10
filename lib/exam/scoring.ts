import "server-only";

import { prisma } from "@/lib/db";
import {
  SECTION_BLUEPRINT,
  TOTAL_MARKS,
  TOTAL_QUESTIONS,
  sectionNameByOrdinal,
} from "@/lib/exam-settings/exam-blueprint";
import type { OptionKey } from "@/lib/generated/prisma/enums";

/// Scoring for a finalized attempt.
///
/// Three rules govern everything here:
///
///  1. Only a finalized attempt is ever scored. An in-progress attempt is still
///     accepting answers, so any total computed from it would be a guess.
///  2. Every value comes from the AttemptQuestion snapshot — `correct`, `marks`,
///     `section` and `scored`. The live Question row is never consulted, so
///     editing, re-marking or deactivating a question in the bank cannot change
///     a result that has already been produced.
///  3. Nothing is accumulated. Each run recomputes the complete score from the
///     stored paper and the stored answers, so running it again is a no-op
///     rather than a doubling.
///
/// There is no negative marking anywhere: a wrong, missing or malformed answer
/// is worth zero, never less.

const VALID_OPTIONS = new Set<string>(["a", "b", "c", "d"]);

/// Marks are 1, 1.5, 2 or 2.5, and a section total has to come out exactly.
/// Summing those as JavaScript numbers produces 11.999999999999998 soon enough
/// to matter, so all arithmetic runs in integer hundredths and only converts
/// back at the edges. Decimal(x,2) columns hold the result exactly.
const SCALE = 100;

function toHundredths(marks: { toString(): string }): number {
  const value = Math.round(Number(marks.toString()) * SCALE);

  if (!Number.isFinite(value)) {
    throw new Error("Snapshot marks are not a finite number.");
  }

  return value;
}

/// Back to the two-decimal string Prisma stores as Decimal, without ever
/// building a float from the accumulated total.
function fromHundredths(value: number): string {
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  return `${sign}${Math.floor(absolute / SCALE)}.${String(absolute % SCALE).padStart(2, "0")}`;
}

export type SectionScore = {
  /// The historical ordinal the paper was drawn under.
  section: number;
  code: string;
  name: string;
  /// Marks achieved.
  score: string;
  /// Marks the section is worth on a correctly drawn paper.
  maxScore: string;
  questionCount: number;
  correctCount: number;
  answeredCount: number;
  unansweredCount: number;
};

export type ScoreResult =
  | {
      kind: "scored";
      totalScore: string;
      maxScore: string;
      sections: SectionScore[];
      /// True when a previous run had already stored this result.
      alreadyScored: boolean;
    }
  | { kind: "not-found" }
  /// The attempt is still in progress; scoring it would be meaningless.
  | { kind: "not-finalized" }
  /// The stored paper does not describe a valid exam. Nothing is written and
  /// the problems are reported rather than silently clamped away.
  | { kind: "invalid-paper"; problems: string[] }
  /// The stored paper does not match the active blueprint, because it was drawn
  /// under an earlier exam structure. Its stored result stays exactly as it is:
  /// re-scoring it against today's rules would produce a different, wrong
  /// number for an exam the candidate already sat.
  | { kind: "incompatible-blueprint"; expected: number; found: number };

type ScoredRow = {
  attemptQuestionId: string;
  isCorrect: boolean | null;
  marksAwardedHundredths: number;
};

type Computed = {
  rows: ScoredRow[];
  sections: SectionScore[];
  totalHundredths: number;
  problems: string[];
};

/// Pure scoring over an already-loaded paper. Separated from the database so the
/// rules can be tested directly, and so nothing is written before the whole
/// paper has been checked.
export function computeScore(
  questions: {
    id: string;
    section: number;
    correct: OptionKey;
    marks: { toString(): string };
    scored: boolean;
    answer: { selectedOption: OptionKey | null; textAnswer: string | null } | null;
  }[],
): Computed {
  const problems: string[] = [];
  const rows: ScoredRow[] = [];
  const sections: SectionScore[] = [];

  if (questions.length !== TOTAL_QUESTIONS) {
    problems.push(`expected ${TOTAL_QUESTIONS} questions, found ${questions.length}`);
  }

  let totalHundredths = 0;

  for (const blueprint of SECTION_BLUEPRINT) {
    // A drawn paper records the ordinal, so the snapshot is matched on that.
    const inSection = questions.filter((question) => question.section === blueprint.ordinal);

    if (inSection.length !== blueprint.questionCount) {
      problems.push(
        `section ${blueprint.code} has ${inSection.length} questions, expected ${blueprint.questionCount}`,
      );
    }

    let sectionHundredths = 0;
    let correctCount = 0;
    let answeredCount = 0;

    for (const question of inSection) {
      const selected = question.answer?.selectedOption ?? null;

      // The historical flag, not the live one. An unscored question carries no
      // notion of correctness at all, so isCorrect stays null rather than false
      // — false would claim the candidate got it wrong.
      if (!question.scored) {
        if ((question.answer?.textAnswer ?? "").trim() !== "") {
          answeredCount += 1;
        }

        rows.push({
          attemptQuestionId: question.id,
          isCorrect: null,
          marksAwardedHundredths: 0,
        });
        continue;
      }

      // A value outside a..d cannot have come from the UI. It is treated as no
      // answer at all: worth zero, and never worth marks.
      const valid = selected !== null && VALID_OPTIONS.has(selected);

      if (valid) {
        answeredCount += 1;
      }

      const isCorrect = valid && selected === question.correct;
      const awarded = isCorrect ? toHundredths(question.marks) : 0;

      if (isCorrect) {
        correctCount += 1;
        sectionHundredths += awarded;
      }

      rows.push({
        attemptQuestionId: question.id,
        isCorrect,
        marksAwardedHundredths: awarded,
      });
    }

    const maxHundredths = Math.round(blueprint.questionCount * blueprint.marksPerQuestion * SCALE);

    if (sectionHundredths > maxHundredths) {
      problems.push(
        `section ${blueprint.code} scored ${fromHundredths(sectionHundredths)}, above its maximum of ${fromHundredths(maxHundredths)}`,
      );
    }

    totalHundredths += sectionHundredths;

    sections.push({
      section: blueprint.ordinal,
      code: blueprint.code,
      name: blueprint.name,
      score: fromHundredths(sectionHundredths),
      maxScore: fromHundredths(maxHundredths),
      questionCount: inSection.length,
      correctCount,
      answeredCount,
      unansweredCount: inSection.length - answeredCount,
    });
  }

  // A question outside the blueprint would never be counted into any section,
  // so its absence from the totals has to be caught here rather than ignored.
  const known = new Set(SECTION_BLUEPRINT.map((entry) => entry.ordinal));
  for (const question of questions) {
    if (!known.has(question.section)) {
      problems.push(
        `question ${question.id} is in unknown section ${sectionNameByOrdinal(question.section)}`,
      );
    }
  }

  const maxHundredths = Math.round(TOTAL_MARKS * SCALE);

  if (totalHundredths < 0 || totalHundredths > maxHundredths) {
    problems.push(
      `total ${fromHundredths(totalHundredths)} is outside 0..${fromHundredths(maxHundredths)}`,
    );
  }

  return { rows, sections, totalHundredths, problems };
}

/// Scores one finalized attempt and persists the result.
///
/// Safe to call repeatedly and concurrently. The write runs in a single
/// transaction guarded on the attempt still being finalized, and every value
/// written is derived from the stored paper, so two callers racing produce
/// identical writes rather than a doubled total. The candidate's own answers —
/// `selectedOption` and `textAnswer` — are never touched.
export async function scoreAttempt(attemptId: string): Promise<ScoreResult> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { id: true, status: true, scoredAt: true },
  });

  if (!attempt) {
    return { kind: "not-found" };
  }

  if (attempt.status === "in_progress") {
    return { kind: "not-finalized" };
  }

  const questions = await prisma.attemptQuestion.findMany({
    where: { attemptId },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      section: true,
      correct: true,
      marks: true,
      scored: true,
      answer: { select: { selectedOption: true, textAnswer: true } },
    },
  });

  // A paper drawn under an earlier exam structure is not re-scored. The active
  // blueprint would count a different number of questions and would not
  // recognise the removed section at all, so recomputing would overwrite a
  // real result with a wrong one. The stored score stays exactly as it is and
  // remains readable; only the recomputation is refused.
  if (questions.length !== TOTAL_QUESTIONS) {
    console.warn("Scoring skipped: the stored paper predates the active exam structure.", {
      attemptId,
      expected: TOTAL_QUESTIONS,
      found: questions.length,
    });
    return { kind: "incompatible-blueprint", expected: TOTAL_QUESTIONS, found: questions.length };
  }

  const computed = computeScore(questions);

  if (computed.problems.length > 0) {
    // Deliberately not clamped. A paper that cannot produce a valid score is a
    // data problem for an admin to look at, not a number to round into range.
    console.error("Scoring refused: the stored paper is not a valid exam.", {
      attemptId,
      problems: computed.problems,
    });
    return { kind: "invalid-paper", problems: computed.problems };
  }

  const alreadyScored = attempt.scoredAt !== null;
  const sectionColumn = (section: number) =>
    computed.sections.find((entry) => entry.section === section)?.score ?? "0.00";

  await prisma.$transaction(async (tx) => {
    // Re-read inside the transaction: an attempt cannot leave a terminal state,
    // but this keeps the guard and the write in one atomic unit.
    const current = await tx.attempt.findUnique({
      where: { id: attemptId },
      select: { status: true },
    });

    if (!current || current.status === "in_progress") {
      throw new Error("Attempt stopped being finalized during scoring.");
    }

    // One statement rather than 55 round trips. A per-row upsert loop kept an
    // interactive transaction open long past its 5s timeout once several callers
    // scored at the same time, which is exactly the concurrent case this has to
    // survive. The ON CONFLICT clause updates only the two scoring columns, so a
    // candidate's stored selected_option and text_answer are untouched — an
    // unanswered question simply gets a row with both still null.
    const ids = computed.rows.map((row) => row.attemptQuestionId);
    const correctness = computed.rows.map((row) => row.isCorrect);
    const awarded = computed.rows.map((row) => fromHundredths(row.marksAwardedHundredths));

    await tx.$executeRaw`
      INSERT INTO "answers" ("id", "attempt_id", "attempt_question_id", "is_correct", "marks_awarded", "answered_at", "updated_at")
      SELECT gen_random_uuid(), ${attemptId}, input."attempt_question_id", input."is_correct", input."marks_awarded", now(), now()
        FROM unnest(
               ${ids}::text[],
               ${correctness}::boolean[],
               ${awarded}::numeric[]
             ) AS input("attempt_question_id", "is_correct", "marks_awarded")
      ON CONFLICT ("attempt_question_id") DO UPDATE
         SET "is_correct"    = EXCLUDED."is_correct",
             "marks_awarded" = EXCLUDED."marks_awarded",
             "updated_at"    = now()
    `;

    await tx.attempt.update({
      where: { id: attemptId },
      data: {
        totalScore: fromHundredths(computed.totalHundredths),
        section1Score: sectionColumn(1),
        section2Score: sectionColumn(2),
        section3Score: sectionColumn(3),
        section4Score: sectionColumn(4),
        section5Score: sectionColumn(5),
        section6Score: sectionColumn(6),
        section7Score: sectionColumn(7),
        section8Score: sectionColumn(8),
        scoredAt: new Date(),
      },
    });
  });

  return {
    kind: "scored",
    totalScore: fromHundredths(computed.totalHundredths),
    maxScore: fromHundredths(Math.round(TOTAL_MARKS * SCALE)),
    sections: computed.sections,
    alreadyScored,
  };
}
