import "server-only";

import { prisma } from "@/lib/db";
import { SECTION_BLUEPRINT, TOTAL_MARKS, sectionBlueprint } from "@/lib/exam-settings/exam-blueprint";
import type { AttemptStatus, OptionKey } from "@/lib/generated/prisma/enums";

import { STATUS_LABELS } from "./query-attempts";

/// The admin view of one attempt.
///
/// Three rules shape everything here:
///
///  1. **Snapshots are authoritative.** Question text, options, correct answer,
///     explanation, marks, section and lesson all come from `AttemptQuestion`.
///     The live `Question` table is never read, so editing or deactivating a
///     question in the bank cannot alter a result that has already been sat.
///  2. **Nothing is recomputed.** Scores come from the columns Phase 12 wrote,
///     and correctness from `Answer.isCorrect`. This page never calls the
///     scoring engine and never writes.
///  3. **An active exam keeps its answer key.** For an in-progress attempt the
///     review is not built at all, so there is no path by which opening this
///     page during a supervised sitting could reveal correct answers.

const OPTION_LABEL: Record<OptionKey, string> = { a: "A", b: "B", c: "C", d: "D" };

export const MAX_TOTAL = TOTAL_MARKS.toFixed(2);

/// Decimal values arrive as Prisma Decimal. Formatting through `toFixed(2)` on
/// the decimal's own string keeps 1.5 as "1.50" and never produces artefacts
/// like 11.999999999999998.
function money(value: { toString(): string } | null): string {
  return value === null ? "0.00" : Number(value.toString()).toFixed(2);
}

export type ReviewState = "correct" | "wrong" | "unanswered" | "unscored";

export type ReviewOption = {
  key: OptionKey;
  /// Original option letter, so an admin can tie it back to the question bank.
  label: string;
  text: string;
  isCorrect: boolean;
  isSelected: boolean;
};

export type ReviewQuestion = {
  id: string;
  displayOrder: number;
  section: number;
  questionText: string;
  codeBlock: string | null;
  /// In the order this candidate actually saw them.
  options: ReviewOption[];
  lessonText: string | null;
  lessonGroup: string | null;
  explanation: string | null;
  state: ReviewState;
  /// Null when the question was not answered.
  selectedKey: OptionKey | null;
  selectedLabel: string | null;
  correctKey: OptionKey | null;
  correctLabel: string | null;
  correctText: string | null;
  /// Section 8 only; stored exactly as the candidate typed it.
  textAnswer: string | null;
  scored: boolean;
  marksAwarded: string;
  maxMarks: string;
};

/// A run of questions rendered together. Section 7 produces one group per
/// lesson so the lesson text stays attached to its three questions; every other
/// section produces a single group with no lesson.
export type ReviewGroup = {
  key: string;
  lessonText: string | null;
  lessonLabel: string | null;
  questions: ReviewQuestion[];
};

export type ReviewSection = {
  section: number;
  name: string;
  scored: boolean;
  score: string;
  maxScore: string;
  groups: ReviewGroup[];
  questionCount: number;
};

export type SectionScoreRow = {
  section: number;
  name: string;
  score: string;
  maxScore: string;
};

export type AttemptSummary = {
  id: string;
  status: AttemptStatus;
  statusLabel: string;
  startedAt: Date;
  submittedAt: Date | null;
  scoredAt: Date | null;
  durationMinutes: number;
  candidateName: string;
  candidateEmail: string;
  candidateMobile: string;
  enteredName: string | null;
  enteredEmail: string | null;
  /// True when what the candidate typed at the start differs from the record
  /// synchronized from the Google Form.
  nameMismatch: boolean;
  emailMismatch: boolean;
};

export type AttemptResult =
  | { kind: "not-found" }
  /// Still running. Metadata only: no score, no answer key, no review.
  | { kind: "in-progress"; summary: AttemptSummary }
  /// Finalized, but Phase 12 scoring has not stored a result yet.
  | { kind: "scoring-pending"; summary: AttemptSummary }
  | {
      kind: "scored";
      summary: AttemptSummary;
      totalScore: string;
      maxScore: string;
      sectionScores: SectionScoreRow[];
      sections: ReviewSection[];
      questionCount: number;
    };

