"use client";

import { useActionState, useRef, useState } from "react";

import { AlertTriangle, FileSpreadsheet, Upload, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Td, Th, Tr } from "@/components/ui/table";
import { useActionToast } from "@/components/ui/toast";
import type { RowError } from "@/lib/candidate-import/parse-candidates";

import { importCandidatesFromCsv, type ImportCandidatesState } from "./import-actions";

/// How many row errors are listed before the rest are summarised as a count.
const ERROR_DISPLAY_LIMIT = 200;

const MAX_CLIENT_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".csv", ".xlsx"];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hasAcceptedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/// A row error whose `field` is `"identity"` is a conflict (see
/// lib/candidate-import/import-candidates.ts): email and mobile resolved to
/// two different existing candidates, and nothing was written for that row.
/// Every other row error is an ordinary validation failure.
function isConflict(error: RowError): boolean {
  return error.field === "identity";
}

function ErrorTable({ errors, title }: { errors: RowError[]; title: string }) {
  if (errors.length === 0) {
    return null;
  }

  const shown = errors.slice(0, ERROR_DISPLAY_LIMIT);
  const remaining = errors.length - shown.length;

  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
      </div>

      <div className="max-h-72 overflow-auto">
        <table className="w-full border-collapse text-left text-sm" style={{ minWidth: "480px" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <Th>Row</Th>
              <Th>Candidate</Th>
              <Th>Field</Th>
              <Th>Reason</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((error, index) => (
              <Tr key={index}>
                <Td className="tabular text-ink-secondary whitespace-nowrap">
                  {error.row > 0 ? error.row : "—"}
                </Td>
                <Td className="text-ink-secondary">{error.name ?? "—"}</Td>
                <Td className="font-mono text-xs text-ink-secondary">{error.field}</Td>
                <Td className="wrap-anywhere text-ink-secondary">{error.message}</Td>
              </Tr>
            ))}
          </tbody>
        </table>
      </div>

      {remaining > 0 ? (
        <p className="border-t border-line px-4 py-2.5 text-[13px] text-muted">
          …and {remaining} more.
        </p>
      ) : null}
    </div>
  );
}

