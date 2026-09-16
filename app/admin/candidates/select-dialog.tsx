"use client";

import { useActionState, useRef, useState } from "react";

import { AlertTriangle, Download, FileSpreadsheet, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Td, Th, Tr } from "@/components/ui/table";
import { useActionToast } from "@/components/ui/toast";
import type { RowError } from "@/lib/candidate-selection-import/parse-selection";

import { importSelectedCandidatesAction, type ImportSelectedCandidatesState } from "./selection-actions";

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

/// A row error whose `field` is `"identity"` is an email/mobile conflict —
/// see lib/candidate-selection-import/select-candidates.ts. The exact
/// "Candidate not found…" message is the backend's one fixed wording for
/// that outcome (mirrored here the same way Phase 14's import-dialog.tsx
/// keys off the `"identity"` field for its own conflict rows), so the three
/// row-level outcomes — conflict, not found, everything else — can be told
/// apart in the UI without re-implementing any matching logic.
function isConflict(error: RowError): boolean {
  return error.field === "identity";
}

function isNotFound(error: RowError): boolean {
  return error.message.startsWith("Candidate not found in the Candidate table");
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
        <table className="w-full border-collapse text-left text-sm" style={{ minWidth: "560px" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <Th>Row</Th>
              <Th>Candidate</Th>
              <Th>Email</Th>
              <Th>Mobile</Th>
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
                <Td className="text-ink-secondary wrap-anywhere">{error.email ?? "—"}</Td>
                <Td className="tabular text-ink-secondary whitespace-nowrap">{error.mobile ?? "—"}</Td>
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
  selected,
  alreadySelected,
  notFound,
  conflicts,
  failed,
}: {
  totalRows: number;
  selected: number;
  alreadySelected: number;
  notFound: number;
  conflicts: number;
  failed: number;
}) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {(
        [
          ["Total rows", totalRows, "text-ink"],
          ["Newly selected", selected, "text-success"],
          // Already-selected is an idempotent no-op, not an error — it is
          // never given the warning/danger tone the other outcomes get.
          ["Already selected", alreadySelected, "text-ink"],
          ["Not found", notFound, notFound > 0 ? "text-warning" : "text-ink"],
          ["Conflicts", conflicts, conflicts > 0 ? "text-warning" : "text-ink"],
          ["Failed", failed, failed > 0 ? "text-danger" : "text-ink"],
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

/// The result of a completed import. Handles every combination the brief
/// calls out: full success (every row selected or already selected), partial
/// success (some rows succeeded, some not found/conflicted/failed), and zero
/// success (nothing newly selected and there are errors).
function ResultView({ state }: { state: Extract<ImportSelectedCandidatesState, { stage: "done" }> }) {
  const conflictErrors = state.errors.filter(isConflict);
  const notFoundErrors = state.errors.filter((error) => !isConflict(error) && isNotFound(error));
  const otherErrors = state.errors.filter((error) => !isConflict(error) && !isNotFound(error));

  const problemRows = state.notFound + state.conflicts + state.failed;
  const succeededRows = state.selected + state.alreadySelected;
  const nothingSelected = state.selected === 0 && state.alreadySelected === 0 && problemRows > 0;

  return (
    <div className="space-y-4">
      {nothingSelected ? (
        <Alert tone="danger" title="No candidates were selected">
          Every row was not found, conflicted, or failed. Fix the file and try again.
        </Alert>
      ) : problemRows > 0 ? (
        <Alert tone="warning" title="Import completed with some errors">
          {succeededRows} of {state.totalRows} row{state.totalRows === 1 ? "" : "s"} resolved to a
          selected candidate. The rest are listed below.
        </Alert>
      ) : (
        <Alert tone="success" title="Import completed">
          {state.selected} candidate{state.selected === 1 ? "" : "s"} newly selected
          {state.alreadySelected > 0 ? `, ${state.alreadySelected} already selected` : ""}.
        </Alert>
      )}

      <Counts
        totalRows={state.totalRows}
        selected={state.selected}
        alreadySelected={state.alreadySelected}
        notFound={state.notFound}
        conflicts={state.conflicts}
        failed={state.failed}
      />

      {conflictErrors.length > 0 ? (
        <div>
          <p className="mb-2 text-[13px] text-ink-secondary">
            These rows had an email and a mobile number that identify two different existing
            candidates. Nothing was selected automatically for these rows.
          </p>
          <ErrorTable
            errors={conflictErrors}
            title={`${conflictErrors.length} identity conflict${conflictErrors.length === 1 ? "" : "s"}`}
          />
        </div>
      ) : null}

      {notFoundErrors.length > 0 ? (
        <div>
          <p className="mb-2 text-[13px] text-ink-secondary">
            No matching candidate exists yet. No Candidate was created — a candidate must first
            exist through the live candidate import before they can be selected.
          </p>
          <ErrorTable
            errors={notFoundErrors}
            title={`${notFoundErrors.length} candidate${notFoundErrors.length === 1 ? "" : "s"} not found`}
          />
        </div>
      ) : null}

      {otherErrors.length > 0 ? (
        <ErrorTable errors={otherErrors} title={`${otherErrors.length} failed row${otherErrors.length === 1 ? "" : "s"}`} />
      ) : null}
    </div>
  );
}

/// A header/file-level validation failure — the whole file was rejected, no
/// row was ever attempted.
function InvalidView({ errors }: { errors: RowError[] }) {
  return (
    <div className="space-y-3">
      <Alert tone="danger" title="File validation failed">
        Nothing was selected. Fix the file and upload it again.
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
/// reset remounts `SelectCandidatesForm` (keyed on it below), which recreates
/// the `useActionState` hook fresh and so genuinely returns to `idle`.
export function SelectCandidatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [generation, setGeneration] = useState(0);

  return (
    <SelectCandidatesForm
      key={generation}
      open={open}
      onClose={onClose}
      onReset={() => setGeneration((value) => value + 1)}
    />
  );
}

function SelectCandidatesForm({
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
  const [state, formAction, importing] = useActionState<ImportSelectedCandidatesState, FormData>(
    importSelectedCandidatesAction,
    { stage: "idle" },
  );
  const [file, setFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useActionToast(state, (current) =>
    current.stage === "done" && current.notFound === 0 && current.conflicts === 0 && current.failed === 0
      ? {
          tone: "success",
          message: "Selected candidates import complete.",
          detail: `${current.selected} newly selected, ${current.alreadySelected} already selected.`,
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
    // real limit is enforced server-side in
    // lib/candidate-selection-import/selection-contract.ts and stays
    // authoritative regardless of what this check lets through.
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
      title="Import Selected Candidates"
      description="Upload a CSV or XLSX file containing candidates who should be selected for the exam."
    >
      {!showResult && !showInvalid ? (
        <div className="space-y-4">
          <Alert tone="info">
            Candidates are matched using <strong>Email Address2</strong>, with{" "}
            <strong>Mobile Number (WhatsApp)</strong> as a fallback. The <strong>Email address</strong>{" "}
            column is ignored.
          </Alert>

          <div className="rounded-lg border border-line bg-surface p-3 text-[13px]">
            <p className="font-medium text-ink">File requirements</p>
            <dl className="mt-2 space-y-1.5">
              <div>
                <dt className="inline font-medium text-ink-secondary">Required identity fields:</dt>{" "}
                <dd className="inline text-muted">
                  Email Address2 (Mobile Number (WhatsApp) may be used as fallback)
                </dd>
              </div>
              <div>
                <dt className="inline font-medium text-ink-secondary">Ignored:</dt>{" "}
                <dd className="inline text-muted">Email address</dd>
              </div>
              <div>
                <dt className="inline font-medium text-ink-secondary">Optional:</dt>{" "}
                <dd className="inline text-muted">Full Name</dd>
              </div>
            </dl>
            <p className="mt-2 text-muted">
              Full Name is never used for matching. This import never creates or updates Candidate
              records — it only marks existing candidates as selected for the exam.
            </p>
          </div>

          <form action={formAction}>
            <label htmlFor="selected-candidates-file" className="block text-[13px] font-medium text-ink">
              CSV or Excel file
            </label>
            <input
              ref={fileInput}
              id="selected-candidates-file"
              name="file"
              type="file"
              accept=".csv,.xlsx"
              required
              disabled={importing}
              aria-describedby="selected-candidates-hint"
              onChange={handleFileChange}
              className={[
                "mt-1.5 block w-full rounded-md border border-line-strong bg-surface text-sm text-ink",
                "file:mr-3 file:cursor-pointer file:border-0 file:border-r file:border-line-strong",
                "file:bg-subtle file:px-4 file:py-2 file:text-sm file:font-medium file:text-ink",
                "hover:file:bg-inset disabled:opacity-60",
              ].join(" ")}
            />
            <p id="selected-candidates-hint" className="mt-1.5 text-xs text-muted">
              .csv or .xlsx only.
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
                loadingLabel="Importing selected candidates…"
                icon={<Download aria-hidden="true" className="size-4" />}
              >
                Import Selected Candidates
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
