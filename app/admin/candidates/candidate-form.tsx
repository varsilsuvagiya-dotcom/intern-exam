"use client";

import { useActionState, useEffect, useId, useRef } from "react";

import { AlertTriangle, X } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useActionToast } from "@/components/ui/toast";

import {
  addCandidate,
  updateCandidate,
  type AddCandidateState,
  type EditCandidateState,
} from "./actions";

/// The candidate being edited, or null when adding a new one.
export type EditableCandidate = {
  id: string;
  name: string;
  email: string;
  mobile: string;
};

/// One labelled control with its error wired through `aria-describedby`.
///
/// Deliberately no per-field hint slot. The three fields sit in one grid row,
/// and a hint under a single label made that label block taller than its
/// neighbours — which pushed its input down and left the row visibly ragged.
/// Format guidance goes in the placeholder instead, where it costs no height.
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
}) {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
      </label>

      <div className="mt-1.5">{children({ id, describedBy: errorId, invalid: Boolean(error) })}</div>

      {/* Text and an icon, never colour alone. */}
      {error ? (
        <p id={errorId} className="mt-1.5 flex gap-1.5 text-[13px] text-danger">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

/// Add or edit a candidate.
///
/// One component for both, because they are one form: the same three fields
/// under the same rules, differing only in which action they post to and
/// whether they arrive filled in. Two copies would have drifted the moment
/// either gained a field.
///
/// A disclosed panel in the page flow rather than a modal: the admin side has
/// no dialog primitive, neither action is destructive, and the panel can sit
/// directly above the table whose row it affects — so the result is visible in
/// the same view that performed it.
export function CandidateForm({
  candidate,
  onClose,
}: {
  /// The candidate to edit, or null to add a new one.
  candidate: EditableCandidate | null;
  onClose: () => void;
}) {
  const editing = candidate !== null;

  // Two `useActionState` hooks rather than one over a union: hooks cannot be
  // called conditionally, and the alternative — a single action that branches
  // on a hidden field — would put the create and update paths behind one
  // signature for no gain. Only the matching one is ever submitted.
  const [addState, add, adding] = useActionState<AddCandidateState, FormData>(addCandidate, {
    status: "idle",
  });
  const [editState, edit, editingNow] = useActionState<EditCandidateState, FormData>(
    updateCandidate,
    { status: "idle" },
  );

  const state = editing ? editState : addState;
  const saving = editing ? editingNow : adding;

  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  const errorFor = (field: string): string | undefined =>
    state.status === "error"
      ? state.errors.find((error) => error.field === field)?.message
      : undefined;

  const formError = errorFor("form");
  const failed = state.status === "error";
  const succeeded = state.status === "added" || state.status === "saved";

  // Focus lands in the panel as it opens. Deferred a frame because the fields
  // do not exist until this render commits.
  useEffect(() => {
    const frame = requestAnimationFrame(() => firstFieldRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  // Derived from the action's own result, so a toast cannot report a write the
  // server did not perform.
  useActionToast(state, (current) => {
    if (current.status === "added") {
      return { tone: "success", message: `${current.name} added.` };
    }
    if (current.status === "saved") {
      return { tone: "success", message: `${current.name} updated.` };
    }
    return null;
  });

  useEffect(() => {
    if (state.status === "added") {
      // Adding stays open, clears and re-focuses, so several candidates can be
      // entered without reaching for the mouse.
      formRef.current?.reset();
      firstFieldRef.current?.focus();
      return;
    }

    // Editing is done when it is done: one row was being corrected, and the
    // corrected row is now in the table behind the panel.
    if (state.status === "saved") {
      onClose();
    }
  }, [state, onClose]);

  return (
    <div className="rounded-lg border border-line bg-surface p-4 text-left lg:p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-ink">
            {editing ? `Edit ${candidate.name}` : "Add a candidate manually"}
          </h2>
          <p className="mt-1 text-[13px] text-muted">
            {editing
              ? "Corrects this candidate's details. Attempts they have already sat are not affected."
              : "For a registration the Google Form did not carry. The candidate can then start the exam in the normal way."}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label={editing ? "Cancel editing" : "Close the add candidate form"}
          className="-my-1 -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-inset hover:text-ink"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>

      <form
        ref={formRef}
        action={editing ? edit : add}
        noValidate
        className="mt-4"
        // Remounts the form when the target changes, so switching from one
        // candidate to another re-reads `defaultValue` instead of keeping the
        // previous candidate's text in the inputs.
        key={candidate?.id ?? "new"}
      >
        {editing ? <input type="hidden" name="id" value={candidate.id} /> : null}

        {/* Reported at the top as well as beside each field, so a failure is
            visible without hunting through the form. */}
        {failed ? (
          <Alert tone="danger" title={editing ? "Nothing was changed" : "Nothing was added"} className="mb-4">
            {formError ?? "Fix the highlighted fields below and try again."}
          </Alert>
        ) : null}

        {/* `items-start` so a field that grows an error message pushes nothing
            else down with it. */}
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <Field id={fieldId("name")} label="Full name" error={errorFor("name")}>
            {({ id, describedBy, invalid }) => (
              <Input
                ref={firstFieldRef}
                id={id}
                name="name"
                defaultValue={candidate?.name}
                autoComplete="off"
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Field id={fieldId("email")} label="Email" error={errorFor("email")}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="email"
                type="email"
                inputMode="email"
                defaultValue={candidate?.email}
                autoComplete="off"
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Field id={fieldId("mobile")} label="Mobile" error={errorFor("mobile")}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="mobile"
                inputMode="tel"
                // The format lives here rather than in a hint line, which would
                // make this label block taller than the other two.
                placeholder="10 digits, or with +91"
                defaultValue={candidate?.mobile}
                autoComplete="off"
                aria-describedby={describedBy}
                invalid={invalid}
                className="tabular"
              />
            )}
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            loadingLabel={editing ? "Saving…" : "Adding…"}
          >
            {editing ? "Save changes" : "Add candidate"}
          </Button>

          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>

          <p aria-live="polite" className="text-[13px] text-muted">
            {saving
              ? editing
                ? "Saving…"
                : "Adding…"
              : failed
                ? editing
                  ? "Not saved — see the errors above."
                  : "Not added — see the errors above."
                : succeeded && state.status === "added"
                  ? `${state.name} added. The form is ready for the next one.`
                  : ""}
          </p>
        </div>
      </form>
    </div>
  );
}
