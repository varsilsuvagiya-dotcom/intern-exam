import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileQuestion } from "lucide-react";

import { FilterBar, SearchField, SelectField } from "@/components/admin/filter-bar";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/require-admin";
import { VALID_SECTIONS, sectionName } from "@/lib/exam-settings/exam-blueprint";
import { NOT_READY_MESSAGE } from "@/lib/question-bank/activation-readiness";
import { PAGE_SIZES, listQuestions, parseFilters } from "@/lib/question-bank/query-questions";
import { getBankReadiness } from "@/lib/question-bank/readiness-summary";

import { QuestionTable } from "./bulk-actions";
import { BankTotals, SectionReadinessTable } from "./section-readiness";

export const metadata: Metadata = { title: "Question bank" };

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const filters = parseFilters(params);
  const [result, readiness] = await Promise.all([listQuestions(filters), getBankReadiness()]);

  const filtered =
    Boolean(filters.search) ||
    filters.section !== null ||
    filters.difficulty !== null ||
    filters.active !== null ||
    filters.scored !== null ||
    filters.readiness !== null;

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
            <Download aria-hidden="true" className="size-4" />
            Import CSV
          </Link>
        }
      />

      <section aria-labelledby="bank-readiness" className="mt-6">
        <h2 id="bank-readiness" className="text-sm font-semibold text-ink">
          Bank readiness
        </h2>
        <div className="mt-3">
          <BankTotals totals={readiness.totals} />
        </div>
        <div className="mt-3">
          <SectionReadinessTable sections={readiness.sections} />
        </div>
      </section>

      <div className="mt-6">
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
            ...VALID_SECTIONS.map(
              (value) => [String(value), sectionName(value)] as [string, string],
            ),
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
          id="questions-readiness"
          name="readiness"
          label="Readiness"
          value={filters.readiness ?? ""}
          options={[
            ["", "All"],
            ["ready-to-activate", "Ready to activate"],
            ["not-ready", "Not ready"],
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
      </div>

      <div className="mt-6">
        {result.total === 0 && !filtered ? (
          <EmptyState
            icon={<FileQuestion aria-hidden="true" className="size-6" />}
            title="No questions yet"
            body="Import a question CSV to populate the bank."
          />
        ) : (
          <>
            {/* Keyed by filters so a new result set starts at its requested page. */}
            <QuestionTable
              key={JSON.stringify(filters)}
              questions={result.questions}
              reasonLabels={NOT_READY_MESSAGE}
              initialPage={filters.page}
              pageSize={filters.pageSize}
            />
          </>
        )}
      </div>
    </PageBody>
  );
}
