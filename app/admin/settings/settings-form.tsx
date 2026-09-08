"use client";

import { useActionState } from "react";

import { saveSettings, type SettingsState } from "./actions";

const FIELD =
  "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20";

export function SettingsForm({
  settings,
}: {
  settings: { examName: string; durationMinutes: number; isOpen: boolean };
}) {
  const [state, save, saving] = useActionState<SettingsState, FormData>(saveSettings, {
    status: "idle",
  });

  const errorFor = (field: string): string | undefined =>
    state.status === "error" ? state.errors.find((error) => error.field === field)?.message : undefined;

  return (
    <form action={save} className="mt-8 space-y-4">
      <label className="block text-sm font-medium">
        Exam name
        <input name="examName" defaultValue={settings.examName} className={FIELD} />
        {errorFor("examName") ? (
          <span className="mt-1 block text-sm font-normal text-red-600 dark:text-red-400">
            {errorFor("examName")}
          </span>
        ) : null}
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block text-sm font-medium">
          Duration (minutes)
          <input
            name="durationMinutes"
            defaultValue={settings.durationMinutes}
            inputMode="numeric"
            className={FIELD}
          />
          {errorFor("durationMinutes") ? (
            <span className="mt-1 block text-sm font-normal text-red-600 dark:text-red-400">
              {errorFor("durationMinutes")}
            </span>
          ) : null}
        </label>

        <label className="block text-sm font-medium">
          Exam status
          <select name="status" defaultValue={settings.isOpen ? "open" : "closed"} className={FIELD}>
            <option value="closed">Closed</option>
            <option value="open">Open</option>
          </select>
          {errorFor("status") ? (
            <span className="mt-1 block text-sm font-normal text-red-600 dark:text-red-400">
              {errorFor("status")}
            </span>
          ) : null}
        </label>
      </div>

      <p className="text-sm text-black/60 dark:text-white/60">
        {settings.isOpen
          ? "The exam is open. Candidates will be able to start once the candidate screens are built."
          : "The exam is closed. Candidates cannot start."}
      </p>

      {errorFor("form") ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {errorFor("form")}
        </p>
      ) : null}

      {state.status === "error" && !errorFor("form") ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Nothing was saved. Fix the highlighted fields and try again.
        </p>
      ) : null}

      {state.status === "saved" ? (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          Settings saved.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {saving ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