function summarize(
  attempt: {
    id: string;
    status: AttemptStatus;
    startedAt: Date;
    submittedAt: Date | null;
    scoredAt: Date | null;
    enteredName: string | null;
    enteredEmail: string | null;
    candidate: { name: string; email: string; mobile: string };
  },
  durationMinutes: number,
): AttemptSummary {
  return {
    id: attempt.id,
    status: attempt.status,
    statusLabel: STATUS_LABELS[attempt.status],
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    scoredAt: attempt.scoredAt,
    durationMinutes,
    candidateName: attempt.candidate.name,
    candidateEmail: attempt.candidate.email,
    candidateMobile: attempt.candidate.mobile,
    enteredName: attempt.enteredName,
    enteredEmail: attempt.enteredEmail,
    nameMismatch:
      attempt.enteredName !== null &&
      attempt.enteredName.trim().toLowerCase() !== attempt.candidate.name.trim().toLowerCase(),
    emailMismatch:
      attempt.enteredEmail !== null &&
      attempt.enteredEmail.trim().toLowerCase() !== attempt.candidate.email.trim().toLowerCase(),
  };
}

type SnapshotRow = {
  id: string;
  displayOrder: number;
  section: number;
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
  marks: { toString(): string };
  scored: boolean;
  shuffledOptionOrder: OptionKey[];
  answer: {
    selectedOption: OptionKey | null;
    textAnswer: string | null;
    isCorrect: boolean | null;
    marksAwarded: { toString(): string } | null;
  } | null;
};

function toReviewQuestion(row: SnapshotRow): ReviewQuestion {
  const byKey: Record<OptionKey, string> = {
    a: row.optionA,
    b: row.optionB,
    c: row.optionC,
    d: row.optionD,
  };

  const selectedKey = row.answer?.selectedOption ?? null;

  // Rendered in the stored permutation, so the admin sees the paper exactly as
  // the candidate did. The correct answer is still identified by its original
  // key, which is what the snapshot records.
  const options: ReviewOption[] = row.shuffledOptionOrder.map((key) => ({
    key,
    label: OPTION_LABEL[key],
    text: byKey[key],
    isCorrect: row.scored && key === row.correct,
    isSelected: key === selectedKey,
  }));

  // Section 8 has no notion of correctness, so it is never labelled right or
  // wrong. Everything else distinguishes an unanswered question from a wrong
  // one: both score zero, but they are not the same event.
  let state: ReviewState;
  if (!row.scored) {
    state = "unscored";
  } else if (selectedKey === null) {
    state = "unanswered";
  } else {
    state = row.answer?.isCorrect === true ? "correct" : "wrong";
  }

  return {
    id: row.id,
    displayOrder: row.displayOrder,
    section: row.section,
    questionText: row.questionText,
    codeBlock: row.codeBlock,
    options,
    lessonText: row.lessonText,
    lessonGroup: row.lessonGroup,
    explanation: row.explanation,
    state,
    selectedKey,
    selectedLabel: selectedKey ? OPTION_LABEL[selectedKey] : null,
    correctKey: row.scored ? row.correct : null,
    correctLabel: row.scored ? OPTION_LABEL[row.correct] : null,
    correctText: row.scored ? byKey[row.correct] : null,
    // Preserved byte for byte: never trimmed, normalized or rewritten.
    textAnswer: row.answer?.textAnswer ?? null,
    scored: row.scored,
    // A missing Answer row is a legitimate state for a question the candidate
    // never reached, so it reads as zero rather than crashing.
    marksAwarded: money(row.answer?.marksAwarded ?? null),
    maxMarks: money(row.marks),
  };
}

/// Splits a section into render groups. Section 7 is grouped by `lessonGroup`
/// so its lesson text is shown once above the three questions that share it;
/// group order and question order both follow `displayOrder`.
function groupQuestions(section: number, questions: ReviewQuestion[]): ReviewGroup[] {
  const hasLessons = questions.some((question) => question.lessonGroup !== null);

  if (!hasLessons) {
    return [{ key: `section-${section}`, lessonText: null, lessonLabel: null, questions }];
  }

  const groups: ReviewGroup[] = [];

  for (const question of questions) {
    const key = question.lessonGroup ?? `${section}-ungrouped`;
    const existing = groups.find((group) => group.key === key);

    if (existing) {
      existing.questions.push(question);
      continue;
    }

    groups.push({
      key,
      lessonText: question.lessonText,
      lessonLabel: `Lesson group ${groups.length + 1}`,
      questions: [question],
    });
  }

  return groups;
}

