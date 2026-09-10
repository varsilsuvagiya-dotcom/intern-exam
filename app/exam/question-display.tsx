"use client";

import type { CandidateQuestion } from "@/lib/exam/candidate-paper";

import { ExamChip } from "@/components/exam/surface";

import { CodeBlock } from "./code-block";
import { FreeTextAnswer } from "./free-text-answer";
import { LessonPanel, type LessonPosition } from "./lesson-panel";

/// One scored question: context, the question itself, and the answer choices.
///
/// The reading measure is the substantive change here. The shell is full width
/// so the palette can sit beside the question, but question text set across
/// 1900px is genuinely hard to read — the eye loses the line on the return
/// sweep. Everything a candidate reads is therefore capped at
/// `--spacing-exam-measure` (68ch), while the shell around it stays wide.
///
/// S7's lesson box and S8's textarea still render from here, unchanged: their
/// own design is Phase 5. Only shared colour and spacing reach them.

/// Marks are per-question exam context, which is normal in a CBT and is
/// already what the paper says. Nothing about correctness or scoring internals
/// appears anywhere in this component.
function marksLabel(marks: string): string {
  return `${marks} ${Number(marks) === 1 ? "mark" : "marks"}`;
}

export function QuestionDisplay({
  question,
  index,
  total,
  answer,
  onAnswer,
  disabled,
  lesson,
}: {
  question: CandidateQuestion;
  index: number;
  total: number;
  answer: string | undefined;
  onAnswer: (value: string) => void;
  disabled: boolean;
  /// Where this question sits in its Section 7 lesson group, or null for every
  /// other section. Derived by the shell, which holds the whole paper.
  lesson: LessonPosition | null;
}) {
  return (
    <article className="max-w-exam-measure">
      {/* A plain div, not a `header`: this is a row of context chips, and a
          second `header` element on the page competes with the exam banner
          for the `banner`-adjacent landmark reading. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Section context: present, but quieter than the question itself. The
            header already carries it too; here it orients the reader inside
            the content column. */}
        <ExamChip>
          Section {question.section} · {question.sectionName}
        </ExamChip>
        {/* Marks are shown for scored sections only. Section 8 is unscored, and
            a "0 marks" chip would tell the candidate their answer does not
            matter — it is read by a person, so it does. */}
        {question.freeText ? (
          <ExamChip>Not scored</ExamChip>
        ) : (
          <ExamChip>{marksLabel(question.marks)}</ExamChip>
        )}
      </div>

      {/* The page's h1 is the examination, in the shell header. */}
      <h2 className="mt-3 text-xl font-semibold tracking-tight text-exam-ink">
        Question {index + 1}
        <span className="font-normal text-exam-muted"> of {total}</span>
      </h2>

      {question.lessonText ? (
        <LessonPanel lessonText={question.lessonText} position={lesson} className="mt-4" />
      ) : null}

      {/* 17px with generous leading. Large enough to read for 75 minutes,
          not so large it reads as a headline. Never truncated or clamped:
          `whitespace-pre-wrap` keeps the author's line breaks. */}
      <p className="mt-4 whitespace-pre-wrap text-[17px] leading-[1.65] text-exam-ink">
        {question.questionText}
      </p>

      {question.codeBlock ? <CodeBlock code={question.codeBlock} /> : null}

      {question.freeText ? (
        <FreeTextAnswer
          questionId={question.id}
          value={answer}
          onAnswer={onAnswer}
          disabled={disabled}
        />
      ) : (
        <fieldset className="mt-6 min-w-0">
          <legend className="text-sm font-medium text-exam-ink">Choose one answer</legend>

          <div className="mt-3 flex flex-col gap-2">
            {question.options.map((option) => {
              const selected = answer === option.key;

              return (
                <label
                  key={option.key}
                  className={[
                    "group flex min-h-11 cursor-pointer items-start gap-3 rounded-exam-md border p-3",
                    "transition-colors duration-[120ms] ease-out",
                    // Selection is carried by the border weight and the letter
                    // badge as well as the tint, so it never depends on colour.
                    selected
                      ? "border-exam-primary bg-exam-primary-subtle"
                      : "border-exam-line-strong bg-exam-surface hover:border-exam-muted hover:bg-exam-subtle",
                    disabled ? "cursor-not-allowed opacity-60" : "",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option.key}
                    checked={selected}
                    onChange={() => onAnswer(option.key)}
                    disabled={disabled}
                    className="mt-0.5 size-4 shrink-0 accent-exam-primary"
                  />

                  {/* The letter is a fixed-width badge so multi-line option
                      text aligns against a straight edge rather than reflowing
                      around the label. */}
                  <span
                    className={[
                      "flex size-5 shrink-0 items-center justify-center rounded-exam-sm text-xs font-semibold",
                      selected
                        ? "bg-exam-primary text-white"
                        : "bg-exam-inset text-exam-ink-secondary",
                    ].join(" ")}
                  >
                    {/* Not `aria-hidden`: the letter is part of how a
                        candidate refers to an option ("I picked C"), and the
                        radio's accessible name comes from this label. The
                        full stop keeps it from running into the option text
                        when read aloud. */}
                    {option.label}
                  </span>
                  <span className="sr-only">.</span>

                  {/* `min-w-0` lets a long unbroken option wrap instead of
                      pushing the row wider than the column. */}
                  <span className="min-w-0 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-exam-ink">
                    {option.text}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </article>
  );
}
