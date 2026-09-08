"use client";

import { useActionState, useState } from "react";

import { confirmImport, previewImport, type ImportState } from "./actions";

const CARD = "mt-8 rounded-lg border border-black/10 p-4 dark:border-white/15";
const CELL = "border-b border-black/5 px-3 py-2 text-left align-top dark:border-white/10";

function Summary({ total, created, updated }: { total: number; created: number; updated: number }) {
  return (
    <dl className="flex gap-6 text-sm">
      {[
        ["Rows", total],
        ["New", created],
        ["Updates", updated],
      ].map(([label, value]) => (
        <div key={label}>
          <dt className="text-black/50 dark:text-white/50">{label}</dt>
          <dd className="text-lg font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
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
  const [fileName, setFileName] = useState<string | null>(null);

  const state = result.stage === "idle" ? preview : result;

  return (
    <div>
      <form action={previewAction} className={CARD}>
        <label htmlFor="file" className="text-sm font-medium">
          CSV file
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border file:border-black/15 file:bg-transparent file:px-3 file:py-1.5 file:text-sm dark:file:border-white/20"
        />
        {fileName ? (
          <p className="mt-2 text-sm text-black/60 dark:text-white/60">Selected: {fileName}</p>
        ) : null}
        <button
          type="submit"
          disabled={previewing}
          className="mt-4 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {previewing ? "Checking…" : "Upload and preview"}
        </button>
      </form>

      {state.stage === "invalid" ? (
        <section className={CARD}>
          <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">
            {state.errors.length} problem{state.errors.length === 1 ? "" : "s"} found — nothing was imported
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {state.errors.slice(0, 100).map((error, index) => (
              <li key={index} className="text-black/70 dark:text-white/70">
                {error.row > 0 ? `Row ${error.row}: ` : ""}
                <span className="font-medium">{error.field}</span> — {error.message}
              </li>
            ))}
          </ul>
          {state.errors.length > 100 ? (
            <p className="mt-2 text-sm text-black/50 dark:text-white/50">
              …and {state.errors.length - 100} more.
            </p>
          ) : null}
        </section>
      ) : null}

      {state.stage === "preview" ? (
        <section className={CARD}>
          <Summary total={state.total} created={state.created} updated={state.updated} />
          <p className="mt-3 text-sm text-black/60 dark:text-white/60">
            No errors. Review the rows below, then confirm.
          </p>

          <div className="mt-4 max-h-96 overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-white dark:bg-black">
                <tr>
                  {["Row", "ID", "Sec", "Topic", "Question", "Difficulty", "Correct", "Marks", "Status"].map((h) => (
                    <th key={h} className={`${CELL} font-medium`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row) => (
                  <tr key={row.id}>
                    <td className={CELL}>{row.row}</td>
                    <td className={CELL}>{row.id}</td>
                    <td className={CELL}>{row.section}</td>
                    <td className={CELL}>{row.topic}</td>
                    <td className={`${CELL} max-w-md truncate`}>{row.question}</td>
                    <td className={CELL}>{row.difficulty}</td>
                    <td className={CELL}>{row.correct}</td>
                    <td className={CELL}>{row.marks}</td>
                    <td className={CELL}>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {state.total > state.rows.length ? (
            <p className="mt-2 text-sm text-black/50 dark:text-white/50">
              Showing the first {state.rows.length} of {state.total} rows.
            </p>
          ) : null}

          <form action={confirmAction} className="mt-4">
            <input type="hidden" name="csv" value={state.csv} />
            <button
              type="submit"
              disabled={importing}
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {importing ? "Importing…" : `Import ${state.total} questions`}
            </button>
          </form>
        </section>
      ) : null}

      {state.stage === "done" ? (
        <section className={CARD}>
          <h2 className="text-sm font-semibold text-green-700 dark:text-green-400">Import complete</h2>
          <div className="mt-3">
            <Summary total={state.total} created={state.created} updated={state.updated} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