/// Loads everything the result page renders.
///
/// Two reads in total — the attempt with its candidate, and the snapshot rows
/// with their answers joined — regardless of how many questions the paper holds.
/// The question bank is not queried at all.
export async function getAttemptResult(attemptId: string): Promise<AttemptResult> {
  // A malformed id simply matches nothing; Prisma parameterises it, so there is
  // no value that reaches the database as anything but a string comparison.
  if (typeof attemptId !== "string" || attemptId === "" || attemptId.length > 100) {
    return { kind: "not-found" };
  }

  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      scoredAt: true,
      totalScore: true,
      section1Score: true,
      section2Score: true,
      section3Score: true,
      section4Score: true,
      section5Score: true,
      section6Score: true,
      section7Score: true,
      section8Score: true,
      enteredName: true,
      enteredEmail: true,
      // Password hashes and sessions are never selected anywhere here.
      candidate: { select: { name: true, email: true, mobile: true } },
    },
  });

  if (!attempt) {
    return { kind: "not-found" };
  }

  const settings = await prisma.examSetting.findUniqueOrThrow({
    where: { id: "singleton" },
    select: { durationMinutes: true },
  });

  const summary = summarize(attempt, settings.durationMinutes);

  // An active exam is monitored, not reviewed. Returning before any snapshot is
  // loaded means the answer key cannot reach the page even by accident.
  if (attempt.status === "in_progress") {
    return { kind: "in-progress", summary };
  }

  if (attempt.scoredAt === null || attempt.totalScore === null) {
    return { kind: "scoring-pending", summary };
  }

  const rows = await prisma.attemptQuestion.findMany({
    where: { attemptId },
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      displayOrder: true,
      section: true,
      questionText: true,
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
      shuffledOptionOrder: true,
      // Joined in the same statement: one query for all 55 answers, not 55.
      answer: {
        select: { selectedOption: true, textAnswer: true, isCorrect: true, marksAwarded: true },
      },
    },
  });

  const persistedSectionScore: Record<number, { toString(): string } | null> = {
    1: attempt.section1Score,
    2: attempt.section2Score,
    3: attempt.section3Score,
    4: attempt.section4Score,
    5: attempt.section5Score,
    6: attempt.section6Score,
    7: attempt.section7Score,
    8: attempt.section8Score,
  };

  const reviewed = rows.map(toReviewQuestion);

  const sections: ReviewSection[] = [];
  const sectionScores: SectionScoreRow[] = [];

  for (const blueprint of SECTION_BLUEPRINT) {
    const inSection = reviewed.filter((question) => question.section === blueprint.section);
    const maxScore = (blueprint.questionCount * blueprint.marksPerQuestion).toFixed(2);
    // The persisted column is authoritative for what was achieved; the
    // blueprint only supplies the label and the maximum.
    const score = money(persistedSectionScore[blueprint.section] ?? null);

    sectionScores.push({ section: blueprint.section, name: blueprint.name, score, maxScore });

    if (inSection.length === 0) {
      continue;
    }

    sections.push({
      section: blueprint.section,
      name: blueprint.name,
      scored: blueprint.scored,
      score,
      maxScore,
      groups: groupQuestions(blueprint.section, inSection),
      questionCount: inSection.length,
    });
  }

  // A paper holding a section the blueprint does not know would otherwise be
  // silently dropped from the review.
  const known = new Set(SECTION_BLUEPRINT.map((entry) => entry.section));
  const unknown = reviewed.filter((question) => !known.has(question.section));

  if (unknown.length > 0) {
    sections.push({
      section: 0,
      name: "Unrecognised section",
      scored: false,
      score: "0.00",
      maxScore: "0.00",
      groups: groupQuestions(0, unknown),
      questionCount: unknown.length,
    });
  }

  return {
    kind: "scored",
    summary,
    totalScore: money(attempt.totalScore),
    maxScore: MAX_TOTAL,
    sectionScores,
    sections,
    questionCount: reviewed.length,
  };
}

export { sectionBlueprint };
