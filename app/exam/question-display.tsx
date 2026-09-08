"use client";

import type { CandidateQuestion } from "@/lib/exam/candidate-paper";

export function QuestionDisplay({
  question,
  index,
  total,
  answer,
  onAnswer,
}: {
  question: CandidateQuestion;
  index: number;
  total: number;
  answer: string | undefined;
  onAnswer: (value: string) => void;
}) {
  return (
    <article>
      <div className="flex items-baseline gap-3">
        <h1 className="text-lg font-semibold">
          Question {index + 1}
          <span className="font-normal text-black/50 dark:text-white/50"> of {total}</span>
        </h1>
        <span className="text-sm text-black/50 dark:text-white/50">
          {question.marks} {Number(question.marks) === 1 ? "mark" : "marks"}
        </span>
      </div>

      {question.lessonText ? (
        <section
          aria-label="Lesson"
          className="mt-4 rounded-lg border border-black/15 bg-black/[0.03] p-4 dark:border-white/20 dark:bg-white/[0.06]"
        >
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/60 dark:text-white/60">
            Learn
          </h2>
          {/* Plain text rendering; the snapshot is never treated as markup. */}
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{question.lessonText}</p>
        </section>
      ) : null}

      <p className="mt-5 whitespace-pre-wrap text-base leading-relaxed">{question.questionText}</p>

      {question.codeBlock ? (
        <pre className="mt-4 overflow-x-auto rounded-lg border border-black/10 bg-black/[0.04] p-4 font-mono text-sm leading-relaxed dark:border-white/15 dark:bg-white/[0.06]">
          <code>{question.codeBlock}</code>
        </pre>
      ) : null}

      {question.freeText ? (
        <div className="mt-6">
          <label htmlFor="free-text-answer" className="block text-sm font-medium">
            Your answer
            <span className="ml-2 font-normal text-black/50 dark:text-white/50">
              There is no right or wrong answer here.
            </span>
          </label>
          <textarea
            id="free-text-answer"
            // Remounts per question so the textarea shows this question's answer.
            key={question.id}
            defaultValue={answer ?? ""}
            onChange={(event) => onAnswer(event.target.value.trim())}
            rows={6}
            className="mt-2 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
          />
        </div>
      ) : (
        <fieldset className="mt-6">
          <legend className="sr-only">Choose one answer</legend>
          <div className="space-y-2">
            {question.options.map((option) => {
              const selected = answer === option.key;

              return (
                <label
                  key={option.key}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
                    selected
                      ? "border-black bg-black/[0.04] dark:border-white dark:bg-white/[0.08]"
                      : "border-black/15 dark:border-white/20"
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option.key}
                    checked={selected}
                    onChange={() => onAnswer(option.key)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">{option.label}.</span>{" "}
                    <span className="whitespace-pre-wrap">{option.text}</span>
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
