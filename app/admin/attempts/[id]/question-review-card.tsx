import { CheckCircle2, CircleSlash, MinusCircle, XCircle } from "lucide-react";

import { Badge, Chip, type StatusTone } from "@/components/ui/badge";
import type { ReviewQuestion, ReviewState } from "@/lib/admin/attempt-result";

/// One question, as the candidate sat it.
///
/// Everything rendered here comes from the `ReviewQuestion` the server built
/// out of the attempt snapshot. Nothing is recomputed, reordered or fetched
/// from the live question bank.

const STATE: Record<ReviewState, { label: string; tone: StatusTone; icon: typeof CheckCircle2 }> = {
  correct: { label: "Correct", tone: "success", icon: CheckCircle2 },
  wrong: { label: "Wrong", tone: "danger", icon: XCircle },
  unanswered: { label: "Unanswered", tone: "warning", icon: MinusCircle },
  unscored: { label: "Not scored", tone: "neutral", icon: CircleSlash },
};

/// `Q01`, so numbers align in a vertical scan of 55 cards.
function questionNumber(displayOrder: number): string {
  return `Q${String(displayOrder).padStart(2, "0")}`;
}

function DefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-1 py-2 max-sm:grid-cols-1 sm:grid-cols-[9.5rem_minmax(0,1fr)]">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

/// The candidate's paper, in the stored shuffled order.
///
/// Tint carries no meaning on its own: every marked option also states in words
/// what it is, so the list reads identically without color.
function OptionList({ question }: { question: ReviewQuestion }) {
  return (
    <ul className="mt-3 space-y-1.5">
      {question.options.map((option) => {
        const wrongChoice = option.isSelected && !option.isCorrect;

        return (
          <li
            key={option.key}
            className={[
              // The label sits beside the option text when there is room and
              // drops beneath it when there is not. Kept as a flex row with a
              // wrapping label rather than `shrink-0`, which squeezed the
              // option text to one word per line at 375px.
              "flex flex-wrap gap-x-2.5 gap-y-1 rounded-md border px-3 py-2 text-sm",
              option.isCorrect
                ? "border-success/30 bg-success-bg"
                : wrongChoice
                  ? "border-danger/30 bg-danger-bg"
                  : "border-line bg-surface",
            ].join(" ")}
          >
            <span className="font-medium text-ink-secondary tabular">{option.label}</span>
            <span className="min-w-0 flex-1 basis-[12rem] wrap-anywhere whitespace-pre-wrap text-ink">
              {option.text}
            </span>
            {/* Words, not just tint. A correct option the candidate also chose
                says both things rather than dropping one of them. */}
            {option.isCorrect || option.isSelected ? (
              <span
                className={[
                  "ml-auto self-center text-xs font-medium",
                  option.isCorrect ? "text-success" : "text-danger",
                ].join(" ")}
              >
                {option.isCorrect && option.isSelected
                  ? "Correct answer · Candidate answer"
                  : option.isCorrect
                    ? "Correct answer"
                    : "Candidate answer"}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function QuestionReviewCard({ question }: { question: ReviewQuestion }) {
  const state = STATE[question.state];
  const Icon = state.icon;

  return (
    <article
      id={`q-${question.displayOrder}`}
      aria-labelledby={`q-${question.displayOrder}-heading`}
      className="rounded-lg border border-line bg-surface p-4 lg:p-5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h4
          id={`q-${question.displayOrder}-heading`}
          className="text-sm font-semibold text-ink tabular"
        >
          {questionNumber(question.displayOrder)}
        </h4>
        <Chip>Section {question.section}</Chip>
        <Badge tone={state.tone}>
          <Icon aria-hidden="true" className="mr-1 size-3.5" />
          {state.label}
        </Badge>

        {/* Section 8 has no marks to award, so no marks are shown for it — an
            unscored question is not a question worth 0. */}
        {question.scored ? (
          <span className="ml-auto text-sm whitespace-nowrap tabular">
            <span className="font-semibold text-ink">{question.marksAwarded}</span>
            <span className="text-muted"> / {question.maxMarks}</span>
            <span className="sr-only"> marks awarded</span>
          </span>
        ) : null}
      </div>

      <p className="mt-3 wrap-anywhere whitespace-pre-wrap text-sm leading-6 text-ink">
        {question.questionText}
      </p>

      {/* Wide code scrolls inside its own box. The page never scrolls for it. */}
      {question.codeBlock ? (
        <pre className="mt-3 max-w-full overflow-x-auto rounded-md border border-line bg-inset p-3 text-xs leading-5">
          <code className="font-mono text-ink">{question.codeBlock}</code>
        </pre>
      ) : null}

      {question.scored ? (
        <>
          <OptionList question={question} />

          <dl className="mt-3 divide-y divide-line border-t border-line">
            {/* When the candidate was right the option row above already says
                so, in words, on the one row that matters. Repeating it as two
                identical definition rows is noise on a 55-question page, so
                only the disagreement is spelled out. */}
            {question.state === "correct" ? null : (
              <>
                <DefRow label="Candidate answer">
                  {question.selectedLabel === null ? (
                    <span className="text-muted">Not answered</span>
                  ) : (
                    <span className="tabular">{question.selectedLabel}</span>
                  )}
                </DefRow>
                <DefRow label="Correct answer">
                  <span className="tabular">{question.correctLabel}</span>
                  <span className="text-ink-secondary"> — {question.correctText}</span>
                </DefRow>
              </>
            )}
            {/* Secondary by typography, not by truncation: an explanation is
                read in full when it is read at all. */}
            <DefRow label="Explanation">
              {question.explanation === null ? (
                <span className="text-muted">No explanation provided.</span>
              ) : (
                <span className="wrap-anywhere whitespace-pre-wrap text-[13px] leading-5 text-ink-secondary">
                  {question.explanation}
                </span>
              )}
            </DefRow>
          </dl>
        </>
      ) : (
        // Section 8: prose, never compared to anything. No options, no correct
        // answer, no correctness. The "Not scored" badge above carries the
        // state; the section heading explains what it means once, rather than
        // repeating the same sentence on all five cards.
        <dl className="mt-3 border-t border-line">
          <DefRow label="Candidate response">
            {question.textAnswer === null ? (
              <span className="text-muted">Not answered</span>
            ) : (
              <div className="rounded-md border border-line bg-subtle p-3 text-sm leading-6 wrap-anywhere whitespace-pre-wrap text-ink">
                {question.textAnswer}
              </div>
            )}
          </DefRow>

        </dl>
      )}
    </article>
  );
}
