import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/require-admin";
import {
  getAttemptResult,
  type ReviewQuestion,
  type ReviewState,
  type AttemptSummary,
} from "@/lib/admin/attempt-result";

export const metadata: Metadata = { title: "Attempt result" };

export const dynamic = "force-dynamic";

const MUTED = "text-black/60 dark:text-white/60";
const CARD = "rounded-md border border-black/10 dark:border-white/15";

const STATE_LABEL: Record<ReviewState, string> = {
  correct: "Correct",
  wrong: "Wrong",
  unanswered: "Unanswered",
  unscored: "Unscored",
};

const STATE_CLASS: Record<ReviewState, string> = {
  correct: "bg-green-600/10 text-green-700 dark:text-green-400",
  wrong: "bg-red-600/10 text-red-700 dark:text-red-400",
  unanswered: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  unscored: "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60",
};

function formatDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 16).replace("T", " ") : "—";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className={`${MUTED} py-1`}>{label}</dt>
      <dd className="py-1">{children}</dd>
    </>
  );
}

function CandidateSummary({ summary }: { summary: AttemptSummary }) {
  return (
    <section className={`${CARD} mt-6 p-4`}>
      <h2 className="text-sm font-semibold">Candidate</h2>
      <dl className="mt-2 grid grid-cols-[9rem_1fr] text-sm">
        <Field label="Name">{summary.candidateName}</Field>
        <Field label="Email">{summary.candidateEmail}</Field>
        <Field label="Mobile">{summary.candidateMobile}</Field>
        {/* Shown only when it disagrees with the registered record, so a
            mismatch stands out rather than being buried in duplicate rows. */}
        {summary.nameMismatch ? (
          <Field label="Entered name">
            <span className="text-amber-700 dark:text-amber-400">
              {summary.enteredName} (differs from registration)
            </span>
          </Field>
        ) : null}
        {summary.emailMismatch ? (
          <Field label="Entered email">
            <span className="text-amber-700 dark:text-amber-400">
              {summary.enteredEmail} (differs from registration)
            </span>
          </Field>
        ) : null}
      </dl>
    </section>
  );
}

function AttemptSummaryCard({ summary }: { summary: AttemptSummary }) {
  return (
    <section className={`${CARD} mt-4 p-4`}>
      <h2 className="text-sm font-semibold">Attempt</h2>
      <dl className="mt-2 grid grid-cols-[9rem_1fr] text-sm">
        <Field label="Status">{summary.statusLabel}</Field>
        <Field label="Started">{formatDate(summary.startedAt)}</Field>
        <Field label="Submitted">{formatDate(summary.submittedAt)}</Field>
        <Field label="Scored">{formatDate(summary.scoredAt)}</Field>
        <Field label="Duration">{summary.durationMinutes} minutes</Field>
        <Field label="Attempt ID">
          <code className="text-xs">{summary.id}</code>
        </Field>
      </dl>
    </section>
  );
}

function QuestionCard({ question }: { question: ReviewQuestion }) {
  return (
    <article className={`${CARD} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">Q{question.displayOrder}</span>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_CLASS[question.state]}`}>
          {STATE_LABEL[question.state]}
        </span>
        <span className={`ml-auto text-sm ${MUTED}`}>
          {question.marksAwarded} / {question.maxMarks}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm">{question.questionText}</p>

      {question.codeBlock ? (
        <pre className="mt-3 overflow-x-auto rounded-md bg-black/5 p-3 text-xs dark:bg-white/10">
          <code>{question.codeBlock}</code>
        </pre>
      ) : null}

      {question.scored ? (
        <>
          {/* Options appear in the stored shuffled order — exactly what the
              candidate saw. The letter shown is the original snapshot key. */}
          <ul className="mt-3 space-y-1 text-sm">
            {question.options.map((option) => (
              <li
                key={option.key}
                className={`rounded px-2 py-1 ${
                  option.isCorrect
                    ? "bg-green-600/10"
                    : option.isSelected
                      ? "bg-red-600/10"
                      : ""
                }`}
              >
                <span className="font-medium">{option.label}.</span> {option.text}
                {option.isCorrect ? (
                  <span className="ml-2 text-xs text-green-700 dark:text-green-400">correct answer</span>
                ) : null}
                {option.isSelected && !option.isCorrect ? (
                  <span className="ml-2 text-xs text-red-700 dark:text-red-400">candidate answer</span>
                ) : null}
                {option.isSelected && option.isCorrect ? (
                  <span className="ml-2 text-xs text-green-700 dark:text-green-400">candidate answer</span>
                ) : null}
              </li>
            ))}
          </ul>

          <dl className="mt-3 grid grid-cols-[9rem_1fr] text-sm">
            <Field label="Candidate answer">
              {question.selectedLabel ?? <span className={MUTED}>Not answered</span>}
            </Field>
            <Field label="Correct answer">
              {question.correctLabel} — {question.correctText}
            </Field>
            <Field label="Explanation">
              {question.explanation ?? <span className={MUTED}>No explanation provided.</span>}
            </Field>
          </dl>
        </>
      ) : (
        // Section 8: the answer is prose and is never compared to anything, so
        // no correct answer and no correctness is shown.
        <dl className="mt-3 grid grid-cols-[9rem_1fr] text-sm">
          <Field label="Candidate answer">
            {question.textAnswer === null ? (
              <span className={MUTED}>Not answered</span>
            ) : (
              <span className="whitespace-pre-wrap">{question.textAnswer}</span>
            )}
          </Field>
          <Field label="Scoring">
            <span className={MUTED}>Not scored — attitude questions carry no marks.</span>
          </Field>
        </dl>
      )}
    </article>
  );
}

