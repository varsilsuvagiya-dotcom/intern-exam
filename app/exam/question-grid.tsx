"use client";

import { useEffect, useState } from "react";

import type { CandidateQuestion } from "@/lib/exam/candidate-paper";

import {
  QUESTION_CELL,
  QUESTION_CURRENT_RING,
  QUESTION_STATE,
  type QuestionState,
} from "@/components/exam/question-state";

/// A contiguous run of questions belonging to one section.
///
/// Derived from the paper's own `section` values in display order, never from
/// assumed ranges: paper generation shuffles, so "S1 is questions 1–10" is not
/// a fact this component may rely on. A section that were ever split across
/// the paper would simply produce two runs, which is the honest rendering.
type SectionRun = {
  section: number;
  sectionName: string;
  /// Index into `questions`, so a cell can call `onJump` directly.
  items: { question: CandidateQuestion; index: number }[];
};

function sectionRuns(questions: CandidateQuestion[]): SectionRun[] {
  const runs: SectionRun[] = [];

  questions.forEach((question, index) => {
    const last = runs[runs.length - 1];

    if (last && last.section === question.section) {
      last.items.push({ question, index });
      return;
    }

    runs.push({
      section: question.section,
      sectionName: question.sectionName,
      items: [{ question, index }],
    });
  });

  return runs;
}

/// One palette cell.
///
/// A button, not a link: navigation is in-page state, and the URL contract is
/// unchanged. The accessible name carries the question number *and* its state,
/// because the visual encoding (fill, border weight, font weight) cannot be
/// read aloud. `aria-current="true"` marks the current question in addition to
/// the ring, so "where am I" survives both grayscale and a screen reader.
function PaletteCell({
  number,
  state,
  isCurrent,
  onJump,
}: {
  number: number;
  state: QuestionState;
  isCurrent: boolean;
  onJump: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onJump}
        aria-current={isCurrent ? "true" : undefined}
        aria-label={`Question ${number}, ${QUESTION_STATE[state].label}${
          isCurrent ? ", current question" : ""
        }`}
        className={[
          QUESTION_CELL,
          "exam-tabular inline-flex items-center justify-center",
          "transition-colors duration-[120ms] ease-out",
          QUESTION_STATE[state].cell,
          isCurrent ? QUESTION_CURRENT_RING : "",
        ].join(" ")}
      >
        {number}
      </button>
    </li>
  );
}

/// The legend.
///
/// A real definition list this time: each swatch is a `<dt>` and its meaning a
/// `<dd>`. The previous build had `<dd>` elements with no `<dt>`, which is
/// invalid structure and announces poorly.
///
/// The wording is the same wording the cells announce, so a candidate who
/// hears "Question 12, answered" and then reads the legend sees one vocabulary
/// rather than two.
function Legend() {
  return (
    <dl className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-2 text-[13px] text-exam-muted">
      <dt className="flex">
        <span
          aria-hidden="true"
          className={`size-4 rounded-exam-sm ${QUESTION_STATE.answered.swatch}`}
        />
      </dt>
      <dd>Answered</dd>

      <dt className="flex">
        <span
          aria-hidden="true"
          className={`size-4 rounded-exam-sm ${QUESTION_STATE.seen.swatch}`}
        />
      </dt>
      <dd>Seen, not answered</dd>

      <dt className="flex">
        <span
          aria-hidden="true"
          className={`size-4 rounded-exam-sm ${QUESTION_STATE.unseen.swatch}`}
        />
      </dt>
      <dd>Not seen</dd>

      <dt className="flex">
        <span
          aria-hidden="true"
          className={`size-4 rounded-exam-sm border-2 border-exam-line-strong bg-exam-surface ${QUESTION_CURRENT_RING}`}
        />
      </dt>
      <dd>Current question</dd>
    </dl>
  );
}

