"use client";

import { useActionState, useId, useState } from "react";

import { AlertTriangle, Save } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ThemeSelect } from "@/components/ui/theme-select";
import { useActionToast } from "@/components/ui/toast";

import { saveSettings, type SettingsState } from "./actions";

export type EditableSettings = {
  examName: string;
  durationMinutes: number;
  isOpen: boolean;
  easyPercent: number;
  mediumPercent: number;
  hardPercent: number;
};

/// A titled group of related settings. Each answers "what does this control?"
/// before showing the control itself.
function Group({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 lg:p-5">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-[13px] text-muted">{description}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/// One labelled control, with its helper text and error wired to it through
/// `aria-describedby` rather than merely placed nearby.
function Field({
  id,
  label,
  hint,
  error,
  suffix,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /// Unit shown beside the control, so the number is never ambiguous.
  suffix?: string;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="mt-0.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}

      <div className="mt-1.5 flex items-center gap-2">
        <div className="min-w-0 flex-1">{children({ id, describedBy, invalid: Boolean(error) })}</div>
        {suffix ? (
          <span className="shrink-0 text-[13px] whitespace-nowrap text-muted">{suffix}</span>
        ) : null}
      </div>

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

export function SettingsForm({ settings }: { settings: EditableSettings }) {
  const [state, save, saving] = useActionState<SettingsState, FormData>(saveSettings, {
    status: "idle",
  });

  // Mirrored so the page can show the consequence of the choice as it is made.
  // The submitted value is what the server validates; this only drives display.
  const [status, setStatus] = useState(settings.isOpen ? "open" : "closed");
  const [percents, setPercents] = useState({
    easyPercent: String(settings.easyPercent),
    mediumPercent: String(settings.mediumPercent),
    hardPercent: String(settings.hardPercent),
  });

  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  const errorFor = (field: string): string | undefined =>
    state.status === "error"
      ? state.errors.find((error) => error.field === field)?.message
      : undefined;

  const formError = errorFor("form");
  const failed = state.status === "error";

  // "All changes saved." must stop being true the moment any field changes
  // again, or it keeps claiming the form matches the database after the admin
  // has already picked a different exam status, typed a new duration, and so
  // on. `state.status` alone cannot tell dirty from clean — it only flips back
  // to "saved" on the next successful submit — so dirtiness is tracked here
  // and cleared each time a save actually lands.
  const [dirty, setDirty] = useState(false);
  const clean = state.status === "saved" && !dirty;

  // Derived from the action's own result, so a toast cannot report a save the
  // server did not perform.
  useActionToast(state, (current) => {
    if (current.status !== "saved") return null;
    setDirty(false);
    return { tone: "success", message: "Settings saved." };
  });

  const open = status === "open";

  // Presentational only: the server is the authority on whether the mix is
  // valid. This just lets the admin see the running total while typing.
  const values = [percents.easyPercent, percents.mediumPercent, percents.hardPercent].map((raw) =>
    /^\d+$/.test(raw.trim()) ? Number(raw) : Number.NaN,
  );
  const total = values.every(Number.isInteger) ? values[0] + values[1] + values[2] : null;

  return (
    <form
      action={save}
      onChange={() => setDirty(true)}
      className="space-y-4"
      noValidate
    >
      {/* Reported at the top as well as beside each field, so a failure is
          visible without hunting through the form. */}
      {failed ? (
        <Alert tone="danger" title="Nothing was saved">
          {formError ?? "Fix the highlighted fields below and save again."}
        </Alert>
      ) : null}

      <Group
        title="Exam availability"
        description="Whether candidates can start a new attempt. Attempts already in progress are not affected."
      >
        {/* The current state is stated in words and badged, so it reads at a
            glance rather than only from the select's value. */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone={open ? "success" : "neutral"}>{open ? "Exam is open" : "Exam is closed"}</Badge>
          <span className="text-[13px] text-muted">
            {open
              ? "Candidates can start a new attempt."
              : "Candidates cannot start a new attempt."}
          </span>
        </div>

        <div className="sm:max-w-[260px]">
          <Field id={fieldId("status")} label="Exam status" error={errorFor("status")}>
            {({ id, describedBy, invalid }) => (
              <ThemeSelect
                id={id}
                name="status"
                value={status}
                onChange={(next) => {
                  setStatus(next);
                  // ThemeSelect's own click never bubbles a native `change`
                  // event, so the form's onChange (which marks the page dirty)
                  // would never see this. Told directly instead.
                  setDirty(true);
                }}
                aria-describedby={describedBy}
                invalid={invalid}
                options={[
                  ["closed", "Closed"],
                  ["open", "Open"],
                ]}
              />
            )}
          </Field>
        </div>

        {/* Explanatory only. Opening or closing takes effect when saved, which
            is the existing behaviour; nothing new is enforced here. */}
        <p className="mt-3 text-[13px] text-muted">
          The change takes effect when you save.
        </p>
      </Group>

      <Group
        title="Exam identity and timing"
        description="The name shown to candidates and how long they have to complete the paper."
      >
        <div className="space-y-4">
          {/* Capped: a short single-line name stretched to the full page
              width is harder to read, not easier. */}
          <div className="sm:max-w-[480px]">
            <Field
              id={fieldId("examName")}
              label="Exam name"
              error={errorFor("examName")}
              hint="At most 120 characters."
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="examName"
                  defaultValue={settings.examName}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
          </div>

          <div className="sm:max-w-[260px]">
            <Field
              id={fieldId("durationMinutes")}
              label="Exam duration"
              // The unit is on the label, beside the control, and in the hint,
              // so the number can never be read as seconds or hours.
              suffix="minutes"
              error={errorFor("durationMinutes")}
              hint="A whole number between 1 and 1440 minutes."
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="durationMinutes"
                  defaultValue={settings.durationMinutes}
                  inputMode="numeric"
                  aria-describedby={describedBy}
                  invalid={invalid}
                  className="tabular"
                />
              )}
            </Field>
          </div>
        </div>
      </Group>

      <Group
        title="Difficulty mix"
        description="The target share of each difficulty when a paper is drawn. Must total 100%. Papers already generated are not affected."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ["easyPercent", "Easy"],
              ["mediumPercent", "Medium"],
              ["hardPercent", "Hard"],
            ] as const
          ).map(([name, label]) => (
            <Field key={name} id={fieldId(name)} label={label} suffix="%" error={errorFor(name)}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name={name}
                  value={percents[name]}
                  onChange={(event) =>
                    setPercents((current) => ({ ...current, [name]: event.target.value }))
                  }
                  inputMode="numeric"
                  aria-describedby={describedBy}
                  invalid={invalid}
                  className="tabular"
                />
              )}
            </Field>
          ))}
        </div>

        {/* A running total, announced politely. The server still decides
            whether the mix is acceptable. */}
        <p aria-live="polite" className="mt-3 text-[13px]">
          {total === null ? (
            <span className="text-muted">Enter whole percentages for all three shares.</span>
          ) : total === 100 ? (
            <span className="text-muted">
              Total <span className="font-medium text-ink tabular">100%</span>
            </span>
          ) : (
            <span className="text-warning">
              Total <span className="font-medium tabular">{total}%</span> — must be 100% to save.
            </span>
          )}
        </p>

        {errorFor("difficultyMix") ? (
          <p className="mt-2 flex gap-1.5 text-[13px] text-danger">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <span>{errorFor("difficultyMix")}</span>
          </p>
        ) : null}
      </Group>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          loadingLabel="Saving…"
          icon={<Save aria-hidden="true" className="size-4" />}
        >
          Save settings
        </Button>

        <p aria-live="polite" className="text-[13px] text-muted">
          {saving
            ? "Saving…"
            : failed
              ? "Not saved — see the errors above."
              : clean
                ? "All changes saved."
                : ""}
        </p>
      </div>
    </form>
  );
}
