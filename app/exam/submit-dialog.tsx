"use client";

import { useState } from "react";

import type { SubmissionSummary, TerminalStatus } from "@/lib/exam/finalize-attempt";

import { fetchSubmissionSummary, submitExam } from "./actions";

type State =
  | { phase: "closed" }
  | { phase: "loading" }
  | { phase: "ready"; summary: Extract<SubmissionSummary, { kind: "ok" }> }
  | { phase: "submitting" }
  | { phase: "error"; message: string };

export function SubmitDialog({
  disabled,
  flushPending,
  onFinalized,
}: {
  disabled: boolean;
  /// Waits for any debounced save still in flight, so the counts below describe
  /// what is actually stored rather than what the browser hopes is stored.
  flushPending: () => Promise<boolean>;
  onFinalized: (status: TerminalStatus) => void;
}) {
  const [state, setState] = useState<State>({ phase: "closed" });

  const open = async () => {
    setState({ phase: "loading" });

    const flushed = await flushPending();

    if (!flushed) {
      setState({
        phase: "error",
        message: "Some answers could not be saved. Check your last answer, then try again.",
      });
      return;
    }

    const summary = await fetchSubmissionSummary();

    if (summary.kind === "finished") {
      onFinalized(summary.status);
      return;
    }

    if (summary.kind !== "ok") {
      setState({ phase: "error", message: "Your exam could not be checked. Please tell your supervisor." });
      return;
    }

    setState({ phase: "ready", summary });
  };

  const confirm = async () => {
    setState({ phase: "submitting" });
    const result = await submitExam("manual");

    if (result.kind === "finalized") {
      onFinalized(result.status);
      return;
    }

    setState({ phase: "error", message: "Your exam could not be submitted. Please tell your supervisor." });
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={disabled || state.phase === "loading" || state.phase === "submitting"}
        className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        Submit exam
      </button>

      {state.phase !== "closed" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
            className="w-full max-w-md rounded-lg border border-black/10 bg-white p-6 dark:border-white/15 dark:bg-black"
          >
            <h2 id="submit-title" className="text-lg font-semibold">
              Submit your exam?
            </h2>

            {state.phase === "loading" ? (
              <p className="mt-3 text-sm text-black/60 dark:text-white/60">Checking your answers…</p>
            ) : null}

            {state.phase === "error" ? (
              <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
                {state.message}
              </p>
            ) : null}

            {state.phase === "ready" ? (
              <div className="mt-3 space-y-2 text-sm">
                <p>
                  You have answered{" "}
                  <span className="font-semibold">
                    {state.summary.answered} of {state.summary.total}
                  </span>
                  .
                </p>
                <p className="text-black/70 dark:text-white/70">
                  Unanswered:{" "}
                  {state.summary.unanswered.length === 0 ? (
                    "none"
                  ) : (
                    <span className="font-medium">{state.summary.unanswered.join(", ")}</span>
                  )}
                </p>
                <p className="text-black/60 dark:text-white/60">
                  You cannot return to the exam after submitting.
                </p>
              </div>
            ) : null}

            {state.phase === "submitting" ? (
              <p className="mt-3 text-sm text-black/60 dark:text-white/60">Submitting…</p>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setState({ phase: "closed" })}
                disabled={state.phase === "submitting"}
                className="rounded-md border border-black/15 px-4 py-2 text-sm disabled:opacity-50 dark:border-white/20"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={state.phase !== "ready"}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                Confirm submit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
