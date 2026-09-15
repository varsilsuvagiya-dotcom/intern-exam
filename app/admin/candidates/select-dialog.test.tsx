import { act } from "react";

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/toast";
import type { RowError } from "@/lib/candidate-selection-import/parse-selection";

import type { ImportSelectedCandidatesState } from "./selection-actions";
import { SelectCandidatesDialog } from "./select-dialog";

/// The real server action does everything Phase 15 already covers (parsing,
/// matching, writing) — nothing about that belongs in a UI test. This mock
/// stands in for its *contract* only: given the FormData the dialog sent,
/// what state does the action resolve to. Each test configures the resolved
/// value it needs; the assertion is entirely about what the dialog renders
/// for that state, never about matching correctness itself (already covered
/// by lib/candidate-selection-import's own tests).
const { importSelectedCandidatesAction } = vi.hoisted(() => ({
  importSelectedCandidatesAction: vi.fn(),
}));

vi.mock("./selection-actions", () => ({ importSelectedCandidatesAction }));

function csvFile(name = "selected.csv", content = "a,b\n1,2"): File {
  return new File([content], name, { type: "text/csv" });
}

function xlsxFile(name = "selected.xlsx"): File {
  return new File(["fake-binary-content"], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function renderDialog(open = true) {
  const onClose = vi.fn();
  render(
    <ToastProvider>
      <SelectCandidatesDialog open={open} onClose={onClose} />
    </ToastProvider>,
  );
  return { onClose };
}

/// Uploads a file and submits the form. See import-dialog.test.tsx's
/// `uploadAndSubmit` for why `fireEvent.submit` is used instead of clicking
/// the submit button: jsdom's `required` constraint validation does not
/// reliably treat a file set via `userEvent.upload` as satisfying validity on
/// the native click-to-submit path — a test-environment-only gap, verified
/// not to affect the real app via Playwright against the running server.
async function uploadAndSubmit(file: File = csvFile()): Promise<void> {
  const user = userEvent.setup();
  await user.upload(screen.getByLabelText("CSV or Excel file"), file);

  const submit = screen.getByRole("button", { name: "Import Selected Candidates" });
  const form = submit.closest("form")!;
  await act(async () => {
    fireEvent.submit(form);
  });
}

const DONE_SUCCESS: ImportSelectedCandidatesState = {
  stage: "done",
  totalRows: 2,
  selected: 2,
  alreadySelected: 0,
  notFound: 0,
  conflicts: 0,
  failed: 0,
  errors: [],
};

function partialResult(overrides: Partial<ImportSelectedCandidatesState>, errors: RowError[]): ImportSelectedCandidatesState {
  return {
    stage: "done",
    totalRows: errors.length + 1,
    selected: 1,
    alreadySelected: 0,
    notFound: 0,
    conflicts: 0,
    failed: 0,
    errors,
    ...overrides,
  };
}

beforeEach(() => {
  importSelectedCandidatesAction.mockReset();
  importSelectedCandidatesAction.mockImplementation(async (prev: ImportSelectedCandidatesState) => prev);
});

describe("SelectCandidatesDialog", () => {
  it("does not render when closed", () => {
    renderDialog(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders with the correct title and description", () => {
    renderDialog(true);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Import Selected Candidates");
    expect(
      screen.getByText("Upload a CSV or XLSX file containing candidates who should be selected for the exam."),
    ).toBeInTheDocument();
  });

  it("shows the correct email/mobile contract note", () => {
    renderDialog();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Email Address2")).toBeInTheDocument();
    expect(within(dialog).getByText("Mobile Number (WhatsApp)")).toBeInTheDocument();
    // "Email address" (ignored) appears exactly as its own distinct mention,
    // never presented as the canonical column.
    expect(within(dialog).getAllByText("Email address").length).toBeGreaterThan(0);
  });

  it("can be closed via the Cancel button", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("can be closed via Escape when not importing", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables the Import button until a file is selected", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Import Selected Candidates" })).toBeDisabled();
  });

  it("accepts a CSV file", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.upload(screen.getByLabelText("CSV or Excel file"), csvFile());
    expect(screen.getByText("selected.csv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Selected Candidates" })).toBeEnabled();
  });

  it("accepts an XLSX file", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.upload(screen.getByLabelText("CSV or Excel file"), xlsxFile());
    expect(screen.getByText("selected.xlsx")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Selected Candidates" })).toBeEnabled();
  });

  it("rejects a legacy .xls file with a clear message", async () => {
    // The file input's accept=".csv,.xlsx" already stops a native picker
    // offering .xls; applyAccept:false simulates a bypass (drag-and-drop),
    // which is why the component validates the extension itself too.
    const user = userEvent.setup({ applyAccept: false });
    renderDialog();
    await user.upload(
      screen.getByLabelText("CSV or Excel file"),
      new File(["binary"], "selected.xls", { type: "application/vnd.ms-excel" }),
    );
    expect(screen.getByText("Please select a CSV or Excel (.xlsx) file.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Selected Candidates" })).toBeDisabled();
  });

  it("rejects an empty file", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.upload(screen.getByLabelText("CSV or Excel file"), new File([], "empty.csv", { type: "text/csv" }));
    expect(screen.getByText("The file contains no candidate records.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Selected Candidates" })).toBeDisabled();
  });

  it("lets the admin replace a selected file", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.upload(screen.getByLabelText("CSV or Excel file"), csvFile("first.csv"));
    expect(screen.getByText("first.csv")).toBeInTheDocument();

    await user.upload(screen.getByLabelText("CSV or Excel file"), csvFile("second.csv"));
    expect(screen.getByText("second.csv")).toBeInTheDocument();
    expect(screen.queryByText("first.csv")).not.toBeInTheDocument();
  });

  it("lets the admin remove a selected file", async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.upload(screen.getByLabelText("CSV or Excel file"), csvFile());
    expect(screen.getByText("selected.csv")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove selected file" }));
    expect(screen.queryByText("selected.csv")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Selected Candidates" })).toBeDisabled();
  });

  it("shows a loading state while the import is in flight and disables the file input", async () => {
    let resolveAction!: (value: ImportSelectedCandidatesState) => void;
    importSelectedCandidatesAction.mockImplementation(
      () => new Promise<ImportSelectedCandidatesState>((resolve) => (resolveAction = resolve)),
    );

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("Importing selected candidates…")).toBeInTheDocument();
    expect(screen.getByLabelText("CSV or Excel file")).toBeDisabled();

    await act(async () => {
      resolveAction(DONE_SUCCESS);
    });
  });

  it("prevents a double submission while importing", async () => {
    let resolveCount = 0;
    importSelectedCandidatesAction.mockImplementation(
      () =>
        new Promise<ImportSelectedCandidatesState>((resolve) => {
          resolveCount++;
          setTimeout(() => resolve(DONE_SUCCESS), 50);
        }),
    );

    renderDialog();
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("CSV or Excel file"), csvFile());

    const submit = screen.getByRole("button", { name: "Import Selected Candidates" });
    const form = submit.closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    await waitFor(() => expect(resolveCount).toBe(1));
  });

  it("renders a full-success result with the real selected count", async () => {
    importSelectedCandidatesAction.mockResolvedValue(DONE_SUCCESS);

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("Import completed")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Newly selected").nextSibling).toHaveTextContent("2");
  });

  it("displays already-selected as a normal outcome, not an error", async () => {
    importSelectedCandidatesAction.mockResolvedValue({
      stage: "done",
      totalRows: 3,
      selected: 1,
      alreadySelected: 2,
      notFound: 0,
      conflicts: 0,
      failed: 0,
      errors: [],
    });

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("Import completed")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Already selected").nextSibling).toHaveTextContent("2");
    // No danger/error wording anywhere for a purely already-selected outcome.
    expect(within(dialog).queryByText(/error/i)).not.toBeInTheDocument();
  });

  it("displays not-found rows with the exact backend message", async () => {
    importSelectedCandidatesAction.mockResolvedValue(
      partialResult(
        { notFound: 1 },
        [
          {
            row: 5,
            field: "email",
            name: "Ghost",
            email: "ghost@example.invalid",
            message:
              "Candidate not found in the Candidate table. This candidate must first exist in the live candidate import.",
          },
        ],
      ),
    );

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("Import completed with some errors")).toBeInTheDocument();
    expect(screen.getByText("1 candidate not found")).toBeInTheDocument();
    expect(screen.getByText("Ghost")).toBeInTheDocument();
    expect(screen.getByText(/must first exist in the live candidate import/)).toBeInTheDocument();
  });

  it("displays identity conflicts separately, explaining nothing was selected", async () => {
    importSelectedCandidatesAction.mockResolvedValue(
      partialResult(
        { conflicts: 1 },
        [
          {
            row: 8,
            field: "identity",
            name: "John Patel",
            email: "john@example.com",
            mobile: "9812345670",
            message: "Email identifies candidate #a but mobile identifies a different candidate #b. Identity conflict — not selected automatically.",
          },
        ],
      ),
    );

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("1 identity conflict")).toBeInTheDocument();
    expect(screen.getByText(/identify two different existing/i)).toBeInTheDocument();
    expect(screen.getByText("John Patel")).toBeInTheDocument();
  });

  it("shows partial success without calling it a failure", async () => {
    importSelectedCandidatesAction.mockResolvedValue(
      partialResult(
        { selected: 1, notFound: 1 },
        [{ row: 3, field: "email", name: "Bad", message: "Candidate not found in the Candidate table. This candidate must first exist in the live candidate import." }],
      ),
    );

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("Import completed with some errors")).toBeInTheDocument();
    expect(screen.queryByText(/^Import failed$/)).not.toBeInTheDocument();
  });

  it("shows a safe error state when nothing was selected", async () => {
    importSelectedCandidatesAction.mockResolvedValue({
      stage: "done",
      totalRows: 1,
      selected: 0,
      alreadySelected: 0,
      notFound: 1,
      conflicts: 0,
      failed: 0,
      errors: [
        {
          row: 2,
          field: "email",
          message: "Candidate not found in the Candidate table. This candidate must first exist in the live candidate import.",
        },
      ],
    });

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("No candidates were selected")).toBeInTheDocument();
  });

  it("shows a file-level validation error without exposing raw JSON", async () => {
    importSelectedCandidatesAction.mockResolvedValue({
      stage: "invalid",
      errors: [{ row: 1, field: "email", message: 'Missing required column: "Email Address2".' }],
    });

    renderDialog();
    await uploadAndSubmit();

    expect(await screen.findByText("File validation failed")).toBeInTheDocument();
    expect(screen.getByText(/Email Address2/)).toBeInTheDocument();
    expect(screen.queryByText(/^\{/)).not.toBeInTheDocument();
  });

  it("passes the file to the server action via FormData under the 'file' field", async () => {
    importSelectedCandidatesAction.mockResolvedValue(DONE_SUCCESS);

    const file = csvFile("selected.csv", "Email Address2\na@example.com");
    renderDialog();

    const user = userEvent.setup();
    await user.upload(screen.getByLabelText("CSV or Excel file"), file);

    const input = screen.getByLabelText("CSV or Excel file") as HTMLInputElement;
    expect(input.files?.[0]).toBe(file);
    expect(input.name).toBe("file");

    const submit = screen.getByRole("button", { name: "Import Selected Candidates" });
    const form = submit.closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await screen.findByText("Import completed");
    expect(importSelectedCandidatesAction).toHaveBeenCalledTimes(1);
  });

  it("lets the admin close the result", async () => {
    importSelectedCandidatesAction.mockResolvedValue(DONE_SUCCESS);

    const { onClose } = renderDialog();
    await uploadAndSubmit();

    await screen.findByText("Import completed");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
