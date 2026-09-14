"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type { SubmissionSummary, TerminalStatus } from "@/lib/exam/finalize-attempt";

import { ExamButton } from "@/components/exam/button";

import { fetchSubmissionSummary, submitExam } from "./actions";

type Ready = Extract<SubmissionSummary, { kind: "ok" }>;

/// The dialog's phases.
///
/// `error` carries what to do next rather than only what went wrong: an error
/// raised while checking answers is retried by re-running the check, and one
/// raised while submitting is retried by submitting again. The previous build
/// had a single error phase with no way out but "Go back", which meant a
/// candidate whose submission failed at the end of 75 minutes had a dead
/// dialog and no second attempt.
type State =
  | { phase: "closed" }
  | { phase: "loading" }
  | { phase: "ready"; summary: Ready }
  | { phase: "submitting" }
  | { phase: "error"; message: string; retry: "open" | "confirm" };

/// How long a request may take before the dialog stops waiting for it.
///
/// A Server Action on a dropped connection does not reject promptly — the
/// browser retries the fetch underneath and the promise can stay pending for
/// minutes. Without a bound the dialog sits on "Checking your answers…"
/// forever, which is the worst possible state at the end of an examination:
/// the candidate is given no error, no retry and no reason to believe anything
/// is wrong. So each request is raced against a timer and a slow one is
/// reported as a failure the candidate can retry.
///
/// This never affects the attempt itself. Finalization is decided entirely
/// server-side and is idempotent, so a submission that lands after the dialog
/// gave up still finalizes exactly once, and the retry is told the state that
/// won rather than creating a second one.
const REQUEST_TIMEOUT_MS = 15_000;

/// Flushing is allowed considerably longer than a single request.
///
/// `flush()` waits for *every* outstanding answer save, and a candidate who has
/// just answered all 55 questions can have a queue of writes still settling
/// against a remote database. Measured against a full paper, that legitimately
/// runs past the single-request budget — so sharing one 15s allowance made the
/// most diligent candidate the one most likely to be told, wrongly, that the
/// server could not be reached. The summary request that follows keeps the
/// shorter budget, because it is one query.
const FLUSH_TIMEOUT_MS = 60_000;

class RequestTimeout extends Error {}

function withTimeout<T>(work: Promise<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new RequestTimeout()), ms)),
  ]);
}

