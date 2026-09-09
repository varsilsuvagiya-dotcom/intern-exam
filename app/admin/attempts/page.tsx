import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/require-admin";
import { PAGE_SIZES } from "@/lib/admin/query-candidates";
import {
  SORT_LABELS,
  listAttempts,
  parseAttemptFilters,
  type AttemptScoring,
} from "@/lib/admin/query-attempts";

export const metadata: Metadata = { title: "Attempts" };

export const dynamic = "force-dynamic";

const CELL = "border-b border-black/5 px-3 py-2 text-left align-top dark:border-white/10";
const FIELD =
  "mt-1 w-full rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20";

function formatDate(value: Date | null): string {
  return value ? value.toISOString().slice(0, 16).replace("T", " ") : "—";
}

/// A score is only ever shown for an attempt that scoring has actually finished.
/// The other two states say so plainly rather than showing a number that would
/// be read as a final result.
function ScoreCell({ scoring }: { scoring: AttemptScoring }) {
  if (scoring.kind === "scored") {
    return (
      <span className="font-medium">
        {scoring.totalScore} / {scoring.maxScore}
      </span>
    );
  }

  return (
    <span className="text-black/50 dark:text-white/50">
      {scoring.kind === "pending" ? "Scoring pending" : "Not finalized"}
    </span>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: [string, string][];
}) {
  return (
    <label className="text-sm">
      <span className="text-black/60 dark:text-white/60">{label}</span>
      <select name={name} defaultValue={value} className={FIELD}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
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
    if (filters.pageSize !== 25) query.set("pageSize", String(filters.pageSize));
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

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Attempts</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/candidates" className="underline">
            Candidates
          </Link>
          <Link href="/admin" className="underline">
            Admin home
          </Link>
        </div>
      </div>

      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Exam attempts and their scoring status. This page is read-only.
      </p>

      {result.unknownCandidate ? (
        <p className="mt-4 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/15">
          That candidate no longer exists.{" "}
          <Link href="/admin/attempts" className="underline">
            Show all attempts
          </Link>
        </p>
      ) : null}

      {result.candidate ? (
        <p className="mt-4 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/15">
          Showing attempts for <span className="font-medium">{result.candidate.name}</span> (
          {result.candidate.email}).{" "}
          <Link href="/admin/attempts" className="underline">
            Clear
          </Link>
        </p>
      ) : null}

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        {/* Preserved across a filter change, so narrowing by status does not
            silently drop the candidate the admin navigated in with. */}
        {result.candidate ? (
          <input type="hidden" name="candidate" value={result.candidate.id} />
        ) : null}

        <label className="text-sm">
          <span className="text-black/60 dark:text-white/60">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.search}
            placeholder="Candidate name, email or mobile"
            className={`${FIELD} w-72`}
          />
        </label>

        <Select
          name="status"
          label="Status"
          value={filters.status ?? ""}
          options={[
            ["", "All"],
            ["in_progress", "In Progress"],
            ["submitted", "Submitted"],
            ["auto_submitted", "Auto Submitted"],
          ]}
        />

        <Select
          name="scoring"
          label="Scoring"
          value={filters.scoring ?? ""}
          options={[
            ["", "All"],
            ["scored", "Scored"],
            ["pending", "Scoring pending"],
          ]}
        />

        <Select
          name="sort"
          label="Sort"
          value={filters.sort}
          options={Object.entries(SORT_LABELS) as [string, string][]}
        />

        <Select
          name="pageSize"
          label="Per page"
          value={String(filters.pageSize)}
          options={PAGE_SIZES.map((size) => [String(size), String(size)] as [string, string])}
        />

        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Apply
        </button>
        <Link
          href="/admin/attempts"
          className="rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Reset
        </Link>
      </form>

      <p className="mt-4">
        {/* A plain link, not a form: the route is a GET that streams the CSV
            back, so the browser downloads it without leaving the page. */}
        <a
          href={`/admin/attempts/export${exportQuery ? `?${exportQuery}` : ""}`}
          className="rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Export CSV
        </a>
        <span className="ml-3 text-sm text-black/60 dark:text-white/60">
          Exports every attempt matching the filters above.
        </span>
      </p>

      <p className="mt-6 text-sm text-black/60 dark:text-white/60">
        {result.total === 0
          ? filtered
            ? "No attempts match your filters."
            : "No attempts found."
          : `Showing ${first}–${last} of ${result.total} attempt${result.total === 1 ? "" : "s"}`}
      </p>

      {result.total > 0 ? (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {["Candidate", "Email", "Mobile", "Status", "Started", "Submitted", "Score", ""].map(
                    (header) => (
                      <th key={header} className={`${CELL} font-medium`}>
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {result.attempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td className={CELL}>
                      {attempt.candidateName}
                      {attempt.enteredName && attempt.enteredName !== attempt.candidateName ? (
                        <span
                          className="block text-xs text-black/50 dark:text-white/50"
                          title="Name entered on the start screen"
                        >
                          entered: {attempt.enteredName}
                        </span>
                      ) : null}
                    </td>
                    <td className={CELL}>{attempt.candidateEmail}</td>
                    <td className={CELL}>{attempt.candidateMobile}</td>
                    <td className={CELL}>{attempt.statusLabel}</td>
                    <td className={CELL}>{formatDate(attempt.startedAt)}</td>
                    <td className={CELL}>{formatDate(attempt.submittedAt)}</td>
                    <td className={CELL}>
                      <ScoreCell scoring={attempt.scoring} />
                    </td>
                    <td className={CELL}>
                      {attempt.status === "in_progress" ? (
                        <span className="text-black/30 dark:text-white/30">—</span>
                      ) : (
                        <Link
                          href={`/admin/attempts/${encodeURIComponent(attempt.id)}?back=${encodeURIComponent(
                            `?${new URLSearchParams(
                              Object.entries({
                                ...(filters.search ? { q: filters.search } : {}),
                                ...(filters.status ? { status: filters.status } : {}),
                                ...(filters.scoring ? { scoring: filters.scoring } : {}),
                                ...(result.candidate ? { candidate: result.candidate.id } : {}),
                                ...(filters.sort !== "newest" ? { sort: filters.sort } : {}),
                                ...(filters.page > 1 ? { page: String(filters.page) } : {}),
                              }),
                            )}`,
                          )}`}
                          className="underline"
                        >
                          View result
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <nav className="mt-4 flex items-center gap-3 text-sm">
            {result.page > 1 ? (
              <Link href={pageLink(result.page - 1)} className="underline">
                Previous
              </Link>
            ) : (
              <span className="text-black/30 dark:text-white/30">Previous</span>
            )}
            <span>
              Page {result.page} of {result.totalPages}
            </span>
            {result.page < result.totalPages ? (
              <Link href={pageLink(result.page + 1)} className="underline">
                Next
              </Link>
            ) : (
              <span className="text-black/30 dark:text-white/30">Next</span>
            )}
          </nav>
        </>
      ) : null}
    </main>
  );
}
