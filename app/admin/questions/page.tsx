import type { Metadata } from "next";
import Link from "next/link";
import { FileQuestion, Upload } from "lucide-react";

import {
  DifficultyChip,
  QuestionActiveBadge,
  QuestionStatusBadge,
} from "@/components/admin/question-status-badge";
import { FilterBar, SearchField, SelectField } from "@/components/admin/filter-bar";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Chip } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/require-admin";
import { VALID_SECTIONS } from "@/lib/question-bank/csv-contract";
import { PAGE_SIZES, listQuestions, parseFilters } from "@/lib/question-bank/query-questions";

export const metadata: Metadata = { title: "Question bank" };

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const filters = parseFilters(params);
  const result = await listQuestions(filters);

  // Unchanged from the previous implementation: same parameter names, same
  // omission rules, same defaults. Renaming any of these would break existing
  // bookmarked views.
  const pageLink = (page: number): string => {
    const query = new URLSearchParams();
    if (filters.search) query.set("search", filters.search);
    if (filters.section !== null) query.set("section", String(filters.section));
    if (filters.difficulty) query.set("difficulty", filters.difficulty);
    if (filters.status) query.set("status", filters.status);
    if (filters.active !== null) query.set("active", filters.active ? "active" : "inactive");
    if (filters.scored !== null) query.set("scored", filters.scored ? "scored" : "unscored");
    if (filters.pageSize !== 25) query.set("pageSize", String(filters.pageSize));
    query.set("page", String(page));
    return `/admin/questions?${query}`;
  };

  const first = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const last = Math.min(result.page * result.pageSize, result.total);

  const filtered =
    Boolean(filters.search) ||
    filters.section !== null ||
    filters.difficulty !== null ||
    filters.status !== null ||
    filters.active !== null ||
    filters.scored !== null;

  return (
    <PageBody>
      <PageHeader
        title="Question bank"
        description="Manage, review and control the questions available for exams."
        actions={
          <Link
            href="/admin/questions/import"
            className={buttonClass("secondary")}
          >
            <Upload aria-hidden="true" className="size-4" />
            Import CSV
          </Link>
        }
      />

      <FilterBar resetHref="/admin/questions">
        <SearchField
          id="questions-search"
          name="search"
          label="Search"
          defaultValue={filters.search}
          placeholder="ID, question text or topic"
        />
        <SelectField
          id="questions-section"
          name="section"
          label="Section"
          value={filters.section === null ? "" : String(filters.section)}
          options={[
            ["", "All"],
            // Sections are numbered, not named, in the data. No names are
            // invented here.
            ...VALID_SECTIONS.map((s) => [String(s), `Section ${s}`] as [string, string]),
          ]}
        />
        <SelectField
          id="questions-difficulty"
          name="difficulty"
          label="Difficulty"
          value={filters.difficulty ?? ""}
          options={[
            ["", "All"],
            ["easy", "Easy"],
            ["medium", "Medium"],
            ["hard", "Hard"],
          ]}
        />
        <SelectField
          id="questions-status"
          name="status"
          label="Status"
          value={filters.status ?? ""}
          options={[
            ["", "All"],
            ["draft", "Draft"],
            ["review", "Review"],
            ["ready", "Ready"],
          ]}
        />
        <SelectField
          id="questions-active"
          name="active"
          label="Active"
          value={filters.active === null ? "" : filters.active ? "active" : "inactive"}
          options={[
            ["", "All"],
            ["active", "Active"],
            ["inactive", "Inactive"],
          ]}
        />
        <SelectField
          id="questions-scored"
          name="scored"
          label="Scored"
          value={filters.scored === null ? "" : filters.scored ? "scored" : "unscored"}
          options={[
            ["", "All"],
            ["scored", "Scored"],
            ["unscored", "Unscored"],
          ]}
        />
        <SelectField
          id="questions-page-size"
          name="pageSize"
          label="Per page"
          value={String(filters.pageSize)}
          options={PAGE_SIZES.map((size) => [String(size), String(size)] as [string, string])}
        />
      </FilterBar>

      <div className="mt-6">
        {result.total === 0 ? (
          <EmptyState
            icon={<FileQuestion aria-hidden="true" className="size-6" />}
            title={filtered ? "No questions match the current filters" : "No questions yet"}
            body={
              filtered
                ? "Try widening your search, or clearing the section and difficulty filters."
                : "Import a question CSV to populate the bank."
            }
            action={
              filtered ? (
                <Link
                  href="/admin/questions"
                  className={buttonClass("secondary")}
                >
                  Reset filters
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <TableContainer label="Question bank table" minWidth={1080}>
              <thead>
                <tr>
                  <Th>Question</Th>
                  <Th>Section</Th>
                  <Th>Difficulty</Th>
                  <Th>Status</Th>
                  <Th>Active</Th>
                  <Th align="right">Marks</Th>
                  <Th align="right">Edit</Th>
                </tr>
              </thead>
              <tbody>
                {result.questions.map((question) => (
                  <Tr key={question.id}>
                    {/* The primary column. Question text leads; id, topic and
                        lesson group sit beneath it as quiet metadata, which
                        removes four low-value columns from the old table. */}
                    <Td className="align-top">
                      <div className="max-w-[520px] min-w-[260px]">
                        <p className="line-clamp-2 leading-5 font-medium text-ink">
                          {question.question}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                          <span className="tabular">{question.id}</span>
                          <span aria-hidden="true">&middot;</span>
                          <span>{question.topic}</span>
                          {question.lessonGroup ? (
                            <>
                              <span aria-hidden="true">&middot;</span>
                              <span>{question.lessonGroup}</span>
                            </>
                          ) : null}
                          {/* Unscored is the exception worth surfacing;
                              scored is the norm and stays silent. */}
                          {question.scored ? null : (
                            <>
                              <span aria-hidden="true">&middot;</span>
                              <span className="text-warning">Unscored</span>
                            </>
                          )}
                        </p>
                      </div>
                    </Td>
                    <Td className="align-top">
                      <Chip>{question.section}</Chip>
                    </Td>
                    <Td className="align-top">
                      <DifficultyChip difficulty={question.difficulty} />
                    </Td>
                    <Td className="align-top">
                      <QuestionStatusBadge status={question.status} />
                    </Td>
                    <Td className="align-top">
                      <QuestionActiveBadge isActive={question.isActive} />
                    </Td>
                    <Td align="right" className="align-top text-ink-secondary tabular">
                      {question.marks}
                    </Td>
                    <Td align="right" className="align-top">
                      {/* Activation lives in the editor, where it always has.
                          No new mutation is introduced on this page. */}
                      {/* The link is named by `aria-label` rather than by an
                          `sr-only` span: an absolutely-positioned span inside
                          the scroll container escapes it and pans the whole
                          page sideways. */}
                      <Link
                        href={`/admin/questions/${encodeURIComponent(question.id)}`}
                        aria-label={`Open question ${question.id}`}
                        className="rounded-sm text-sm font-medium whitespace-nowrap text-primary hover:underline"
                      >
                        Open
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
              summary={`Showing ${first}–${last} of ${result.total} question${result.total === 1 ? "" : "s"}`}
            />
          </>
        )}
      </div>
    </PageBody>
  );
}
