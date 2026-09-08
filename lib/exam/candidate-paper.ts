import "server-only";

import { prisma } from "@/lib/db";
import { sectionBlueprint } from "@/lib/exam-settings/exam-blueprint";
import type { OptionKey } from "@/lib/generated/prisma/enums";

/// What the candidate's browser is allowed to see.
///
/// `correct` and `explanation` are deliberately absent: they exist on the
/// snapshot row but must never reach the client, so the mapping below names
/// every field explicitly rather than spreading the database row.
export type CandidateOption = { key: OptionKey; label: string; text: string };

export type CandidateQuestion = {
  id: string;
  displayOrder: number;
  section: number;
  sectionName: string;
  questionText: string;
  codeBlock: string | null;
  /// Already in the order this candidate should see them.
  options: CandidateOption[];
  lessonText: string | null;
  lessonGroup: string | null;
  marks: string;
  /// Section 8 is answered in prose rather than by choosing an option.
  freeText: boolean;
};

export type CandidatePaper = {
  candidateName: string;
  examName: string;
  durationMinutes: number;
  questions: CandidateQuestion[];
};

export type PaperAccess =
  | { kind: "ok"; paper: CandidatePaper }
  | { kind: "not-found" }
  | { kind: "finished" };

const OPTION_LABEL: Record<OptionKey, string> = { a: "A", b: "B", c: "C", d: "D" };

/// Turns a snapshot row and its stored permutation into the option list to
/// render. The order comes entirely from `shuffledOptionOrder`, so nothing is
/// randomized at render time and a refresh shows the same order.
function displayedOptions(row: {
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  shuffledOptionOrder: OptionKey[];
}): CandidateOption[] {
  const byKey: Record<OptionKey, string> = {
    a: row.optionA,
    b: row.optionB,
    c: row.optionC,
    d: row.optionD,
  };

  return row.shuffledOptionOrder.map((key) => ({
    key,
    label: OPTION_LABEL[key],
    text: byKey[key],
  }));
}

/// Loads the paper for the attempt this browser holds a session for.
///
/// The caller passes an attempt id resolved from the session cookie, never from
/// the request, so there is no path by which a candidate reaches another's exam.
export async function getCandidatePaper(attemptId: string): Promise<PaperAccess> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      status: true,
      enteredName: true,
      candidate: { select: { name: true } },
    },
  });

  if (!attempt) {
    return { kind: "not-found" };
  }

  if (attempt.status !== "in_progress") {
    return { kind: "finished" };
  }

  const settings = await prisma.examSetting.findUniqueOrThrow({
    where: { id: "singleton" },
    select: { examName: true, durationMinutes: true },
  });

  // The persisted paper is the source of truth; the question bank is not read.
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
      shuffledOptionOrder: true,
      lessonText: true,
      lessonGroup: true,
      marks: true,
    },
  });

  if (rows.length === 0) {
    return { kind: "not-found" };
  }

  return {
    kind: "ok",
    paper: {
      // The application record is authoritative for identity; the typed name is
      // only a fallback for a candidate whose record predates it.
      candidateName: attempt.candidate.name || attempt.enteredName || "Candidate",
      examName: settings.examName,
      durationMinutes: settings.durationMinutes,
      questions: rows.map((row) => {
        const blueprint = sectionBlueprint(row.section);

        return {
          id: row.id,
          displayOrder: row.displayOrder,
          section: row.section,
          sectionName: blueprint?.name ?? `Section ${row.section}`,
          questionText: row.questionText,
          codeBlock: row.codeBlock,
          options: displayedOptions(row),
          lessonText: row.lessonText,
          lessonGroup: row.lessonGroup,
          marks: row.marks.toString(),
          freeText: blueprint ? !blueprint.scored : false,
        };
      }),
    },
  };
}
