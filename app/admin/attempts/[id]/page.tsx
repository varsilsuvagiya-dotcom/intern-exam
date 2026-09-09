import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";

import { AttemptStatusBadge } from "@/components/admin/attempt-status-badge";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import {
  getAttemptResult,
  type AttemptSummary,
  type ReviewSection,
} from "@/lib/admin/attempt-result";
import { requireAdmin } from "@/lib/auth/require-admin";

import { QuestionReviewCard } from "./question-review-card";
import { SectionScoreTable } from "./section-score-table";

export const metadata: Metadata = { title: "Attempt result" };

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 16).replace("T", " ") : "—";
}

/// A bordered content block. Used sparingly: the page has four of them, not one
/// per subsection, so a 55-question review does not become a wall of cards.
function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-line bg-surface p-4 lg:p-5 ${className}`}>
      <h2 className="text-[13px] font-medium tracking-[0.04em] text-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}

function DefRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-0.5 py-1.5 max-sm:grid-cols-1 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

function CandidatePanel({ summary }: { summary: AttemptSummary }) {
  return (
    <Panel title="Candidate">
      {/* The person is the heading of this panel; the identifiers support it. */}
      <p className="mt-2 text-lg leading-7 font-semibold wrap-anywhere text-ink">
        {summary.candidateName}
      </p>
      <p className="text-sm wrap-anywhere text-ink-secondary">{summary.candidateEmail}</p>
      <p className="text-sm text-ink-secondary tabular">{summary.candidateMobile}</p>

      {/* Shown only on disagreement with the registered record, so a mismatch
          reads as an exception rather than as another metadata row. */}
      {summary.nameMismatch || summary.emailMismatch ? (
        <Alert tone="warning" title="Entered at start differs from registration" className="mt-3">
          <dl className="space-y-0.5">
            {summary.nameMismatch ? (
              <div>
                <dt className="inline text-[13px]">Entered name: </dt>
                <dd className="inline font-medium wrap-anywhere">{summary.enteredName}</dd>
              </div>
            ) : null}
            {summary.emailMismatch ? (
              <div>
                <dt className="inline text-[13px]">Entered email: </dt>
                <dd className="inline font-medium wrap-anywhere">{summary.enteredEmail}</dd>
              </div>
            ) : null}
          </dl>
        </Alert>
      ) : null}
    </Panel>
  );
}

function AttemptPanel({ summary }: { summary: AttemptSummary }) {
  return (
    <Panel title="Attempt">
      <dl className="mt-2 divide-y divide-line">
        <DefRow label="Status">
          <AttemptStatusBadge status={summary.status} label={summary.statusLabel} />
        </DefRow>
        <DefRow label="Started">
          <span className="tabular">{formatDate(summary.startedAt)}</span>
        </DefRow>
        <DefRow label="Submitted">
          <span className="tabular">{formatDate(summary.submittedAt)}</span>
        </DefRow>
        <DefRow label="Scored">
          <span className="tabular">{formatDate(summary.scoredAt)}</span>
        </DefRow>
        <DefRow label="Duration">{summary.durationMinutes} minutes</DefRow>
        {/* A technical identifier: mono and muted, so it is findable for
            support without competing with the candidate's name. */}
        <DefRow label="Attempt ID">
          <span className="font-mono text-xs wrap-anywhere text-muted">{summary.id}</span>
        </DefRow>
      </dl>
    </Panel>
  );
}

/// In-page navigation over a very long review. No new data: every score shown
/// here is the same persisted value the breakdown table prints.
function SectionJumpStrip({ sections }: { sections: ReviewSection[] }) {
  return (
    <nav aria-label="Jump to section" className="-mx-1 mt-3 overflow-x-auto px-1 pb-1">
      <ul className="flex w-max gap-2">
        {sections.map((section) => (
          <li key={section.section}>
            <a
              href={`#section-${section.section}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1 text-xs whitespace-nowrap text-ink-secondary transition-colors duration-[120ms] hover:bg-subtle hover:text-ink"
            >
              <span className="font-medium">S{section.section}</span>
              <span className="tabular text-muted">
                {section.scored ? `${section.score} / ${section.maxScore}` : "Not scored"}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
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
  // Unchanged from the existing behaviour.
  const back = await searchParams;
  const backQuery = typeof back.back === "string" ? back.back : "";
  const backHref = backQuery.startsWith("?") ? `/admin/attempts${backQuery}` : "/admin/attempts";

  const { summary } = result;

  return (
    <PageBody width="page">
      <PageHeader
        breadcrumbs={[{ label: "Attempts", href: backHref }, { label: "Result" }]}
        title="Attempt result"
        description="Reviewed from the paper snapshot taken at exam time, so later question-bank edits do not change it."
        actions={
          // Offered only for a scored attempt: the rows carry correct answers
          // and explanations, so there is nothing safe to export before then.
          // Absent rather than disabled for the other states, since the alert
          // below already explains the situation.
          result.kind === "scored" ? (
            <a
              href={`/admin/attempts/${encodeURIComponent(summary.id)}/export`}
              className={buttonClass("secondary")}
            >
              <Download aria-hidden="true" className="size-4" />
              Export result CSV
            </a>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CandidatePanel summary={summary} />
        <AttemptPanel summary={summary} />
      </div>

      {result.kind === "in-progress" ? (
        <Alert tone="info" title="Attempt in progress" className="mt-4">
          This attempt has not been finalized, so there is no result to review. Correct answers,
          explanations and scoring are deliberately withheld while an exam is still running.
        </Alert>
      ) : null}

      {result.kind === "scoring-pending" ? (
        <Alert tone="warning" title="Scoring pending" className="mt-4">
          This attempt is finalized but has not been scored yet, so no score or question review is
          available. Nothing is scored by opening this page.
        </Alert>
      ) : null}

      {result.kind === "scored" ? (
        <>
          {/* The visual anchor of the page. */}
          <section
            aria-labelledby="final-score"
            className="mt-4 rounded-lg border border-line bg-subtle p-5"
          >
            <h2
              id="final-score"
              className="text-[13px] font-medium tracking-[0.04em] text-muted uppercase"
            >
              Final score
            </h2>
            <p className="mt-1 text-[32px] leading-9 font-semibold text-ink tabular">
              {result.totalScore}
              <span className="text-lg font-normal text-muted"> / {result.maxScore}</span>
            </p>
          </section>

          <section aria-labelledby="section-breakdown" className="mt-8">
            <h2 id="section-breakdown" className="text-base leading-6 font-semibold text-ink">
              Section breakdown
            </h2>
            <p className="mt-1 mb-3 text-[13px] text-muted">
              Section 8 is stored for review and carries no marks.
            </p>
            <SectionScoreTable
              rows={result.sectionScores}
              totalScore={result.totalScore}
              maxScore={result.maxScore}
            />
          </section>

          <section aria-labelledby="question-review" className="mt-10">
            <h2 id="question-review" className="text-base leading-6 font-semibold text-ink">
              Question review
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              {result.questionCount} questions, in the order and option arrangement this candidate
              saw. Topic is not part of the snapshot and is therefore not shown.
            </p>

            <SectionJumpStrip sections={result.sections} />

            {result.sections.map((section) => (
              <div
                key={section.section}
                id={`section-${section.section}`}
                className="mt-8 scroll-mt-20"
              >
                <h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-2 text-sm font-semibold text-ink">
                  <span>
                    Section {section.section} &mdash; {section.name}
                  </span>
                  <span className="text-[13px] font-normal text-muted tabular">
                    {section.scored ? `${section.score} / ${section.maxScore}` : "Not scored"}
                  </span>
                </h3>

                {/* Said once for the whole section rather than repeated on
                    every card in it. */}
                {section.scored ? null : (
                  <p className="mt-2 text-[13px] text-muted">
                    Responses are stored for administrator review only. They carry no marks and
                    do not affect the total.
                  </p>
                )}

                {section.groups.map((group) => (
                  <div key={group.key} className="mt-4">
                    {/* Section 7: the lesson renders once, and the left border
                        running down the group is what ties it to the three
                        questions drawn with it. */}
                    {group.lessonText ? (
                      <div className="border-l-2 border-primary-border pl-3 lg:pl-4">
                        <div className="rounded-lg border border-primary-border bg-primary-subtle p-4">
                          <h4 className="text-[13px] font-semibold text-primary">
                            {group.lessonLabel}
                          </h4>
                          <p className="mt-2 text-sm leading-6 wrap-anywhere whitespace-pre-wrap text-ink">
                            {group.lessonText}
                          </p>
                        </div>
                        <div className="mt-3 space-y-3">
                          {group.questions.map((question) => (
                            <QuestionReviewCard key={question.id} question={question} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {group.questions.map((question) => (
                          <QuestionReviewCard key={question.id} question={question} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

            <p className="mt-8 border-t border-line pt-4 text-[13px] text-muted">
              End of review.{" "}
              <Link href={backHref} className="font-medium text-primary hover:underline">
                Back to attempts
              </Link>
            </p>
          </section>
        </>
      ) : null}
    </PageBody>
  );
}