/// The answered/unanswered statement.
///
/// Both numbers come from `SubmissionSummary`, which the server computes from
/// stored rows — there is no second count in this component, and nothing here
/// knows how many questions a CloudUS paper has.
///
/// Unanswered question numbers are listed because a candidate deciding whether
/// to submit needs to know *which* ones, not only how many. They render as a
/// number grid rather than a comma-separated sentence — the same shape as the
/// question palette itself — so even a full paper's worth of numbers stays
/// scannable instead of running on as a wall of prose.
function Summary({ summary }: { summary: Ready }) {
  const unanswered = summary.unanswered.length;

  return (
    <div className="mt-4">
      <div
        className={[
          "flex gap-3 rounded-exam-md border p-3.5",
          unanswered === 0
            ? "border-exam-success/30 bg-exam-success-bg text-exam-success"
            : "border-exam-warning/30 bg-exam-warning-bg text-exam-warning",
        ].join(" ")}
      >
        {unanswered === 0 ? (
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />
        ) : (
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />
        )}

        <div className="min-w-0 text-sm">
          <p className="exam-tabular font-semibold">
            {summary.answered} of {summary.total} questions answered
          </p>

          <p className="mt-1">
            {unanswered === 0
              ? "All questions have responses."
              : `${unanswered} ${unanswered === 1 ? "question is" : "questions are"} unanswered.`}
          </p>

          {unanswered > 0 ? (
            <ol
              aria-label="Unanswered question numbers"
              className="exam-tabular mt-2 grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1"
            >
              {summary.unanswered.map((number) => (
                <li
                  key={number}
                  className="flex h-7 items-center justify-center rounded-exam-sm border border-current/25 text-[12px] font-medium"
                >
                  {number}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-sm text-exam-ink-secondary">
        {unanswered > 0
          ? "Unanswered questions will remain blank. You cannot return to the examination after submitting."
          : "You cannot return to the examination after submitting."}
      </p>
    </div>
  );
}

export function SubmitDialog({
  disabled,
  flushPending,
  onFinalized,
  onTerminated,
}: {
  disabled: boolean;
  /// Waits for any debounced save still in flight, so the counts below describe
  /// what is actually stored rather than what the browser hopes is stored.
  flushPending: () => Promise<boolean>;
  onFinalized: (status: TerminalStatus) => void;
  /// The attempt was already ended by the anti-cheating limit before this
  /// dialog could finalize it — a real race, not a hypothetical one, since a
  /// violation can land in the moment between opening this dialog and
  /// confirming.
  onTerminated: () => void;
}) {
  const [state, setState] = useState<State>({ phase: "closed" });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isOpen = state.phase !== "closed";

  const open = useCallback(async () => {
    setState({ phase: "loading" });

    try {
      const flushed = await withTimeout(flushPending(), FLUSH_TIMEOUT_MS);

      if (!flushed) {
        setState({
          phase: "error",
          message:
            "Some of your answers could not be saved. Check your connection, then try again.",
          retry: "open",
        });
        return;
      }

      const summary = await withTimeout(fetchSubmissionSummary());

      if (summary.kind === "terminated") {
        onTerminated();
        return;
      }

      if (summary.kind === "finished") {
        onFinalized(summary.status);
        return;
      }

      if (summary.kind !== "ok") {
        setState({
          phase: "error",
          message: "We couldn't check your examination. Please try again.",
          retry: "open",
        });
        return;
      }

      setState({ phase: "ready", summary });
    } catch {
      // A timeout or a dropped connection. Deliberately not a technical
      // message: the candidate can act on "check your connection", not on a
      // fetch error.
      setState({
        phase: "error",
        message:
          "We couldn't reach the examination server. Check your connection, then try again.",
        retry: "open",
      });
    }
  }, [flushPending, onFinalized, onTerminated]);

  // Submitting is never optimistic: the completion screen appears only once the
  // server has reported a terminal status. `finalizeAttempt` is a conditional
  // update guarded on `status = in_progress`, so pressing this twice — or
  // racing the auto-submit loop — finalizes once and reports the state that won.
  const confirm = async () => {
    setState({ phase: "submitting" });

    // Pressing this disables it, and the browser then drops focus to <body>.
    // Taking focus onto the panel first keeps a keyboard user inside the
    // dialog — and inside the live region that reports the outcome — for the
    // whole of the submission.
    panelRef.current?.focus();

    try {
      const result = await withTimeout(submitExam("manual"));

      if (result.kind === "finalized") {
        onFinalized(result.status);
        return;
      }

      if (result.kind === "terminated") {
        onTerminated();
        return;
      }
    } catch {
      // Falls through to the same error. A request that eventually lands after
      // this point still finalizes the attempt exactly once, and pressing "Try
      // again" is then told the status that won rather than submitting twice.
    }

    setState({
      phase: "error",
      message: "We couldn't submit your examination. Your answers are saved. Please try again.",
      retry: "confirm",
    });
  };

  const close = useCallback(() => {
    setState({ phase: "closed" });
    // Focus goes back where the candidate left it rather than to the top of the
    // document, so a keyboard user is returned to the control they opened.
    triggerRef.current?.focus();
  }, []);

  // Focus moves into the panel when the dialog opens, and again when the phase
  // changes, because each phase replaces the buttons that were there. Without
  // it a candidate who pressed "Try again" would be focused on a detached node.
  useEffect(() => {
    if (!isOpen) return;

    const panel = panelRef.current;
    if (!panel) return;

    // Deferred a frame: pressing "Submit examination" disables that button, and
    // the browser drops focus to <body> *after* this render. Checking
    // immediately would see focus still on the button and leave a keyboard user
    // stranded outside the dialog for the length of the submission.
    const frame = requestAnimationFrame(() => {
      const active = document.activeElement;

      if (!active || active === document.body || !panel.contains(active)) {
        panel.focus();
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen, state.phase]);

  // Escape closes, and Tab is kept inside the panel. `aria-modal` tells a
  // screen reader the rest of the page is inert; it does not make it so for a
  // keyboard, and tabbing out of a submit confirmation onto the exam behind it
  // is exactly the confusion this dialog exists to avoid.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Not while a submission is in flight: the request is already with the
        // server and dismissing would hide its outcome.
        if (state.phase !== "submitting") {
          event.preventDefault();
          close();
        }
        return;
      }

      if (event.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
        panel.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, state.phase, close]);

  return (
    <>
      <ExamButton
        ref={triggerRef}
        variant="primary"
        onClick={open}
        disabled={disabled || state.phase === "loading" || state.phase === "submitting"}
      >
        Submit exam
      </ExamButton>

      {isOpen ? (
        // Not click-outside-to-dismiss, deliberately: an accidental click on
        // the backdrop must not silently cancel the one action that ends the
        // examination.
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 sm:p-6">
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-title"
            tabIndex={-1}
            className="w-full max-w-md rounded-exam-lg border border-exam-line bg-exam-surface p-5 shadow-exam-lg outline-none sm:p-6"
          >
            <h2 id="submit-title" className="text-lg font-semibold text-exam-ink">
              Submit your examination?
            </h2>

            {/* One live region for the whole dialog, so progress and failure
                are announced without the panel itself being re-announced on
                every phase change. */}
            <div aria-live="polite" className="contents">
              {state.phase === "loading" ? (
                <p className="mt-4 text-sm text-exam-muted">
                  Saving and checking your answers…
                  {/* A full paper's worth of outstanding saves can take a
                      moment to settle. Saying so is better than an unexplained
                      pause on the screen that ends the examination. */}
                  <span className="mt-1 block text-exam-muted">
                    This can take a few moments. Please do not close this window.
                  </span>
                </p>
              ) : null}

              {state.phase === "submitting" ? (
                <p className="mt-4 text-sm text-exam-muted">
                  Submitting your examination. Please do not close this window.
                </p>
              ) : null}

              {state.phase === "error" ? (
                <div
                  role="alert"
                  className="mt-4 flex gap-3 rounded-exam-md border border-exam-danger/30 bg-exam-danger-bg p-3.5 text-sm text-exam-danger"
                >
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />
                  <p className="min-w-0">{state.message}</p>
                </div>
              ) : null}
            </div>

            {state.phase === "ready" ? <Summary summary={state.summary} /> : null}

            {/* Stacks below 480px so neither button is squeezed under its 44px
                minimum, and reverses so the confirming action stays last in
                reading order while sitting on the right on wider screens. */}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <ExamButton
                onClick={close}
                disabled={state.phase === "submitting"}
                className="w-full sm:w-auto"
              >
                Go back
              </ExamButton>

              {state.phase === "error" ? (
                <ExamButton
                  variant="primary"
                  onClick={state.retry === "confirm" ? confirm : open}
                  className="w-full sm:w-auto"
                >
                  Try again
                </ExamButton>
              ) : (
                <ExamButton
                  variant="primary"
                  onClick={confirm}
                  disabled={state.phase !== "ready"}
                  loading={state.phase === "submitting"}
                  loadingLabel="Submitting…"
                  className="w-full sm:w-auto"
                >
                  Submit examination
                </ExamButton>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
