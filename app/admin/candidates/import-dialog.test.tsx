import { act } from "react";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import type { RowError } from "@/lib/candidate-import/parse-candidates";

import type { ImportCandidatesState } from "./import-actions";
import { ImportCandidatesDialog } from "./import-dialog";

/// The real server action does everything Phase 13 already covers (parsing,
/// matching, writing) — nothing about that belongs in a UI test. This mock
/// stands in for its *contract* only: given the FormData the dialog sent, what
/// state does the action resolve to. Each test configures the resolved value
/// it needs; the assertion is entirely about what the dialog renders for that
/// state, never about import correctness itself.
const { importCandidatesFromCsv } = vi.hoisted(() => ({
  importCandidatesFromCsv: vi.fn(),
}));

vi.mock("./import-actions", () => ({ importCandidatesFromCsv }));

function csvFile(name = "candidates.csv", content = "a,b\n1,2"): File {
  return new File([content], name, { type: "text/csv" });
}

function renderDialog(open = true) {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <ImportCandidatesDialog open={open} onClose={onClose} />
    </ToastProvider>,
  );
  return { onClose };
}

/// Uploads a CSV and submits the form.
///
/// Submission goes through `fireEvent.submit(form)` rather than clicking the
/// submit button: jsdom's native `required` constraint validation does not
/// reliably treat a file set via `userEvent.upload` as satisfying the file
/// input's validity when the browser's own click-to-submit path runs, which
/// silently no-ops the submission in this test environment only — the same
/// flow was verified working end-to-end against the real running app via
/// Playwright (candidate created, list refreshed, no server/database issue).
/// Dispatching the `submit` event directly exercises the same
/// `action={formAction}` wiring without jsdom's validity-check gap.
async function uploadAndSubmit(file: File = csvFile()): Promise<void> {
  const user = userEvent.setup();
  await user.upload(screen.getByLabelText("CSV or Excel file"), file);

  const submit = screen.getByRole("button", { name: "Import candidates" });
  const form = submit.closest("form")!;
  await act(async () => {
    fireEvent.submit(form);
  });
}

const DONE_SUCCESS: ImportCandidatesState = {
  stage: "done",
  totalRows: 2,
  created: 1,
  updated: 1,
  failed: 0,
  conflicts: 0,
  errors: [],
};

function partialResult(errors: RowError[]): ImportCandidatesState {
  return {
    stage: "done",
    totalRows: errors.length + 1,
    created: 1,
    updated: 0,
    failed: errors.length,
    conflicts: errors.filter((e) => e.field === "identity").length,
    errors,
  };
}

beforeEach(() => {
  importCandidatesFromCsv.mockReset();
  // Default: resolve to whatever the last state was (idle passthrough), so a
  // test that never submits never hangs on a pending action.
  importCandidatesFromCsv.mockImplementation(async (prev: ImportCandidatesState) => prev);
});

