import { Chip } from "@/components/ui/badge";
import {
  ACCEPTED_EXTENSIONS,
  DIFFICULTY_VALUES,
  OPTIONAL_COLUMNS,
  SOURCE_COLUMNS,
  STATUS_VALUES,
  describeAccepted,
} from "@/lib/question-bank/csv-contract";
import { SECTION_BLUEPRINT } from "@/lib/exam-settings/exam-blueprint";

/// The import contract, rendered.
///
/// Every value here is read from the contract rather than retyped, so the page
/// cannot drift from the format the parser actually accepts.

/// Grouping is presentational only. Columns are matched by name, so the order
/// they appear in a file — and the order they are grouped in here — is
/// irrelevant to the parser.
const GROUPS: { title: string; note: string; columns: string[] }[] = [
  {
    title: "Identity",
    note: "Which question this row is, and which section it belongs to.",
    columns: ["id", "section", "topic", "difficulty"],
  },
  {
    title: "Content",
    note: "What the candidate sees.",
    columns: ["question", "code_block", "option_a", "option_b", "option_c", "option_d"],
  },
  {
    title: "Answer",
    note: "The key and the admin-only explanation.",
    columns: ["correct", "explanation"],
  },
  {
    title: "Learn-and-Apply",
    note: "Required for LRN rows, which are drawn as whole lessons.",
    columns: ["lesson_text"],
  },
  {
    title: "Internal",
    note: "Admin reference and authoring status. Never shown to candidates.",
    columns: ["verify_code", "marks", "status"],
  },
];

export function CsvReference() {
  return (
    <details className="group rounded-lg border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 lg:px-5">
        <span className="text-[13px] font-semibold text-ink">
          File format
          <span className="ml-2 font-normal text-muted">
            {SOURCE_COLUMNS.length} columns, in any order
          </span>
        </span>
        <span aria-hidden="true" className="text-[13px] text-muted">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>

      <div className="border-t border-line px-4 py-4 lg:px-5">
        <p className="text-[13px] text-ink-secondary">
          Accepts {ACCEPTED_EXTENSIONS.join(", ")}. The header row must contain these{" "}
          {SOURCE_COLUMNS.length} columns; <strong>their order does not matter</strong> and any
          other column is ignored. Header names are matched ignoring case and surrounding spaces.
          Columns marked <span className="text-muted">optional</span> may be blank.
        </p>

        <p className="mt-2 text-[13px] text-ink-secondary">
          Each row&rsquo;s <span className="font-mono text-xs">section</span> column decides which
          section it belongs to, so one file may hold several sections and you may upload as many
          files as you like at once. File names are never used to identify a section.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-[13px] font-medium text-ink">{group.title}</p>
              <p className="mt-0.5 text-xs text-muted">{group.note}</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {group.columns.map((column) => (
                  <li key={column}>
                    <Chip className="font-mono">
                      {column}
                      {OPTIONAL_COLUMNS.has(column as never) ? (
                        <span className="ml-1 font-sans font-normal text-muted">optional</span>
                      ) : null}
                    </Chip>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Accepted spellings come from the contract's own maps, so this list is
            exactly what the parser will accept. */}
        <dl className="mt-5 grid gap-x-6 gap-y-2 border-t border-line pt-4 text-[13px] sm:grid-cols-[8rem_minmax(0,1fr)]">
          <dt className="text-muted">section</dt>
          <dd className="text-xs text-ink-secondary">
            {SECTION_BLUEPRINT.map((entry) => (
              <span key={entry.code} className="mr-3 inline-block whitespace-nowrap">
                <span className="font-mono">{entry.code}</span>{" "}
                <span className="text-muted">{entry.name}</span>
              </span>
            ))}
          </dd>

          <dt className="text-muted">difficulty</dt>
          <dd className="font-mono text-xs text-ink-secondary">
            {describeAccepted(DIFFICULTY_VALUES)}
          </dd>

          <dt className="text-muted">correct</dt>
          <dd className="font-mono text-xs text-ink-secondary">a, b, c, d</dd>

          <dt className="text-muted">status</dt>
          <dd className="font-mono text-xs text-ink-secondary">{describeAccepted(STATUS_VALUES)}</dd>
        </dl>
      </div>
    </details>
  );
}