/// Progress.
///
/// Reads the same `answers` map the shell holds and the same one the submit
/// dialog's server summary is derived from, so there is exactly one count in
/// the product. It reports *answer* state, not save state — persistence is the
/// header's job, and duplicating it here would give the candidate two sources
/// of truth about whether their work is safe.
function Progress({ answered, total }: { answered: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((answered / total) * 100);

  return (
    <div className="rounded-exam-md border border-exam-line bg-exam-subtle px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-exam-ink-secondary">Answered</span>
        <span className="exam-tabular text-sm font-semibold text-exam-ink">
          {answered} / {total}
        </span>
      </div>

      {/* Presentational: the numbers above are the accessible statement of
          progress, so the bar is hidden rather than announced as a second,
          rounder version of the same fact. */}
      <div
        aria-hidden="true"
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-exam-inset"
      >
        <div className="h-full bg-exam-primary" style={{ width: `${percent}%` }} />
      </div>

      <p className="mt-2 text-[13px] text-exam-muted">
        {total - answered === 0
          ? "All questions answered"
          : `${total - answered} remaining`}
      </p>
    </div>
  );
}

/// Whether the palette is a sidebar rather than a disclosure.
///
/// Matches the `lg` breakpoint the layout classes use. Kept in one place so
/// the two cannot drift apart.
const WIDE = "(min-width: 64rem)";

function useIsWide(): boolean {
  // Starts false so the first client render matches the server's, then
  // corrects on mount. The palette is never interactive before that.
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const sync = () => setIsWide(query.matches);

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return isWide;
}

/// The question palette.
///
/// A navigation landmark with a real name, so a screen-reader user can jump
/// straight to it and back out again. It is the primary way to move around the
/// paper; Previous/Next in the shell is the sequential way.
///
/// It carries no save control of any kind, and no "mark for review" — CloudUS
/// has neither, and the reference CBT interfaces that do are not the model.
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
  const stateOf = (question: CandidateQuestion): QuestionState => {
    if (answers[question.id] !== undefined) return "answered";
    return visited[question.id] ? "seen" : "unseen";
  };

  const total = questions.length;
  const answered = questions.filter((q) => answers[q.id] !== undefined).length;
  const runs = sectionRuns(questions);
  const isWide = useIsWide();

  const body = (
    <div>
      <Progress answered={answered} total={total} />

      {/* The one scroll region in the palette, and only when the paper is
          taller than the space beside the question. `lg:` because below that
          the palette is stacked in normal page flow and scrolling it
          separately would trap content inside a short box. */}
      <div className="mt-4 lg:max-h-[calc(100vh-var(--spacing-exam-header)-19rem)] lg:overflow-y-auto lg:pr-1">
        {runs.map((run, runIndex) => (
          <section
            key={`${run.section}-${runIndex}`}
            aria-label={`Section ${run.section}, ${run.sectionName}`}
            className={runIndex === 0 ? "" : "mt-4"}
          >
            <h3 className="flex items-baseline gap-1.5 text-[11px] font-semibold tracking-wide text-exam-muted uppercase">
              <span className="shrink-0">S{run.section}</span>
              <span className="truncate normal-case tracking-normal">{run.sectionName}</span>
            </h3>

            {/* `auto-fill` rather than a fixed column count: the palette is
                272px beside the question and full width when stacked, and the
                cells stay 44px in both cases instead of being squeezed. */}
            <ol className="mt-1.5 grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
              {run.items.map(({ question, index }) => (
                <PaletteCell
                  key={question.id}
                  number={index + 1}
                  state={stateOf(question)}
                  isCurrent={index === current}
                  onJump={() => onJump(index)}
                />
              ))}
            </ol>
          </section>
        ))}
      </div>

      <Legend />
    </div>
  );

  return (
    <nav
      aria-label="Question navigation"
      // Above `lg` this is a column beside the question. Below it the shell
      // stacks, and `order` lifts the palette above the question so the
      // toggle is reachable without scrolling past a long question first.
      className="w-full shrink-0 max-lg:order-first lg:w-[var(--spacing-exam-palette)]"
    >
      {/* One copy of the markup, presented two ways.

          From `lg` up the palette is a sticky panel beside the question and is
          always open. Below that the same content collapses into a native
          `<details>` — keyboard operable, announced as expandable, and needing
          no focus trap, no portal and no animation.

          `open` is a DOM property rather than a style, so it cannot be made
          responsive in CSS: a closed `<details>` hides its contents through
          the ::details-content box, which `display` on the child does not
          override. A media-query listener sets it instead. `isWide` starts
          false so the server-rendered markup matches the client's first
          paint; the effect opens it before the candidate can interact. */}
      <details
        open={isWide || undefined}
        className={[
          "group rounded-exam-lg border border-exam-line bg-exam-surface",
          "lg:sticky lg:top-[calc(var(--spacing-exam-header)+1rem)] lg:rounded-none lg:border-0 lg:bg-transparent",
        ].join(" ")}
      >
        <summary
          className={[
            "flex h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5",
            "text-sm font-semibold text-exam-ink [&::-webkit-details-marker]:hidden",
            // Not a control from `lg` up: it is permanently open there, so it
            // stops being clickable and reads as the heading it is.
            "lg:pointer-events-none lg:h-auto lg:cursor-default lg:px-0",
          ].join(" ")}
        >
          <span>Questions</span>

          <span className="flex items-center gap-2 text-[13px] font-normal text-exam-muted lg:hidden">
            <span className="exam-tabular">
              {answered} / {total} answered
            </span>
            <span aria-hidden="true" className="group-open:hidden">
              Show
            </span>
            <span aria-hidden="true" className="hidden group-open:inline">
              Hide
            </span>
          </span>
        </summary>

        <div className="border-t border-exam-line px-3.5 py-3.5 lg:border-0 lg:px-0 lg:pt-3 lg:pb-0">
          {body}
        </div>
      </details>
    </nav>
  );
}