/// The counts a completed import returned, presented as a compact grid.
function Counts({
  totalRows,
  created,
  updated,
  failed,
  conflicts,
}: {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  conflicts: number;
}) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {(
        [
          ["Total rows", totalRows, "text-ink"],
          ["Created", created, "text-success"],
          ["Updated", updated, "text-ink"],
          ["Failed", failed, failed > 0 ? "text-danger" : "text-ink"],
          ["Conflicts", conflicts, conflicts > 0 ? "text-warning" : "text-ink"],
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

/// The result of a completed import, once the server has responded. Handles
/// every combination the brief calls out: full success, partial success (some
/// rows failed but others imported), all rows failed, and failures that
/// include identity conflicts, which are shown in their own section so an
/// admin does not mistake "not merged" for "not imported yet".
function ResultView({ state }: { state: Extract<ImportCandidatesState, { stage: "done" }> }) {
  const conflictErrors = state.errors.filter(isConflict);
  const otherErrors = state.errors.filter((error) => !isConflict(error));
  const nothingImported = state.created === 0 && state.updated === 0 && state.failed > 0;

  return (
    <div className="space-y-4">
      {nothingImported ? (
        <Alert tone="danger" title="No candidates were imported">
          Every row failed validation. Fix the file and try again.
        </Alert>
      ) : state.failed > 0 ? (
        <Alert tone="warning" title="Import completed with some errors">
          {state.created + state.updated} of {state.totalRows} row
          {state.totalRows === 1 ? "" : "s"} imported successfully. The rest are listed below.
        </Alert>
      ) : (
        <Alert tone="success" title="Candidate import complete">
          {state.created} candidate{state.created === 1 ? "" : "s"} created and {state.updated}{" "}
          updated.
        </Alert>
      )}

      <Counts
        totalRows={state.totalRows}
        created={state.created}
        updated={state.updated}
        failed={state.failed}
        conflicts={conflictErrors.length}
      />

      {conflictErrors.length > 0 ? (
        <div>
          <p className="mb-2 text-[13px] text-ink-secondary">
            These rows matched two different existing candidates by email and mobile. Nothing was
            merged automatically — neither candidate was changed.
          </p>
          <ErrorTable errors={conflictErrors} title={`${conflictErrors.length} identity conflict${conflictErrors.length === 1 ? "" : "s"}`} />
        </div>
      ) : null}

      {otherErrors.length > 0 ? (
        <ErrorTable errors={otherErrors} title={`${otherErrors.length} failed row${otherErrors.length === 1 ? "" : "s"}`} />
      ) : null}
    </div>
  );
}

/// A header/file-level validation failure — the whole file was rejected, no
/// row was ever attempted. Distinct from `ResultView`'s row-level failures,
/// which happen after some rows already imported successfully.
function InvalidView({ errors }: { errors: RowError[] }) {
  return (
    <div className="space-y-3">
      <Alert tone="danger" title="File validation failed">
        Nothing was imported. Fix the file and upload it again.
      </Alert>

      <ul className="space-y-2 rounded-lg border border-line bg-surface p-4">
        {errors.map((error, index) => (
          <li key={index} className="flex gap-2 text-[13px]">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger" />
            <span className="wrap-anywhere text-ink-secondary">{error.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/// Owns the dialog's open/close state and the `key` that lets "Import another
/// file" actually start over. `useActionState`'s own result has no reset
/// method, and `reset()` used to only clear the local file/error state — the
/// result stayed on "done"/"invalid" forever, so the upload form never came
/// back without closing and reopening the dialog. Bumping `generation` on
/// reset remounts `ImportCandidatesForm` (keyed on it below), which recreates
/// the `useActionState` hook fresh and so genuinely returns to `idle`.
export function ImportCandidatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [generation, setGeneration] = useState(0);

  return (
    <ImportCandidatesForm
      key={generation}
      open={open}
      onClose={onClose}
      onReset={() => setGeneration((value) => value + 1)}
    />
  );
}

function ImportCandidatesForm({
  open,
  onClose,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  /// Remounts this component with a fresh `useActionState`, so a completed
  /// result does not linger after "Import another file".
  onReset: () => void;
}) {
  const [state, formAction, importing] = useActionState<ImportCandidatesState, FormData>(
    importCandidatesFromCsv,
    { stage: "idle" },
  );
  const [file, setFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useActionToast(state, (current) =>
    current.stage === "done" && current.failed === 0
      ? {
          tone: "success",
          message: "Candidate import complete.",
          detail: `${current.created} created, ${current.updated} updated.`,
        }
      : null,
  );

  const reset = () => {
    setFile(null);
    setClientError(null);
    if (fileInput.current) {
      fileInput.current.value = "";
    }
  };

  const handleClose = () => {
    if (importing) {
      // The dialog's own preventClose already blocks this while a request is
      // in flight; this is a defensive no-op for any caller that reaches here
      // anyway (e.g. a stray Escape queued before the state updated).
      return;
    }
    reset();
    onClose();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setClientError(null);
    setFile(null);

    if (!selected) {
      return;
    }

    if (!hasAcceptedExtension(selected.name)) {
      setClientError("Please select a CSV or Excel (.xlsx) file.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    if (selected.size === 0) {
      setClientError("The file contains no candidate records.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    // A client-side size check only spares an obviously-too-large upload; the
    // real limit is enforced server-side in lib/candidate-import/csv-contract.ts
    // and stays authoritative regardless of what this check lets through.
    if (selected.size > MAX_CLIENT_FILE_SIZE) {
      setClientError(
        `This file is too large (${formatBytes(selected.size)}). Maximum size is ${formatBytes(MAX_CLIENT_FILE_SIZE)}.`,
      );
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    setFile(selected);
  };

  const showResult = state.stage === "done";
  const showInvalid = state.stage === "invalid";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      preventClose={importing}
      title="Import candidates"
      description="Import candidate data from the live candidate sheet (CSV or Excel)."
    >
      {!showResult && !showInvalid ? (
        <div className="space-y-4">
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-secondary">
            <li>CSV or Excel (.xlsx) files.</li>
            <li>Imports candidate profile and application data.</li>
            <li>Existing candidates may be updated; duplicates are not created.</li>
            <li>Candidates are <strong>not</strong> automatically selected for an exam by this import.</li>
          </ul>

          <form action={formAction}>
            <label htmlFor="candidate-csv-file" className="block text-[13px] font-medium text-ink">
              CSV or Excel file
            </label>
            <input
              ref={fileInput}
              id="candidate-csv-file"
              name="file"
              type="file"
              accept=".csv,.xlsx"
              required
              disabled={importing}
              aria-describedby="candidate-csv-hint"
              onChange={handleFileChange}
              className={[
                "mt-1.5 block w-full rounded-md border border-line-strong bg-surface text-sm text-ink",
                "file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-line-strong",
                "file:bg-subtle file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink",
                "hover:file:bg-inset disabled:opacity-60",
              ].join(" ")}
            />
            <p id="candidate-csv-hint" className="mt-1.5 text-xs text-muted">
              .csv or .xlsx, using the live candidate sheet&rsquo;s column format.
            </p>

            <div aria-live="polite">
              {clientError ? (
                <p className="mt-3 flex gap-1.5 text-[13px] text-danger">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <span>{clientError}</span>
                </p>
              ) : file ? (
                <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-subtle px-3 py-2">
                  <FileSpreadsheet aria-hidden="true" className="size-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{file.name}</span>
                  <span className="shrink-0 text-xs text-muted tabular">{formatBytes(file.size)}</span>
                  <button
                    type="button"
                    onClick={reset}
                    disabled={importing}
                    aria-label="Remove selected file"
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-inset hover:text-ink disabled:cursor-not-allowed"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                variant="primary"
                disabled={!file || Boolean(clientError)}
                loading={importing}
                loadingLabel="Importing candidates…"
                icon={<Upload aria-hidden="true" className="size-4" />}
              >
                Import candidates
              </Button>
              <Button type="button" variant="secondary" onClick={handleClose} disabled={importing}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {showInvalid ? (
        <div className="space-y-4">
          <InvalidView errors={state.errors} />
          <Button type="button" variant="secondary" onClick={onReset}>
            Choose a different file
          </Button>
        </div>
      ) : null}

      {showResult ? (
        <div className="space-y-4">
          <ResultView state={state} />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="primary" onClick={handleClose}>
              Close
            </Button>
            <Button type="button" variant="secondary" onClick={onReset}>
              Import another file
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
