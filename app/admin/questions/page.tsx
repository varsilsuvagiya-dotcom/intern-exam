import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/require-admin";
import { VALID_SECTIONS } from "@/lib/question-bank/csv-contract";
import { PAGE_SIZES, listQuestions, parseFilters } from "@/lib/question-bank/query-questions";

export const metadata: Metadata = { title: "Question bank" };

const CELL = "border-b border-black/5 px-3 py-2 text-left align-top dark:border-white/10";
const FIELD =
  "mt-1 w-full rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20";

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

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const filters = parseFilters(params);
  const result = await listQuestions(filters);

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

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Question bank</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/questions/import" className="underline">
            Import CSV
          </Link>
          <Link href="/admin" className="underline">
            Admin home
          </Link>
        </div>
      </div>

      {/* GET form: filters live in the URL, so the view is refreshable and
          shareable, and submitting always lands on page 1. */}
      <form method="get" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-7">
        <label className="col-span-2 text-sm">
          <span className="text-black/60 dark:text-white/60">Search</span>
          <input
            type="search"
            name="search"
            defaultValue={filters.search}
            placeholder="ID, question or topic"
            className={FIELD}
          />
        </label>

        <Select
          name="section"
          label="Section"
          value={filters.section === null ? "" : String(filters.section)}
          options={[["", "All"], ...VALID_SECTIONS.map((s) => [String(s), String(s)] as [string, string])]}
        />
        <Select
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
        <Select
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
        <Select
          name="active"
          label="Active"
          value={filters.active === null ? "" : filters.active ? "active" : "inactive"}
          options={[
            ["", "All"],
            ["active", "Active"],
            ["inactive", "Inactive"],
          ]}
        />
        <Select
          name="scored"
          label="Scored"
          value={filters.scored === null ? "" : filters.scored ? "scored" : "unscored"}
          options={[
            ["", "All"],
            ["scored", "Scored"],
            ["unscored", "Unscored"],
          ]}
        />

        <Select
          name="pageSize"
          label="Per page"
          value={String(filters.pageSize)}
          options={PAGE_SIZES.map((size) => [String(size), String(size)] as [string, string])}
        />

        <div className="col-span-2 flex items-end gap-2 md:col-span-1">
          <button
            type="submit"
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Apply
          </button>
          <Link
            href="/admin/questions"
            className="rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
          >
            Reset
          </Link>
        </div>
      </form>

      <p className="mt-6 text-sm text-black/60 dark:text-white/60">
        {result.total === 0
          ? "No questions match these filters."
          : `Showing ${first}–${last} of ${result.total} question${result.total === 1 ? "" : "s"}`}
      </p>

      {result.total > 0 ? (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {["ID", "Sec", "Topic", "Question", "Lesson", "Difficulty", "Marks", "Scored", "Status", "Active", ""].map(
                    (header) => (
                      <th key={header} className={`${CELL} font-medium`}>
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {result.questions.map((question) => (
                  <tr key={question.id}>
                    <td className={CELL}>{question.id}</td>
                    <td className={CELL}>{question.section}</td>
                    <td className={CELL}>{question.topic}</td>
                    <td className={`${CELL} max-w-sm truncate`} title={question.question}>
                      {question.question}
                    </td>
                    <td className={CELL}>{question.lessonGroup ?? "—"}</td>
                    <td className={CELL}>{question.difficulty}</td>
                    <td className={CELL}>{question.marks}</td>
                    <td className={CELL}>{question.scored ? "Yes" : "No"}</td>
                    <td className={CELL}>{question.status}</td>
                    <td className={CELL}>
                      <span className={question.isActive ? "" : "text-black/40 dark:text-white/40"}>
                        {question.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className={CELL}>
                      <Link href={`/admin/questions/${encodeURIComponent(question.id)}`} className="underline">
                        Open
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
