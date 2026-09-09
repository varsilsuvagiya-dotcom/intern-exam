"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ArrowLeft, ArrowRight, RotateCcw, X } from "lucide-react";

import type { CandidatePaper } from "@/lib/exam/candidate-paper";
import type { ProgressState } from "@/lib/exam/exam-progress";
import type { TimingState } from "@/lib/exam/exam-timer";

import { ExamButton } from "@/components/exam/button";
import { ExamBanner } from "@/components/exam/surface";

import { CompletionScreen } from "./completion-screen";
import { ExamHeader } from "./exam-header";
import { lessonPosition } from "./lesson-panel";
import { ExamTimerDisplay } from "./exam-timer-display";
import { QuestionDisplay } from "./question-display";
import { QuestionGrid } from "./question-grid";
import { SubmitDialog } from "./submit-dialog";
import { useAutosave } from "./use-autosave";
import { persistProgress, submitExam } from "./actions";
import type { TerminalStatus } from "@/lib/exam/finalize-attempt";

export function ExamShell({
  paper,
  initialAnswers,
  initialTiming,
  initialProgress,
}: {
  paper: CandidatePaper;
  initialAnswers: Record<string, string>;
  initialTiming: TimingState;
  initialProgress: ProgressState;
}) {
  // Resumes at the persisted question. The stored value is a display order
  // within this attempt's own paper, so it is matched against the paper rather
  // than used as an array index — a paper is ordered by display order, but
  // nothing here needs to assume the two happen to coincide.
  const landingIndex = (() => {
    const index = paper.questions.findIndex(
      (question) => question.displayOrder === initialProgress.currentDisplayOrder,
    );
    return index === -1 ? 0 : index;
  })();

  const [current, setCurrent] = useState(landingIndex);
  // Restored from the server on load, then kept in step as answers are saved.
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [expired, setExpired] = useState(initialTiming.expired);
  const [visited, setVisited] = useState<Record<string, boolean>>(() => {
    const seen: Record<string, boolean> = {};
    // Every question the server has recorded a visit for.
    for (const id of initialProgress.visitedQuestionIds) seen[id] = true;
    // Anything already answered has necessarily been visited.
    for (const id of Object.keys(initialAnswers)) seen[id] = true;
    // And the question being landed on is being seen right now. The server is
    // told the same thing by the mount effect below; this keeps the first paint
    // consistent with what is about to be persisted.
    const landing = paper.questions[landingIndex];
    if (landing) seen[landing.id] = true;
    return seen;
  });

  /// Shown once, at the top of a resumed examination.
  ///
  /// A candidate whose machine restarted has no way of knowing their work
  /// survived — the answers are restored silently and the screen looks like a
  /// fresh start. This says so. It is presentational only: the restoration
  /// itself already happened server-side before this component rendered, and
  /// the condition is simply whether the server sent any saved answers.
  ///
  /// It is dismissible and not a banner, because it is reassurance rather than
  /// a condition the candidate has to act on.
  const [resumeNotice, setResumeNotice] = useState(
    () =>
      Object.keys(initialAnswers).length > 0 ||
      initialProgress.currentDisplayOrder !== null,
  );

  const [finalStatus, setFinalStatus] = useState<TerminalStatus | null>(null);
  /// True once an automatic submission has been refused or has failed at least
  /// once and the loop below is still trying. It only changes what the banner
  /// says; the retry itself is unchanged.
  const [autoRetrying, setAutoRetrying] = useState(false);

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
        try {
          const result = await submitExam("automatic");

          if (cancelled) return;

          if (result.kind === "finalized") {
            setFinalStatus(result.status);
            return;
          }

          if (result.kind === "not-found") {
            return;
          }
        } catch {
          // A dropped connection at the moment the timer expires must not end
          // the loop: the attempt would then stay open with nobody asking to
          // close it. Fall through to the wait and ask again.
          if (cancelled) return;
        }

        setAutoRetrying(true);
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

  // Section 7 only; null everywhere else. Computed here because this is where
  // the whole paper lives — the question component sees one question at a time.
  const lesson = lessonPosition(paper.questions, question);

  const questionRef = useRef<HTMLElement>(null);

  /// Orders progress reports so a slow one cannot overwrite a newer position.
  /// A ref rather than state: it must advance synchronously as the candidate
  /// navigates, and nothing renders from it.
  /// Continues from what the server has already accepted, so reports after a
  /// reload are newer than the stored ones rather than being discarded as stale.
  const progressSeq = useRef(initialProgress.positionSeq);

  /// Tells the server which question the candidate is on, and that they have
  /// seen it.
  ///
  /// Deliberately not awaited by navigation: the exam moves immediately and the
  /// write follows. A failure is swallowed rather than surfaced — the candidate
  /// can do nothing useful about it, their answers are unaffected, and the next
  /// navigation reports again with a newer sequence. It is not routed through
  /// the header's save status, which speaks for answers alone.
  const reportProgress = useCallback((questionId: string) => {
    progressSeq.current += 1;
    void persistProgress(questionId, progressSeq.current).catch(() => {});
  }, []);

  // The question the candidate lands on is one they have seen, whether that is
  // question 1 on a new attempt or the restored position on a resumed one.
  // Reported once on mount so a candidate who opens the exam and reads the
  // first question without navigating still has that recorded.
  const landingReported = useRef(false);

  useEffect(() => {
    // Guarded rather than relying on the effect running once: React invokes
    // mount effects twice in development, and a second identical report is a
    // wasted round trip on every exam load.
    if (landingReported.current) return;
    landingReported.current = true;

    const landing = paper.questions[current];
    if (landing) reportProgress(landing.id);
    // Mount only: later positions are reported by goTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goTo = (index: number) => {
    const target = paper.questions[index];
    if (!target) return;
    setCurrent(index);
    setVisited((previous) => ({ ...previous, [target.id]: true }));
    reportProgress(target.id);

    // Below `lg` the palette sits above the question, so a jump would
    // otherwise leave the candidate looking at the palette they just used.
    // Scrolling the reading column into view is enough — focus is deliberately
    // left where the candidate put it, so a keyboard user stays in the palette
    // and can keep moving. `prefers-reduced-motion` is honoured globally.
    questionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
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

  if (finalStatus) {
    return <CompletionScreen status={finalStatus} />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <ExamHeader
        examName={paper.examName}
        candidateName={paper.candidateName}
        sectionNumber={question.section}
        sectionName={question.sectionName}
        saveStatus={status}
        timer={<ExamTimerDisplay initial={initialTiming} onExpire={handleExpired} />}
        submit={
          <SubmitDialog disabled={expired} flushPending={flush} onFinalized={setFinalStatus} />
        }
      />

      {/* Time expiry is not a request: the exam ends by itself and the loop
          above is already submitting. So the banner states what is happening
          rather than asking the candidate to do anything, and there is no
          "are you sure" — the deadline has already passed. It stays visible
          until the completion screen replaces the whole shell. */}
      {expired ? (
        <ExamBanner tone="danger">
          {autoRetrying
            ? "Time is up. We are still submitting your examination — your saved answers are safe. Please keep this window open."
            : "Time is up. Your examination is being submitted automatically. Please keep this window open."}
        </ExamBanner>
      ) : null}

      <div className="flex w-full flex-1 gap-8 px-4 py-6 max-lg:flex-col md:px-6 lg:px-8">
        {/* The reading column is capped inside `main`, so on a very wide
            screen it is centred in the space left beside the palette rather
            than pinned to the far left with a large void between them. */}
        <main ref={questionRef} className="flex min-w-0 flex-1 scroll-mt-[calc(var(--spacing-exam-header)+1rem)] flex-col items-center">
          <div className="w-full max-w-exam-measure">
          {resumeNotice && !expired ? (
            <div className="mb-6 flex items-start gap-3 rounded-exam-md border border-exam-info/30 bg-exam-info-bg p-3.5 text-sm text-exam-info">
              <RotateCcw aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />
              <div className="min-w-0" role="status">
                <p className="font-semibold">Your examination has resumed</p>
                <p className="mt-1">
                  Your answers, your remaining time and the question you were working on
                  have all been restored.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResumeNotice(false)}
                aria-label="Dismiss resume message"
                className="-my-1.5 -mr-1.5 ml-auto inline-flex size-11 shrink-0 items-center justify-center rounded-exam-sm hover:bg-exam-info/10"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          ) : null}

          <QuestionDisplay
            question={question}
            index={current}
            total={total}
            answer={answers[question.id]}
            onAnswer={answer}
            disabled={expired}
            lesson={lesson}
          />

          {/* Sequential navigation. The palette is the jump mechanism; this
              is the "next one please" mechanism, and the two are deliberately
              the only ones. The answered count lives in the palette alone, so
              there is one place in the product that states progress. */}
          <nav
            aria-label="Question sequence"
            className="mt-8 flex max-w-exam-measure flex-wrap items-center justify-between gap-3 border-t border-exam-line pt-4"
          >
            <ExamButton
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              icon={<ArrowLeft aria-hidden="true" className="size-4" />}
            >
              Previous
            </ExamButton>

            <span className="exam-tabular text-sm text-exam-muted">
              Question {current + 1} of {total}
            </span>

            <ExamButton
              onClick={() => goTo(current + 1)}
              disabled={current === total - 1}
              className="flex-row-reverse"
              icon={<ArrowRight aria-hidden="true" className="size-4" />}
            >
              Next
            </ExamButton>
          </nav>
          </div>
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
