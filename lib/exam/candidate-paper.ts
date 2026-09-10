import "server-only";

import { prisma } from "@/lib/db";
import { sectionBlueprintByOrdinal } from "@/lib/exam-settings/exam-blueprint";
import type { OptionKey } from "@/lib/generated/prisma/enums";

/// What the candidate's browser is allowed to see.
///
/// `correct`, `explanation` and `verifyCode` are deliberately absent: they
/// exist on the question or its snapshot but must never reach the client, so
/// the mapping below names every field explicitly rather than spreading the
/// database row. Anything added to the snapshot in future is therefore withheld
/// by default rather than exposed by accident.
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
  /// Which lesson this question belongs to, as a 1-based index within this
  /// paper, and null outside Learn-and-Apply.
  ///
  /// Deliberately NOT the real `lessonGroup` identifier. That value is internal
  /// authoring data and must not reach a candidate, so it is replaced here by
  /// an opaque position that carries exactly what the lesson panel needs to say
  /// "Lesson 1 of 2" and nothing more.
  lessonIndex: number | null;
  marks: string;
  /// True only for a question from a section the active blueprint no longer
  /// knows, which is answered in prose. No active paper contains one.
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

  // The real lesson group identifiers, reduced to 1-based positions in the
  // order the candidate meets them. `lessonGroup` is read from the snapshot to
  // build this map and is then discarded: it never becomes part of the payload
  // below, so the value itself does not leave the server.
  const lessonIndexes = new Map<string, number>();
  for (const row of rows) {
    if (row.lessonGroup && !lessonIndexes.has(row.lessonGroup)) {
      lessonIndexes.set(row.lessonGroup, lessonIndexes.size + 1);
    }
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
        const blueprint = sectionBlueprintByOrdinal(row.section);

        return {
          id: row.id,
          displayOrder: row.displayOrder,
          section: row.section,
          sectionName: blueprint?.name ?? `Section ${row.section}`,
          questionText: row.questionText,
          codeBlock: row.codeBlock,
          options: displayedOptions(row),
          lessonText: row.lessonText,
          lessonIndex: row.lessonGroup ? (lessonIndexes.get(row.lessonGroup) ?? null) : null,
          marks: row.marks.toString(),
          // Every active section is answered by choosing an option. The removed
          // Attitude section was the only free-text one, and no active paper can
          // contain it; a historical paper that does still renders its snapshot.
          freeText: blueprint === undefined,
        };
      }),
    },
  };
}
