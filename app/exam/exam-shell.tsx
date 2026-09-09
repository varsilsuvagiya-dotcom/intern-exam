"use client";

import { useCallback, useEffect, useState } from "react";

import type { CandidatePaper } from "@/lib/exam/candidate-paper";
import type { TimingState } from "@/lib/exam/exam-timer";

import { CompletionScreen } from "./completion-screen";
import { ExamTimerDisplay } from "./exam-timer-display";
import { QuestionDisplay } from "./question-display";
import { QuestionGrid } from "./question-grid";
import { SubmitDialog } from "./submit-dialog";
import { useAutosave, type SaveStatus } from "./use-autosave";
import { submitExam } from "./actions";
import type { TerminalStatus } from "@/lib/exam/finalize-attempt";

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  failed: "Not saved — retrying when you change it again",
  expired: "Time is up",
};

export function ExamShell({
  paper,
  initialAnswers,
  initialTiming,
}: {
  paper: CandidatePaper;
  initialAnswers: Record<string, string>;
  initialTiming: TimingState;
}) {
  const [current, setCurrent] = useState(0);
  // Restored from the server on load, then kept in step as answers are saved.
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [expired, setExpired] = useState(initialTiming.expired);
  const [visited, setVisited] = useState<Record<string, boolean>>(() => {
    // Anything already answered has necessarily been visited.
    const seen: Record<string, boolean> = {};
    for (const id of Object.keys(initialAnswers)) seen[id] = true;
    if (paper.questions[0]) seen[paper.questions[0].id] = true;
    return seen;
  });

  const [finalStatus, setFinalStatus] = useState<TerminalStatus | null>(null);

  const handleExpired = useCallback(() => setExpired(true), []);

  // Driven by the expired flag rather than from inside the timer callback, so
  // the request survives the re-render that flag causes. The server still
  // checks its own clock before finalizing; this only asks.
  useEffect(() => {
    if (!expired || finalStatus) {
      return;
    }

    let cancelled = false;

    // The client can reach zero a moment before the server agrees, and that
    // request is correctly refused. Keep asking until the server accepts, so a
    // near-miss cannot leave the attempt open indefinitely.
    const ask = async () => {
      while (!cancelled) {
        const result = await submitExam("automatic");

        if (cancelled) return;

        if (result.kind === "finalized") {
          setFinalStatus(result.status);
          return;
        }

        if (result.kind === "not-found") {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    };

    void ask();

    return () => {
      cancelled = true;
    };
  }, [expired, finalStatus]);

  const { status, save, flush } = useAutosave(handleExpired);

  const question = paper.questions[current];
  const total = paper.questions.length;

  const goTo = (index: number) => {
    const target = paper.questions[index];
    if (!target) return;
    setCurrent(index);
    setVisited((previous) => ({ ...previous, [target.id]: true }));
  };

  const answer = (value: string) => {
    if (expired) return;

    setAnswers((previous) => {
      const next = { ...previous };
      if (value === "") {
        delete next[question.id];
      } else {
        next[question.id] = value;
      }
      return next;
    });

    save(
      question.id,
      question.freeText ? { textAnswer: value } : { selectedOption: value === "" ? null : value },
      question.freeText,
    );
  };

  const answeredCount = Object.keys(answers).length;

  if (finalStatus) {
    return <CompletionScreen status={finalStatus} />;
  }

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
            <span
              className={`text-sm ${status === "failed" ? "text-red-600 dark:text-red-400" : "text-black/50 dark:text-white/50"}`}
              role="status"
            >
              {SAVE_LABEL[status]}
            </span>
            <ExamTimerDisplay initial={initialTiming} onExpire={handleExpired} />
            <SubmitDialog
              disabled={expired}
              flushPending={flush}
              onFinalized={setFinalStatus}
            />
          </div>
        </div>
      </header>

      {expired ? (
        <div
          role="alert"
          className="border-b border-red-600/30 bg-red-600/10 px-6 py-3 text-center text-sm font-medium text-red-700 dark:text-red-300"
        >
          Your time is up. Answers already saved have been kept — please wait for your supervisor.
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-6 py-8">
        <main className="min-w-0 flex-1">
          <QuestionDisplay
            question={question}
            index={current}
            total={total}
            answer={answers[question.id]}
            onAnswer={answer}
            disabled={expired}
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
