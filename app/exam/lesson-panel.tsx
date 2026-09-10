"use client";

import { BookOpen } from "lucide-react";

import type { CandidateQuestion } from "@/lib/exam/candidate-paper";

/// Where a Section 7 question sits inside its lesson.
///
/// Derived from the paper the server already sent. The server supplies an
/// opaque `lessonIndex` rather than the real lesson group identifier, which is
/// internal authoring data and never leaves the server — everything this panel
/// displays is a position, not an identity. Nothing is persisted and no
/// grouping rule is re-implemented here: paper generation already guarantees
/// two complete groups of three, contiguous in display order.
export type LessonPosition = {
  /// 1-based index of this group within the paper's lesson groups.
  groupNumber: number;
  groupCount: number;
  /// 1-based position of this question inside its own group.
  questionInGroup: number;
  questionsInGroup: number;
};

export function lessonPosition(
  questions: CandidateQuestion[],
  current: CandidateQuestion,
): LessonPosition | null {
  if (current.lessonIndex === null) {
    return null;
  }

  const groups = new Set<number>();
  for (const question of questions) {
    if (question.lessonIndex !== null) {
      groups.add(question.lessonIndex);
    }
  }

  const siblings = questions.filter((q) => q.lessonIndex === current.lessonIndex);
  const indexInGroup = siblings.findIndex((q) => q.id === current.id);

  if (indexInGroup === -1) {
    return null;
  }

  return {
    // The server already numbered the lessons in the order they appear.
    groupNumber: current.lessonIndex,
    groupCount: groups.size,
    questionInGroup: indexInGroup + 1,
    questionsInGroup: siblings.length,
  };
}

/// The Section 7 lesson.
///
/// Section 7 asks the candidate to read something and then apply it, so the
/// lesson is presented as material to study rather than as part of the
/// question: its own surface, its own heading, and an explicit statement of
/// how many questions it covers. It repeats above each of its three questions
/// because each question carries its own snapshot — the candidate may arrive
/// at any of them directly from the palette, and would otherwise face a
/// question about material they cannot see.
export function LessonPanel({
  lessonText,
  position,
  className = "",
}: {
  lessonText: string;
  position: LessonPosition | null;
  className?: string;
}) {
  const heading = position
    ? `Lesson ${position.groupNumber} of ${position.groupCount}`
    : "Lesson";

  return (
    <section
      aria-labelledby="exam-lesson-heading"
      className={[
        // A left rule rather than a full card: it reads as quoted study
        // material sitting alongside the question, not as a second question.
        "rounded-exam-lg border border-exam-line border-l-[3px] border-l-exam-primary bg-exam-subtle",
        className,
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-exam-line px-4 py-2.5">
        <h3
          id="exam-lesson-heading"
          className="flex items-center gap-2 text-sm font-semibold text-exam-ink"
        >
          <BookOpen aria-hidden="true" className="size-4 text-exam-primary" />
          {heading}
        </h3>

        {position ? (
          <p className="text-[13px] text-exam-muted">
            Read this, then answer question {position.questionInGroup} of{" "}
            {position.questionsInGroup} below
          </p>
        ) : null}
      </div>

      {/* Plain text rendering; the snapshot is never treated as markup.
          `whitespace-pre-wrap` keeps the author's paragraphs, and the reading
          size matches the question so switching between them is not a jolt. */}
      <div className="px-4 py-3.5">
        <p className="whitespace-pre-wrap text-[15px] leading-[1.7] text-exam-ink">
          {lessonText}
        </p>
      </div>
    </section>
  );
}
