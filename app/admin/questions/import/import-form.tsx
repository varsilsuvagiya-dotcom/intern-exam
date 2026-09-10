"use client";

import { useActionState, useRef, useState } from "react";

import Link from "next/link";
import { AlertTriangle, Check, FileSpreadsheet, Upload, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonClass } from "@/components/ui/button";
import { Td, Th, Tr } from "@/components/ui/table";
import { useActionToast } from "@/components/ui/toast";
import type { RowError, SkippedSheet } from "@/lib/question-bank/csv-import";

import { confirmImport, previewImport, type ImportState } from "./actions";

/// How many errors are listed before the rest are summarised as a count. The
/// action already returns every error; this only caps what is rendered, which
/// is what the previous implementation did too.
const ERROR_DISPLAY_LIMIT = 100;

const STEPS = ["Upload", "Review", "Done"] as const;
type Step = (typeof STEPS)[number];

/// Where the workflow currently stands. Derived from the action state — there
/// is no separate step state to fall out of sync with what the server returned.
function stepFor(state: ImportState): Step {
  if (state.stage === "done") {
    return "Done";
  }
  return state.stage === "preview" ? "Review" : "Upload";
}

function StepIndicator({ current }: { current: Step }) {
  const index = STEPS.indexOf(current);

  return (
    // A position display, not a control: the stages are reached by acting, so
    // there is nothing here to click.
    <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
      {STEPS.map((step, position) => {
        const done = position < index;
        const active = position === index;

        return (
          <li key={step} className="flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1",
                active
                  ? "bg-primary-subtle font-medium text-primary"
                  : done
                    ? "text-ink-secondary"
                    : "text-disabled",
              ].join(" ")}
            >
              {done ? (
                <Check aria-hidden="true" className="size-3.5" />
              ) : (
                <span aria-hidden="true" className="tabular">
                  {position + 1}
                </span>
              )}
              {step}
              {active ? <span className="sr-only"> (current step)</span> : null}
            </span>
            {position < STEPS.length - 1 ? (
              <span aria-hidden="true" className="text-disabled">
                /
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/// The counts the action returned, presented. Nothing is derived or recomputed:
/// `created` and `updated` come from the server, which knows which ids already
/// exist. A CSV import never deletes, so no removal count exists to show.
function Counts({
  total,
  created,
  updated,
}: {
  total: number;
  created: number;
  updated: number;
}) {
  return (
    <dl className="grid grid-cols-3 gap-3">
      {(
        [
          ["Rows", total, "text-ink"],
          ["New questions", created, "text-success"],
          ["Updated", updated, "text-ink"],
        ] as const
      ).map(([label, value, tone]) => (
        <div key={label} className="rounded-md border border-line bg-surface px-3 py-2">
          <dt className="text-xs text-muted">{label}</dt>
          <dd className={`mt-0.5 text-xl leading-7 font-semibold tabular ${tone}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/// Errors grouped by where they were found, rather than as one flat list: an
/// admin fixing a spreadsheet works a row at a time, and an import may span
/// several files and sheets so the row number alone identifies nothing.
type ErrorGroup = { key: string; label: string; errors: RowError[] };

function describeLocation(error: RowError): string {
  const parts: string[] = [];

  if (error.file) parts.push(error.file);
  if (error.sheet) parts.push(`sheet ${error.sheet}`);
  // Row 0 is the file itself rather than a spreadsheet row.
  parts.push(error.row > 0 ? `row ${error.row}` : "file");

  return parts.join(" · ");
}

function groupErrors(errors: RowError[]): ErrorGroup[] {
  const groups: ErrorGroup[] = [];

  for (const error of errors) {
    const key = describeLocation(error);
    const existing = groups.find((group) => group.key === key);

    if (existing) {
      existing.errors.push(error);
      continue;
    }

    groups.push({ key, label: key, errors: [error] });
  }

  return groups;
}

/// Sheets that were read but are not question sheets. A workbook often carries
/// a working copy beside the real data; saying so is what stops a skipped sheet
/// looking like data that quietly went missing.
function SkippedList({ skipped }: { skipped: SkippedSheet[] }) {
  if (skipped.length === 0) {
    return null;
  }

  return (
    <Alert tone="info" title={`${skipped.length} sheet${skipped.length === 1 ? "" : "s"} skipped`}>
      <ul className="mt-1 space-y-1">
        {skipped.map((entry) => (
          <li key={`${entry.file}-${entry.sheet}`} className="text-[13px] wrap-anywhere">
            <span className="font-medium">{entry.file}</span>
            {entry.sheet ? <span className="text-muted"> · sheet {entry.sheet}</span> : null}
            <span className="text-ink-secondary"> — {entry.reason}</span>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

function ErrorList({ errors }: { errors: RowError[] }) {
  const shown = errors.slice(0, ERROR_DISPLAY_LIMIT);
  const groups = groupErrors(shown);
  const remaining = errors.length - shown.length;

  return (
    <div className="rounded-lg border border-danger/30 bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold text-danger">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          {errors.length} problem{errors.length === 1 ? "" : "s"} found
        </h2>
        <p className="mt-1 text-[13px] text-ink-secondary">
          Nothing was imported. Fix the files and upload them again.
        </p>
      </div>

      <ul className="divide-y divide-line">
        {groups.map((group) => (
          <li key={group.key} className="px-4 py-2.5">
            <p className="text-[13px] font-medium wrap-anywhere text-ink">{group.label}</p>
            <ul className="mt-1 space-y-1">
              {group.errors.map((error, index) => (
                <li key={index} className="text-[13px] text-ink-secondary">
                  <span className="font-mono text-xs text-muted">{error.field}</span>
                  <span className="mx-1.5 text-disabled" aria-hidden="true">
                    —
                  </span>
                  <span className="wrap-anywhere">{error.message}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {remaining > 0 ? (
        <p className="border-t border-line px-4 py-2.5 text-[13px] text-muted">
          …and {remaining} more problem{remaining === 1 ? "" : "s"}.
        </p>
      ) : null}
    </div>
  );
}

export function ImportForm() {
  const [preview, previewAction, previewing] = useActionState<ImportState, FormData>(
    previewImport,
    { stage: "idle" },
  );
  const [result, confirmAction, importing] = useActionState<ImportState, FormData>(
    confirmImport,
    { stage: "idle" },
  );
  const [fileNames, setFileNames] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  // Unchanged from the previous implementation: the confirm result takes over
  // once it exists, otherwise the preview state drives the page.
  const state = result.stage === "idle" ? preview : result;
  const step = stepFor(state);

  // Derived from the action's own returned state, so a toast cannot announce a
  // success the server did not report.
  useActionToast(result, (current) =>
    current.stage === "done"
      ? {
          tone: "success",
          message: "Import complete.",
          detail: `${current.created} created, ${current.updated} updated.`,
        }
      : null,
  );

  const clearFiles = () => {
    setFileNames([]);
    if (fileInput.current) {
      fileInput.current.value = "";
    }
  };

  return (
    <div>
      <StepIndicator current={step} />

      {/* The upload form stays mounted through every stage: re-uploading is how
          an admin recovers from an error or starts another import. */}
      <form action={previewAction} className="rounded-lg border border-line bg-surface p-4 lg:p-5">
        <h2 className="text-[13px] font-semibold text-ink">Choose question files</h2>
        <p className="mt-1 text-[13px] text-muted">
          Select one or more files. Each row&rsquo;s section column decides where it belongs, so a
          file may hold several sections. Everything is checked first, and nothing is written to
          the question bank until you confirm.
        </p>

        {/* The real file input, styled rather than hidden: replacing it with a
            button that proxies clicks loses keyboard and assistive-tech
            behaviour that the native control already has. */}
        <div className="mt-4">
          <label htmlFor="files" className="block text-[13px] font-medium text-ink">
            Question files
          </label>
          <input
            ref={fileInput}
            id="files"
            name="files"
            type="file"
            multiple
            accept=".csv,.xls,.xlsx"
            required
            aria-describedby="file-hint"
            onChange={(event) =>
              setFileNames(Array.from(event.target.files ?? [], (file) => file.name))
            }
            className={[
              "mt-1.5 block w-full rounded-md border border-line-strong bg-surface text-sm text-ink",
              "file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-line-strong",
              "file:bg-subtle file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink",
              "hover:file:bg-inset",
            ].join(" ")}
          />
          <p id="file-hint" className="mt-1.5 text-xs text-muted">
            .csv, .xls or .xlsx, using the column format below. Column order does not matter.
          </p>
        </div>

        {/* Announced politely: the filename appears without interrupting. */}
        <div aria-live="polite">
          {fileNames.length > 0 ? (
            <div className="mt-3 rounded-md border border-line bg-subtle px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <FileSpreadsheet aria-hidden="true" className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 text-[13px] text-ink">
                  <span className="text-muted">Selected: </span>
                  {fileNames.length} file{fileNames.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={clearFiles}
                  className="inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors duration-[120ms] hover:bg-inset hover:text-ink max-md:size-11"
                  aria-label="Remove selected files"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
              <ul className="mt-1.5 space-y-0.5">
                {fileNames.map((name) => (
                  <li key={name} className="text-[13px] wrap-anywhere text-ink-secondary">
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <Button
            type="submit"
            variant="primary"
            loading={previewing}
            loadingLabel="Checking…"
            icon={<Upload aria-hidden="true" className="size-4" />}
          >
            Upload and preview
          </Button>
        </div>
      </form>

      {state.stage === "invalid" ? (
        <div className="mt-4 space-y-4">
          <SkippedList skipped={state.skipped} />
          <ErrorList errors={state.errors} />
        </div>
      ) : null}

      {state.stage === "preview" ? (
        <section aria-labelledby="review-heading" className="mt-4">
          <h2 id="review-heading" className="sr-only">
            Review
          </h2>

          <Alert tone="info">
            No problems found. Review the rows below, then import. Existing question IDs are
            updated; new IDs are created. Nothing is ever deleted by an import.
          </Alert>

          {state.skipped.length > 0 ? (
            <div className="mt-4">
              <SkippedList skipped={state.skipped} />
            </div>
          ) : null}

          <div className="mt-4">
            <Counts total={state.total} created={state.created} updated={state.updated} />
          </div>

          {/* What the upload actually contained, by section. The sections come
              from the rows themselves, never from a file name. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13px]">
            <span className="text-muted">
              {state.fileCount} file{state.fileCount === 1 ? "" : "s"} ·
            </span>
            {state.sections.map((entry) => (
              <span
                key={entry.sectionCode}
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-subtle px-2 py-0.5"
              >
                <span className="font-mono text-xs text-ink">{entry.sectionCode}</span>
                <span className="tabular text-muted">{entry.count}</span>
              </span>
            ))}
          </div>

          <div className="mt-4">
            {/* Kept scrollable in both directions with its own sticky header,
                as before. The page itself never scrolls sideways. */}
            <div className="max-h-[28rem] overflow-auto rounded-lg border border-line bg-surface">
              <table
                className="w-full border-collapse text-left text-sm"
                style={{ minWidth: "980px" }}
              >
                <thead className="sticky top-0 z-10">
                  <tr>
                    <Th>ID</Th>
                    <Th>Section</Th>
                    <Th>Topic</Th>
                    <Th>Question</Th>
                    <Th>Difficulty</Th>
                    <Th>Correct</Th>
                    <Th align="right">Marks</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {state.rows.map((row) => (
                    <Tr key={row.id}>
                      <Td className="font-mono text-xs whitespace-nowrap text-ink-secondary">
                        {row.id}
                      </Td>
                      <Td className="font-mono text-xs text-ink-secondary">{row.sectionCode}</Td>
                      <Td className="text-ink-secondary">{row.topic}</Td>
                      <Td>
                        <span className="line-clamp-2 max-w-[360px] text-ink">{row.question}</span>
                      </Td>
                      <Td className="text-ink-secondary">{row.difficulty}</Td>
                      <Td className="text-ink-secondary uppercase">{row.correct}</Td>
                      <Td align="right" className="text-ink-secondary tabular">
                        {row.marks}
                      </Td>
                      <Td className="text-ink-secondary">{row.status}</Td>
                    </Tr>
                  ))}
                </tbody>
              </table>
            </div>

            {state.total > state.rows.length ? (
              <p className="mt-2 text-[13px] text-muted">
                Showing the first {state.rows.length} of {state.total} rows. All {state.total} will
                be imported.
              </p>
            ) : null}
          </div>

          <form action={confirmAction} className="mt-4 flex flex-wrap items-center gap-3">
            {/* The batch round-trips through the browser, so the server rebuilds
                and re-validates every row before writing; nothing returned here
                is trusted. */}
            <input type="hidden" name="payload" value={state.payload} />
            <Button type="submit" variant="primary" loading={importing} loadingLabel="Importing…">
              Import {state.total} question{state.total === 1 ? "" : "s"}
            </Button>
            <Button type="button" variant="tertiary" onClick={clearFiles} disabled={importing}>
              Choose a different file
            </Button>
          </form>
        </section>
      ) : null}

      {state.stage === "done" ? (
        <section aria-labelledby="done-heading" className="mt-4">
          <h2 id="done-heading" className="sr-only">
            Import complete
          </h2>

          <Alert tone="success" title="Import complete">
            {state.created} question{state.created === 1 ? "" : "s"} created and {state.updated}{" "}
            updated. Papers candidates have already sat are unaffected.
          </Alert>

          <div className="mt-4">
            <Counts total={state.total} created={state.created} updated={state.updated} />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/admin/questions" className={buttonClass("primary")}>
              View question bank
            </Link>
            <Button type="button" variant="secondary" onClick={clearFiles}>
              Import another file
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
