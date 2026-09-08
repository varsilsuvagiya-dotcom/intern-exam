"use client";

import { useState } from "react";

import type { CandidatePaper } from "@/lib/exam/candidate-paper";

import { QuestionDisplay } from "./question-display";
import { QuestionGrid } from "./question-grid";

export function ExamShell({ paper }: { paper: CandidatePaper }) {
  const [current, setCurrent] = useState(0);
  // Keyed by AttemptQuestion id rather than array position, so Phase 10 can
  // persist these without remapping.
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [visited, setVisited] = useState<Record<string, boolean>>(
    () => (paper.questions[0] ? { [paper.questions[0].id]: true } : {}),
  );

  const question = paper.questions[current];
  const total = paper.questions.length;

  const goTo = (index: number) => {
    const target = paper.questions[index];
    if (!target) return;
    setCurrent(index);
    setVisited((previous) => ({ ...previous, [target.id]: true }));
  };

  const answer = (value: string) => {
    setAnswers((previous) => {
      const next = { ...previous };
      if (value === "") {
        delete next[question.id];
      } else {
        next[question.id] = value;
      }
      return next;
    });
  };

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-black/10 dark:border-white/15">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3">
          <span className="font-semibold">{paper.examName}</span>
          <span className="text-sm text-black/70 dark:text-white/70">{paper.candidateName}</span>
          <span className="text-sm text-black/70 dark:text-white/70">
            Section {question.section} — {question.sectionName}
          </span>

          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm text-black/60 dark:text-white/60">
              Time remaining: <span className="font-medium">{paper.durationMinutes}:00</span>
            </span>
            <button
              type="button"
              disabled
              title="Submitting is not available yet."
              className="rounded-md border border-black/15 px-4 py-1.5 text-sm opacity-50 dark:border-white/20"
            >
              Submit exam
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-6 py-8">
        <main className="min-w-0 flex-1">
          <QuestionDisplay
            question={question}
            index={current}
            total={total}
            answer={answers[question.id]}
            onAnswer={answer}
          />

          <nav className="mt-8 flex items-center justify-between border-t border-black/10 pt-4 dark:border-white/15">
            <button
              type="button"
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              className="rounded-md border border-black/15 px-4 py-2 text-sm disabled:opacity-40 dark:border-white/20"
            >
              ← Previous
            </button>
            <span className="text-sm text-black/50 dark:text-white/50">
              {answeredCount} of {total} answered
            </span>
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              disabled={current === total - 1}
              className="rounded-md border border-black/15 px-4 py-2 text-sm disabled:opacity-40 dark:border-white/20"
            >
              Next →
            </button>
          </nav>
        </main>

        <QuestionGrid
          questions={paper.questions}
          current={current}
          answers={answers}
          visited={visited}
          onJump={goTo}
        />
      </div>
    </div>
  );
}
