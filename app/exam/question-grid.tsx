"use client";

import type { CandidateQuestion } from "@/lib/exam/candidate-paper";

type State = "answered" | "visited" | "unvisited";

/// Each state carries a shape or weight difference as well as a colour, so the
/// grid stays readable without relying on colour perception.
const STATE_STYLE: Record<State, string> = {
  answered: "border-blue-600 bg-blue-600 font-semibold text-white dark:border-blue-400 dark:bg-blue-500",
  visited: "border-black/40 bg-transparent dark:border-white/50",
  unvisited: "border-black/10 bg-black/[0.06] text-black/50 dark:border-white/10 dark:bg-white/[0.08] dark:text-white/50",
};

const STATE_LABEL: Record<State, string> = {
  answered: "answered",
  visited: "visited, not answered",
  unvisited: "not visited",
};

export function QuestionGrid({
  questions,
  current,
  answers,
  visited,
  onJump,
}: {
  questions: CandidateQuestion[];
  current: number;
  answers: Record<string, string>;
  visited: Record<string, boolean>;
  onJump: (index: number) => void;
}) {
  const stateOf = (question: CandidateQuestion): State => {
    if (answers[question.id] !== undefined) return "answered";
    return visited[question.id] ? "visited" : "unvisited";
  };

  return (
    <aside className="w-64 shrink-0">
      <h2 className="text-sm font-semibold">Questions</h2>

      <ol className="mt-3 grid grid-cols-5 gap-1.5">
        {questions.map((question, index) => {
          const state = stateOf(question);
          const isCurrent = index === current;

          return (
            <li key={question.id}>
              <button
                type="button"
                onClick={() => onJump(index)}
                aria-current={isCurrent ? "true" : undefined}
                aria-label={`Question ${index + 1}, ${STATE_LABEL[state]}`}
                className={`h-9 w-full rounded border text-sm ${STATE_STYLE[state]} ${
                  isCurrent ? "ring-2 ring-black ring-offset-1 dark:ring-white dark:ring-offset-black" : ""
                }`}
              >
                {index + 1}
              </button>
            </li>
          );
        })}
      </ol>

      <dl className="mt-4 space-y-1.5 text-xs text-black/60 dark:text-white/60">
        {(["answered", "visited", "unvisited"] as State[]).map((state) => (
          <div key={state} className="flex items-center gap-2">
            <span className={`inline-block h-4 w-4 rounded border ${STATE_STYLE[state]}`} />
            <dd>{STATE_LABEL[state]}</dd>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded border border-black/40 ring-2 ring-black ring-offset-1 dark:border-white/50 dark:ring-white dark:ring-offset-black" />
          <dd>current question</dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-black/50 dark:text-white/50">
        Answers are not saved yet in this build.
      </p>
    </aside>
  );
}
