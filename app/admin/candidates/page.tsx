import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/require-admin";
import { PAGE_SIZES, listCandidates, parseCandidateFilters } from "@/lib/admin/query-candidates";

export const metadata: Metadata = { title: "Candidates" };

/// Filters live in the URL, so this must not be cached as a static page.
export const dynamic = "force-dynamic";

const CELL = "border-b border-black/5 px-3 py-2 text-left align-top dark:border-white/10";
const FIELD =
  "mt-1 w-full rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20";

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 16).replace("T", " ");
}

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const filters = parseCandidateFilters(await searchParams);
  const result = await listCandidates(filters);

  const pageLink = (page: number): string => {
    const query = new URLSearchParams();
    if (filters.search) query.set("q", filters.search);
    if (filters.pageSize !== 25) query.set("pageSize", String(filters.pageSize));
    query.set("page", String(page));
    return `/admin/candidates?${query}`;
  };

  const first = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const last = Math.min(result.page * result.pageSize, result.total);

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/attempts" className="underline">
            Attempts
          </Link>
          <Link href="/admin" className="underline">
            Admin home
          </Link>
        </div>
      </div>

      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        Registrations synchronized from the Google Form. This page is read-only.
      </p>

      {/* GET form: submitting always lands on page 1, and the resulting URL is
          shareable and refreshable. */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-black/60 dark:text-white/60">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.search}
            placeholder="Name, email or mobile"
            className={`${FIELD} w-72`}
          />
        </label>

        <label className="text-sm">
          <span className="text-black/60 dark:text-white/60">Per page</span>
          <select name="pageSize" defaultValue={String(filters.pageSize)} className={FIELD}>
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Apply
        </button>
        <Link
          href="/admin/candidates"
          className="rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Reset
        </Link>
      </form>

      <p className="mt-6 text-sm text-black/60 dark:text-white/60">
        {result.total === 0
          ? filters.search
            ? "No candidates match your search."
            : "No candidates found."
          : `Showing ${first}–${last} of ${result.total} candidate${result.total === 1 ? "" : "s"}`}
      </p>

      {result.total > 0 ? (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {["Name", "Email", "Mobile", "Registered", "Updated", "Attempts", ""].map((header) => (
                    <th key={header} className={`${CELL} font-medium`}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.candidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td className={CELL}>{candidate.name}</td>
                    <td className={CELL}>{candidate.email}</td>
                    <td className={CELL}>{candidate.mobile}</td>
                    <td className={CELL}>{formatDate(candidate.registeredAt)}</td>
                    <td className={CELL}>{formatDate(candidate.updatedAt)}</td>
                    <td className={CELL}>{candidate.attemptCount}</td>
                    <td className={CELL}>
                      <Link
                        href={`/admin/attempts?candidate=${encodeURIComponent(candidate.id)}`}
                        className="underline"
                      >
                        View attempts
                      </Link>
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
