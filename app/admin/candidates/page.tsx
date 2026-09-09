import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Users } from "lucide-react";

import { FilterBar, SearchField, SelectField } from "@/components/admin/filter-bar";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { buttonClass } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { PAGE_SIZES, listCandidates, parseCandidateFilters } from "@/lib/admin/query-candidates";
import { requireAdmin } from "@/lib/auth/require-admin";

export const metadata: Metadata = { title: "Candidates" };

/// Filters live in the URL, so this must not be cached as a static page.
export const dynamic = "force-dynamic";

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

  // Unchanged from the previous implementation: same parameter names (`q`,
  // `pageSize`, `page`), same omission rules, same defaults.
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
    <PageBody>
      <PageHeader
        title="Candidates"
        description="Registrations synchronized from the Google Form. This page is read-only."
        actions={
          <Link
            href="/admin/attempts"
            className={buttonClass("secondary")}
          >
            <ClipboardList aria-hidden="true" className="size-4" />
            Attempts
          </Link>
        }
      />

      <FilterBar resetHref="/admin/candidates">
        <SearchField
          id="candidates-search"
          name="q"
          label="Search"
          defaultValue={filters.search}
          // Names the three fields the query layer actually searches. No other
          // field is searchable, and none is claimed here.
          placeholder="Name, email or mobile"
        />
        <SelectField
          id="candidates-page-size"
          name="pageSize"
          label="Per page"
          value={String(filters.pageSize)}
          options={PAGE_SIZES.map((size) => [String(size), String(size)] as [string, string])}
        />
      </FilterBar>

      <div className="mt-6">
        {result.total === 0 ? (
          <EmptyState
            icon={<Users aria-hidden="true" className="size-6" />}
            title={filters.search ? "No candidates match your search" : "No candidates yet"}
            body={
              filters.search
                ? "Try a different name, email or mobile number."
                : "Candidates appear here once the Google Form sync runs."
            }
            action={
              filters.search ? (
                <Link
                  href="/admin/candidates"
                  className={buttonClass("secondary")}
                >
                  Reset search
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <TableContainer label="Candidates table" minWidth={920}>
              <thead>
                <tr>
                  <Th>Candidate</Th>
                  <Th>Mobile</Th>
                  <Th>Registered</Th>
                  <Th>Updated</Th>
                  <Th align="right">Attempts</Th>
                  <Th align="right">View</Th>
                </tr>
              </thead>
              <tbody>
                {result.candidates.map((candidate) => (
                  <Tr key={candidate.id}>
                    {/* Name and email form one identity cell: the name anchors
                        the row, the email supports it. This groups two columns
                        that previously carried equal weight. */}
                    <Td>
                      {/* Capped so one very long address cannot stretch the
                          identity column and push every later column away.
                          `break-all` keeps the overflow inside the cell. */}
                      <div className="max-w-[360px]">
                        <span className="font-medium text-ink">{candidate.name}</span>
                        <span className="block text-xs break-all text-muted">{candidate.email}</span>
                      </div>
                    </Td>
                    <Td className="text-ink-secondary tabular whitespace-nowrap">
                      {candidate.mobile}
                    </Td>
                    <Td className="text-[13px] text-muted tabular whitespace-nowrap">
                      {formatDate(candidate.registeredAt)}
                    </Td>
                    <Td className="text-[13px] text-muted tabular whitespace-nowrap">
                      {formatDate(candidate.updatedAt)}
                    </Td>
                    {/* A count, not a status: the query provides no attempt
                        state, so none is implied. Zero is muted so the rows
                        that have attempts stand out. */}
                    <Td align="right">
                      <span
                        className={
                          candidate.attemptCount === 0
                            ? "tabular text-disabled"
                            : "tabular font-medium text-ink"
                        }
                      >
                        {candidate.attemptCount}
                      </span>
                    </Td>
                    <Td align="right">
                      {/* `aria-label` rather than an `sr-only` span: an
                          absolutely-positioned span inside the scroll
                          container escapes it and pans the whole page. */}
                      <Link
                        href={`/admin/attempts?candidate=${encodeURIComponent(candidate.id)}`}
                        aria-label={`View attempts for ${candidate.name}`}
                        className="rounded-sm text-sm font-medium whitespace-nowrap text-primary hover:underline"
                      >
                        View attempts
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableContainer>

            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              hrefFor={pageLink}
              summary={`Showing ${first}–${last} of ${result.total} candidate${result.total === 1 ? "" : "s"}`}
            />
          </>
        )}
      </div>
    </PageBody>
  );
}