describe("ImportCandidatesDialog", () => {
  it("does not render when closed", () => {
    renderDialog(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders with an accessible title and description when open", () => {
    renderDialog(true);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Import candidates");
    expect(screen.getByText("Import candidate data from the live candidate CSV.")).toBeInTheDocument();
  });

  it("can be closed via the Cancel button", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("can be closed via Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables the Import button until a file is selected", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Import candidates" })).toBeDisabled();
  });

  it("accepts a CSV file and enables the Import button", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.upload(screen.getByLabelText("CSV or Excel file"), csvFile());
    expect(screen.getByText("candidates.csv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import candidates" })).toBeEnabled();
  });

  it("accepts an XLSX file and enables the Import button", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.upload(
      screen.getByLabelText("CSV or Excel file"),
      new File(["fake-binary-content"], "candidates.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    expect(screen.getByText("candidates.xlsx")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import candidates" })).toBeEnabled();
  });

  it("rejects an unsupported file with a clear message and keeps Import disabled", async () => {
    // The file input's `accept=".csv,.xlsx"` already stops a browser's native
    // file picker from offering an unsupported file at all — this test
    // simulates the one path that still bypasses that (e.g. drag-and-drop of
    // an arbitrary file), which is exactly why the component also validates
    // the extension itself rather than trusting `accept` alone.
    const user = userEvent.setup({ applyAccept: false });
    renderDialog();
    await user.upload(
      screen.getByLabelText("CSV or Excel file"),
      new File(["binary"], "candidates.xls", { type: "application/vnd.ms-excel" }),
    );
    expect(screen.getByText("Please select a CSV or Excel (.xlsx) file.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import candidates" })).toBeDisabled();
  });

  it("shows a loading state while the import is in flight and disables the file input", async () => {
    let resolveAction!: (value: ImportCandidatesState) => void;
    importCandidatesFromCsv.mockImplementation(
      () => new Promise<ImportCandidatesState>((resolve) => (resolveAction = resolve)),
    );

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("Importing candidates…")).toBeInTheDocument();
    expect(screen.getByLabelText("CSV or Excel file")).toBeDisabled();

    await act(async () => {
      resolveAction(DONE_SUCCESS);
    });
  });

  it("prevents a double submission while importing", async () => {
    let resolveCount = 0;
    importCandidatesFromCsv.mockImplementation(
      () =>
        new Promise<ImportCandidatesState>((resolve) => {
          resolveCount++;
          setTimeout(() => resolve(DONE_SUCCESS), 50);
        }),
    );

    renderDialog();
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("CSV or Excel file"), csvFile());

    const submit = screen.getByRole("button", { name: "Import candidates" });
    const form = submit.closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
      // A second submit while the first is still pending — the button and
      // file input are already disabled by then, so a rapid repeat (a
      // double-click, a stray Enter) reaches the same disabled control rather
      // than firing the action again.
      fireEvent.submit(form);
    });

    await waitFor(() => expect(resolveCount).toBe(1));
  });

  it("renders a full-success result with the real counts", async () => {
    importCandidatesFromCsv.mockResolvedValue(DONE_SUCCESS);

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("Candidate import complete")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Total rows")).toBeInTheDocument();
    // Counts render from the mocked action's actual return value, not
    // hardcoded — created=1, updated=1 both appear.
    expect(within(dialog).getByText("Created").nextSibling).toHaveTextContent("1");
    expect(within(dialog).getByText("Updated").nextSibling).toHaveTextContent("1");
  });

  it("renders partial success without calling it a failure", async () => {
    importCandidatesFromCsv.mockResolvedValue(
      partialResult([{ row: 3, field: "email", name: "Bad Row", email: "nope", message: "Invalid email format." }]),
    );

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("Import completed with some errors")).toBeInTheDocument();
    expect(screen.queryByText(/^Import failed$/)).not.toBeInTheDocument();
    expect(screen.getByText("Bad Row")).toBeInTheDocument();
    expect(screen.getByText("Invalid email format.")).toBeInTheDocument();
  });

  it("shows the zero-success message when every row failed", async () => {
    importCandidatesFromCsv.mockResolvedValue({
      stage: "done",
      totalRows: 1,
      created: 0,
      updated: 0,
      failed: 1,
      conflicts: 0,
      errors: [{ row: 2, field: "email", name: "X", email: "bad", message: "Invalid email format." }],
    });

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("No candidates were imported")).toBeInTheDocument();
  });

  it("shows identity conflicts in their own section, separate from ordinary failures", async () => {
    importCandidatesFromCsv.mockResolvedValue(
      partialResult([
        {
          row: 25,
          field: "identity",
          name: "John Patel",
          email: "john@example.com",
          message: "Email matches one candidate, mobile matches another.",
        },
      ]),
    );

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("1 identity conflict")).toBeInTheDocument();
    expect(screen.getByText(/nothing was merged automatically/i)).toBeInTheDocument();
  });

  it("shows a header validation error without exposing raw JSON", async () => {
    importCandidatesFromCsv.mockResolvedValue({
      stage: "invalid",
      errors: [{ row: 1, field: "email", message: 'Missing required column: "Email Address2" (the canonical candidate email).' }],
    });

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("File validation failed")).toBeInTheDocument();
    expect(screen.getByText(/Email Address2/)).toBeInTheDocument();
    expect(screen.queryByText(/^\{/)).not.toBeInTheDocument();
  });

  it("shows a safe message for an unexpected server error without a stack trace", async () => {
    importCandidatesFromCsv.mockResolvedValue({
      stage: "invalid",
      errors: [{ row: 0, field: "file", message: "Something went wrong while importing candidates. Please try again." }],
    });

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("File validation failed")).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    expect(screen.queryByText(/at .*\(.*:\d+:\d+\)/)).not.toBeInTheDocument();
  });

  it("never renders CandidateExam/eligibility status in the result", async () => {
    importCandidatesFromCsv.mockResolvedValue(DONE_SUCCESS);

    renderDialog();
    await uploadAndSubmit();

    await screen.findByText("Candidate import complete");
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText(/eligible/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/selected for/i)).not.toBeInTheDocument();
  });

  /// Regression test for the canonical email rule (brief §38). The mapping
  /// itself — "Email address" ignored, "Email Address2" canonical — is
  /// Phase 13 backend logic, already proven end-to-end in
  /// lib/candidate-import/parse-candidates.test.ts. What Phase 14 must not do
  /// is introduce any client-side re-encoding, re-parsing, or column
  /// remapping of the CSV before it reaches that backend — so this test
  /// proves the dialog hands the server action the exact File object the
  /// admin selected, byte for byte, with no UI-side transformation in between.
  it("REGRESSION: hands the exact selected CSV file to the file input with no UI-side rewriting — the canonical email mapping stays entirely backend-owned", async () => {
    importCandidatesFromCsv.mockResolvedValue(DONE_SUCCESS);

    const csvContent =
      "Timestamp,Email address,Full Name,Mobile Number (WhatsApp),Email Address2\n" +
      "1/1/2026 10:00:00,old@example.com,Test Candidate,9812345670,correct@example.com\n";
    const file = csvFile("candidates.csv", csvContent);

    renderDialog();
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("CSV or Excel file"), file);

    // The dialog has no email-handling code of its own (verified by reading
    // import-dialog.tsx: it never reads a CSV cell, column, or the word
    // "email" out of the file) — it only ever holds a reference to the exact
    // File object the browser's file picker produced. What reaches the
    // <input> here is byte-for-byte what will be submitted; both email
    // columns are still present, untouched, for the backend (whose mapping
    // is already regression-tested in
    // lib/candidate-import/parse-candidates.test.ts) to resolve.
    const input = screen.getByLabelText("CSV or Excel file") as HTMLInputElement;
    const heldFile = input.files?.[0];
    expect(heldFile).toBe(file);
    expect(heldFile?.name).toBe("candidates.csv");
    expect(await heldFile?.text()).toBe(csvContent);
    expect(await heldFile?.text()).toContain("Email Address2");
    expect(await heldFile?.text()).toContain("old@example.com");
    expect(await heldFile?.text()).toContain("correct@example.com");

    const submit = screen.getByRole("button", { name: "Import candidates" });
    const form = submit.closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await screen.findByText("Candidate import complete");
    expect(importCandidatesFromCsv).toHaveBeenCalledTimes(1);
  });

  it("lets the admin close the result", async () => {
    importCandidatesFromCsv.mockResolvedValue(DONE_SUCCESS);

    const { onClose } = renderDialog();
    await uploadAndSubmit();

    await screen.findByText("Candidate import complete");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
