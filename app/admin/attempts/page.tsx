import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Download, X } from "lucide-react";

import { AttemptStatusBadge } from "@/components/admin/attempt-status-badge";
import { FilterBar, SearchField, SelectField } from "@/components/admin/filter-bar";
import { ScoreCell } from "@/components/admin/score-cell";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { requireAdmin } from "@/lib/auth/require-admin";
import { PAGE_SIZES } from "@/lib/admin/query-candidates";
import { SORT_LABELS, listAttempts, parseAttemptFilters } from "@/lib/admin/query-attempts";

export const metadata: Metadata = { title: "Attempts" };

export const dynamic = "force-dynamic";

function formatDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 16).replace("T", " ") : "—";
}

export default async function AttemptsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const filters = parseAttemptFilters(await searchParams);
  const result = await listAttempts(filters);

  const pageLink = (page: number): string => {
    const query = new URLSearchParams();
    if (filters.search) query.set("q", filters.search);
    if (filters.status) query.set("status", filters.status);
    if (filters.scoring) query.set("scoring", filters.scoring);
    if (result.candidate) query.set("candidate", result.candidate.id);
    if (filters.sort !== "newest") query.set("sort", filters.sort);
    if (filters.pageSize !== 10) query.set("pageSize", String(filters.pageSize));
    query.set("page", String(page));
    return `/admin/attempts?${query}`;
  };

  const first = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const last = Math.min(result.page * result.pageSize, result.total);
  const filtered = Boolean(filters.search || filters.status || filters.scoring || result.candidate);

  // The export honours the filters currently applied, but not the page: an
  // export of "page 2 only" would be a surprising thing to hand someone.
  const exportQuery = new URLSearchParams(
    Object.entries({
      ...(filters.search ? { q: filters.search } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.scoring ? { scoring: filters.scoring } : {}),
      ...(result.candidate ? { candidate: result.candidate.id } : {}),
      ...(filters.sort !== "newest" ? { sort: filters.sort } : {}),
    }),
  ).toString();

  // Carried into the result page so "Back to attempts" returns to this exact
  // filtered view. Unchanged from the existing behaviour.
  const backQuery = `?${new URLSearchParams(
    Object.entries({
      ...(filters.search ? { q: filters.search } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.scoring ? { scoring: filters.scoring } : {}),
      ...(result.candidate ? { candidate: result.candidate.id } : {}),
      ...(filters.sort !== "newest" ? { sort: filters.sort } : {}),
      ...(filters.page > 1 ? { page: String(filters.page) } : {}),
    }),
  )}`;

  return (
    <PageBody>
      <PageHeader
        title="Attempts"
        description="Exam attempts and their scoring status. This page is read-only."
        actions={
          <a
            href={`/admin/attempts/export${exportQuery ? `?${exportQuery}` : ""}`}
            className={buttonClass("secondary")}
          >
            <Download aria-hidden="true" className="size-4" />
            Export Excel
          </a>
        }
      />

      {result.unknownCandidate ? (
        <Alert tone="warning" className="mb-4">
          That candidate no longer exists.{" "}
          <Link href="/admin/attempts" className="font-medium underline">
            Show all attempts
          </Link>
        </Alert>
      ) : null}

      {/* An active candidate filter is shown as a removable chip rather than a
          sentence, so the narrowing is obvious and reversible at a glance. */}
      {result.candidate ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted">Filtered to</span>
          <span className="inline-flex items-center gap-2 rounded-md border border-primary-border bg-primary-subtle py-1 pr-1 pl-2.5 text-[13px] text-primary">
            <span className="font-medium">{result.candidate.name}</span>
            <span className="text-primary/70">{result.candidate.email}</span>
            <Link
              href="/admin/attempts"
              aria-label="Clear candidate filter"
              className="inline-flex size-6 items-center justify-center rounded-sm hover:bg-primary-border max-md:size-8"
            >
              <X aria-hidden="true" className="size-3.5" />
            </Link>
          </span>
        </div>
      ) : null}

      <FilterBar
        resetHref="/admin/attempts"
        hidden={
          // Preserved across a filter change, so narrowing by status does not
          // silently drop the candidate the admin navigated in with.
          result.candidate ? (
            <input type="hidden" name="candidate" value={result.candidate.id} />
          ) : null
        }
      >
        <SearchField
          id="attempts-search"
          name="q"
          label="Search"
          defaultValue={filters.search}
          placeholder="Candidate name, email or mobile"
        />
        <SelectField
          id="attempts-status"
          name="status"
          label="Status"
          value={filters.status ?? ""}
          options={[
            ["", "All"],
            ["in_progress", "In progress"],
            ["submitted", "Submitted"],
            ["auto_submitted", "Auto submitted"],
          ]}
        />
        <SelectField
          id="attempts-scoring"
          name="scoring"
          label="Scoring"
          value={filters.scoring ?? ""}
          options={[
            ["", "All"],
            ["scored", "Scored"],
            ["pending", "Scoring pending"],
          ]}
        />
        <SelectField
          id="attempts-sort"
          name="sort"
          label="Sort"
          value={filters.sort}
          options={Object.entries(SORT_LABELS) as [string, string][]}
        />
        <SelectField
          id="attempts-page-size"
          name="pageSize"
          label="Per page"
          value={String(filters.pageSize)}
          options={PAGE_SIZES.map((size) => [String(size), String(size)] as [string, string])}
        />
      </FilterBar>

      <div className="mt-6">
        {result.total === 0 ? (
          <EmptyState
            icon={<ClipboardList aria-hidden="true" className="size-6" />}
            // "Nothing matches" and "nothing exists yet" are different
            // situations and are worded differently.
            title={filtered ? "No attempts match your filters" : "No attempts yet"}
            body={
              filtered
                ? "Try clearing the status or scoring filter, or widening your search."
                : "Attempts appear here once candidates begin the exam."
            }
            action={
              filtered ? (
                <Link
                  href="/admin/attempts"
                  className={buttonClass("secondary")}
                >
                  Reset filters
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <TableContainer label="Attempts table" minWidth={980}>
              <thead>
                <tr>
                  <Th>Candidate</Th>
                  <Th>Mobile</Th>
                  <Th>Status</Th>
                  <Th>Started</Th>
                  <Th>Submitted</Th>
                  <Th align="right">Score</Th>
                  {/* Named rather than left blank so the column is announced,
                      without an absolutely-positioned sr-only span — that
                      escapes the scroll container and drags the page width. */}
                  <Th align="right">Result</Th>
                </tr>
              </thead>
              <tbody>
                {result.attempts.map((attempt) => (
                  <Tr key={attempt.id}>
                    {/* Name and email form one identity cell: the name anchors
                        the row, the email supports it. */}
                    <Td>
                      <span className="font-medium text-ink">{attempt.candidateName}</span>
                      <span className="block text-xs text-muted">{attempt.candidateEmail}</span>
                      {attempt.enteredName && attempt.enteredName !== attempt.candidateName ? (
                        <span
                          className="mt-0.5 block text-xs text-warning"
                          title="Name entered on the start screen"
                        >
                          entered: {attempt.enteredName}
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-ink-secondary tabular whitespace-nowrap">
                      {attempt.candidateMobile}
                    </Td>
                    <Td>
                      <AttemptStatusBadge status={attempt.status} label={attempt.statusLabel} />
                      {attempt.violationCount > 0 ? (
                        <Link
                          href={`/admin/attempts/${encodeURIComponent(attempt.id)}?back=${encodeURIComponent(backQuery)}`}
                          className="ml-1.5 inline-flex items-center rounded-sm bg-danger-bg px-1.5 py-0.5 text-xs font-medium text-danger hover:underline"
                          title="Unauthorized activity detected"
                        >
                          {attempt.violationCount} unauthorized
                        </Link>
                      ) : null}
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
                      {/* No result to view while an attempt is still running —
                          unchanged from the existing behaviour. */}
                      {attempt.status === "in_progress" ? (
                        <span className="text-disabled">—</span>
                      ) : (
                        <Link
                          href={`/admin/attempts/${encodeURIComponent(attempt.id)}?back=${encodeURIComponent(backQuery)}`}
                          className={buttonClass("primary", "sm")}
                        >
                          View result
                        </Link>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableContainer>

            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              hrefFor={pageLink}
              summary={`Showing ${first}–${last} of ${result.total} attempt${result.total === 1 ? "" : "s"}`}
            />
          </>
        )}
      </div>
    </PageBody>
  );
}
