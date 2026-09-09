import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Download, Upload } from "lucide-react";

import { AttemptStatusBadge } from "@/components/admin/attempt-status-badge";
import { ScoreCell } from "@/components/admin/score-cell";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { DEFAULT_SORT, listAttempts } from "@/lib/admin/query-attempts";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getExamSettings } from "@/lib/exam-settings";

export const metadata: Metadata = { title: "Overview" };

/// The exam's open/closed state gates candidate access, so this page is never
/// served from a cached render.
export const dynamic = "force-dynamic";

/// How many recent attempts the overview shows. A fixed subset, deliberately:
/// the full list, with filters and paging, lives on the Attempts page.
const RECENT_LIMIT = 5;

function formatDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 16).replace("T", " ") : "—";
}

/// One labelled fact from the exam configuration.
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm wrap-anywhere text-ink">{children}</dd>
    </div>
  );
}

export default async function AdminPage() {
  await requireAdmin();

  const settings = await getExamSettings();

  // The existing list query, asked for the newest page of five. No new query is
  // introduced, and the ordering is the one the Attempts page already uses.
  const recent = await listAttempts({
    search: "",
    status: null,
    scoring: null,
    candidateId: "",
    sort: DEFAULT_SORT,
    page: 1,
    pageSize: RECENT_LIMIT,
  });

  const noActivity = recent.total === 0;

  return (
    <PageBody>
      <PageHeader
        title="Overview"
        description="Current exam configuration and recent attempt activity."
      />

      {/* The most consequential ambient fact in the product. Per the design
          plan it belongs here and on Settings, not as a banner on every page. */}
      {settings.isOpen ? null : (
        <Alert tone="warning" title="The exam is closed" className="mb-4">
          Candidates cannot start a new attempt.{" "}
          <Link href="/admin/settings" className="font-medium underline">
            Manage settings
          </Link>
        </Alert>
      )}

      <section
        aria-labelledby="exam-status"
        className="rounded-lg border border-line bg-surface p-4 lg:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="exam-status" className="text-[13px] font-semibold text-ink">
              Exam status
            </h2>
            {/* Stated in words as well as toned, so it never depends on colour. */}
            <Badge tone={settings.isOpen ? "success" : "neutral"}>
              {settings.isOpen ? "Open" : "Closed"}
            </Badge>
          </div>

          {/* Visibility only. Changing any of this happens on Settings; there
              is deliberately no control on this page. */}
          {/* `inline-flex` with a touch height rather than a bare text link:
              on a phone this is a page action, and the design plan's 44px
              minimum applies to it. */}
          <Link
            href="/admin/settings"
            className="inline-flex items-center rounded-sm text-sm font-medium text-primary hover:underline max-md:min-h-11"
          >
            Manage settings
          </Link>
        </div>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Exam name">{settings.examName}</Fact>
          <Fact label="Duration">
            <span className="tabular">{settings.durationMinutes}</span> minutes
          </Fact>
          <Fact label="Difficulty mix">
            {/* The stored values, shown exactly as configured. */}
            <span className="tabular">
              {settings.easyPercent} / {settings.mediumPercent} / {settings.hardPercent}
            </span>
            <span className="text-muted"> easy / medium / hard</span>
          </Fact>
          <Fact label="Total attempts">
            <span className="tabular">{recent.total}</span>
          </Fact>
        </dl>
      </section>

      <section aria-labelledby="recent-attempts" className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="recent-attempts" className="text-base leading-6 font-semibold text-ink">
              Recent attempts
            </h2>
            <p className="mt-1 text-[13px] text-muted">
              The {RECENT_LIMIT} most recent attempts, newest first.
            </p>
          </div>
          {noActivity ? null : (
            <Link
              href="/admin/attempts"
              className="inline-flex items-center rounded-sm text-sm font-medium whitespace-nowrap text-primary hover:underline max-md:min-h-11"
            >
              View all attempts
            </Link>
          )}
        </div>

        {noActivity ? (
          <EmptyState
            icon={<ClipboardList aria-hidden="true" className="size-6" />}
            title="No attempts yet"
            body="Attempts appear here once candidates begin sitting the exam."
          />
        ) : (
          <TableContainer label="Recent attempts" minWidth={860}>
            <thead>
              <tr>
                <Th>Candidate</Th>
                <Th>Status</Th>
                <Th>Started</Th>
                <Th>Submitted</Th>
                <Th align="right">Score</Th>
                <Th align="right">Result</Th>
              </tr>
            </thead>
            <tbody>
              {recent.attempts.map((attempt) => (
                <Tr key={attempt.id}>
                  <Td>
                    <span className="font-medium text-ink">{attempt.candidateName}</span>
                    <span className="block text-xs break-all text-muted">
                      {attempt.candidateEmail}
                    </span>
                  </Td>
                  <Td>
                    <AttemptStatusBadge status={attempt.status} label={attempt.statusLabel} />
                  </Td>
                  <Td className="text-[13px] text-muted tabular whitespace-nowrap">
                    {formatDate(attempt.startedAt)}
                  </Td>
                  <Td className="text-[13px] text-muted tabular whitespace-nowrap">
                    {formatDate(attempt.submittedAt)}
                  </Td>
                  <Td align="right">
                    <ScoreCell scoring={attempt.scoring} />
                  </Td>
                  <Td align="right">
                    {/* Nothing to review while an attempt is still running —
                        the same rule the Attempts table applies. */}
                    {attempt.status === "in_progress" ? (
                      <span className="text-disabled">—</span>
                    ) : (
                      <Link
                        href={`/admin/attempts/${encodeURIComponent(attempt.id)}`}
                        aria-label={`View result for ${attempt.candidateName}`}
                        className="rounded-sm text-sm font-medium whitespace-nowrap text-primary hover:underline"
                      >
                        View result
                      </Link>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableContainer>
        )}
      </section>

      {/* Two actions, both of which exist elsewhere in the product. The sidebar
          already navigates; these are the two things an admin comes here to
          start doing. */}
      <section aria-labelledby="quick-actions" className="mt-8">
        <h2 id="quick-actions" className="text-base leading-6 font-semibold text-ink">
          Quick actions
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/admin/questions/import" className={buttonClass("secondary")}>
            <Upload aria-hidden="true" className="size-4" />
            Import CSV
          </Link>
          {/* A route handler that streams a CSV download, not a page. `Link`
              would client-navigate and break the download, so this stays a
              plain anchor. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/admin/attempts/export" className={buttonClass("secondary")}>
            <Download aria-hidden="true" className="size-4" />
            Export attempts
          </a>
        </div>
      </section>
    </PageBody>
  );
}
