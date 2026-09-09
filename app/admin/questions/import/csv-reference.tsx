import { Chip } from "@/components/ui/badge";
import {
  CSV_COLUMNS,
  DIFFICULTY_VALUES,
  MAX_FILE_BYTES,
  OPTIONAL_COLUMNS,
  STATUS_VALUES,
  VALID_SECTIONS,
  describeAccepted,
} from "@/lib/question-bank/csv-contract";

/// The CSV contract, rendered.
///
/// Every value here is read from `csv-contract.ts` rather than retyped, so the
/// page cannot drift from the format the parser actually accepts. Adding a
/// column to the contract adds it here; nothing needs editing twice.

/// Grouping is presentational only — the parser requires all 19 columns in this
/// exact order regardless of how they are grouped for reading.
const GROUPS: { title: string; note: string; columns: string[] }[] = [
  {
    title: "Identity",
    note: "Which question this row is, and where it sits in the exam.",
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
    title: "Section 7 lesson",
    note: "Required for section 7, which is drawn as whole lessons.",
    columns: ["lesson_text", "lesson_group"],
  },
  {
    title: "Scoring",
    note: "Section 8 is unscored and carries 0 marks.",
    columns: ["scored", "marks"],
  },
  {
    title: "Review",
    note: "Verification flags and authoring status.",
    columns: ["ai_verified", "trainer_verified", "status"],
  },
];

export function CsvReference() {
  return (
    <details className="group rounded-lg border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 lg:px-5">
        <span className="text-[13px] font-semibold text-ink">
          CSV format
          <span className="ml-2 font-normal text-muted">
            {CSV_COLUMNS.length} columns, in this order
          </span>
        </span>
        <span aria-hidden="true" className="text-[13px] text-muted">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>

      <div className="border-t border-line px-4 py-4 lg:px-5">
        <p className="text-[13px] text-ink-secondary">
          The header row must contain exactly these {CSV_COLUMNS.length} columns. Columns marked{" "}
          <span className="text-muted">Optional</span> may be blank; every other column needs a
          value. Files are limited to {Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB.
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

        {/* Accepted spellings come from the contract's own maps, so this list
            is exactly what the parser will accept. */}
        <dl className="mt-5 grid gap-x-6 gap-y-2 border-t border-line pt-4 text-[13px] sm:grid-cols-[8rem_minmax(0,1fr)]">
          <dt className="text-muted">section</dt>
          <dd className="font-mono text-xs text-ink-secondary">{VALID_SECTIONS.join(", ")}</dd>

          <dt className="text-muted">difficulty</dt>
          <dd className="font-mono text-xs text-ink-secondary">
            {describeAccepted(DIFFICULTY_VALUES)}
          </dd>

          <dt className="text-muted">correct</dt>
          <dd className="font-mono text-xs text-ink-secondary">a, b, c, d</dd>

          <dt className="text-muted">status</dt>
          <dd className="font-mono text-xs text-ink-secondary">{describeAccepted(STATUS_VALUES)}</dd>

          <dt className="text-muted">scored, ai_verified, trainer_verified</dt>
          <dd className="font-mono text-xs text-ink-secondary">true, false, 1, 0, yes, no</dd>
        </dl>
      </div>
    </details>
  );
}