export default async function AttemptResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const { id } = await params;
  const result = await getAttemptResult(id);

  if (result.kind === "not-found") {
    notFound();
  }

  // Carries the admin back to the list they arrived from, when one was passed.
  const back = await searchParams;
  const backQuery = typeof back.back === "string" ? back.back : "";
  const backHref = backQuery.startsWith("?") ? `/admin/attempts${backQuery}` : "/admin/attempts";

  const { summary } = result;

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Attempt result</h1>
        <div className="flex items-center gap-4 text-sm">
          {/* Offered only for a scored attempt: the rows carry correct answers
              and explanations, so there is nothing safe to export before then. */}
          {result.kind === "scored" ? (
            <a
              href={`/admin/attempts/${encodeURIComponent(summary.id)}/export`}
              className="rounded-md border border-black/15 px-3 py-1.5 dark:border-white/20"
            >
              Export result CSV
            </a>
          ) : null}
          <Link href={backHref} className="underline">
            Back to attempts
          </Link>
        </div>
      </div>

      <CandidateSummary summary={summary} />
      <AttemptSummaryCard summary={summary} />

      {result.kind === "in-progress" ? (
        <section className={`${CARD} mt-4 p-4`}>
          <h2 className="text-sm font-semibold">In Progress</h2>
          <p className={`mt-2 text-sm ${MUTED}`}>
            This attempt has not been finalized, so there is no result to review. Correct
            answers, explanations and scoring are deliberately withheld while an exam is
            still running.
          </p>
        </section>
      ) : null}

      {result.kind === "scoring-pending" ? (
        <section className={`${CARD} mt-4 p-4`}>
          <h2 className="text-sm font-semibold">Scoring Pending</h2>
          <p className={`mt-2 text-sm ${MUTED}`}>
            This attempt is finalized but has not been scored yet, so no score or question
            review is available. Nothing is scored by opening this page.
          </p>
        </section>
      ) : null}

      {result.kind === "scored" ? (
        <>
          <section className={`${CARD} mt-4 p-4`}>
            <h2 className="text-sm font-semibold">Score</h2>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {result.totalScore}{" "}
              <span className={`text-lg font-normal ${MUTED}`}>/ {result.maxScore}</span>
            </p>

            <table className="mt-4 w-full border-collapse text-sm">
              <tbody>
                {result.sectionScores.map((row) => (
                  <tr key={row.section}>
                    <td className="border-b border-black/5 py-1.5 pr-3 dark:border-white/10">
                      Section {row.section} — {row.name}
                    </td>
                    <td className="border-b border-black/5 py-1.5 text-right tabular-nums dark:border-white/10">
                      {row.score} / {row.maxScore}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1.5 pr-3 font-semibold">Total</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">
                    {result.totalScore} / {result.maxScore}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">
              Question review
              <span className={`ml-2 text-sm font-normal ${MUTED}`}>
                {result.questionCount} questions, as the candidate saw them
              </span>
            </h2>
            <p className={`mt-1 text-xs ${MUTED}`}>
              Rendered from the paper snapshot taken at exam time, so later question-bank
              edits do not change it. Topic is not part of that snapshot and is therefore
              not shown.
            </p>

            {result.sections.map((section) => (
              <div key={section.section} className="mt-8">
                <h3 className="text-base font-semibold">
                  Section {section.section} — {section.name}
                  <span className={`ml-2 text-sm font-normal ${MUTED}`}>
                    {section.score} / {section.maxScore}
                  </span>
                </h3>

                {section.groups.map((group) => (
                  <div key={group.key} className="mt-4">
                    {/* Section 7: the lesson is shown once, immediately above the
                        three questions drawn with it. */}
                    {group.lessonText ? (
                      <div className={`${CARD} bg-black/[0.03] p-4 dark:bg-white/[0.04]`}>
                        <h4 className="text-sm font-semibold">{group.lessonLabel}</h4>
                        <p className="mt-2 whitespace-pre-wrap text-sm">{group.lessonText}</p>
                      </div>
                    ) : null}

                    <div className="mt-3 space-y-3">
                      {group.questions.map((question) => (
                        <QuestionCard key={question.id} question={question} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}
