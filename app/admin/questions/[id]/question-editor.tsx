"use client";

import { useActionState, useState } from "react";

import { saveQuestion, toggleActive, type EditState } from "./actions";

export type EditableQuestion = {
  id: string;
  section: number;
  topic: string;
  difficulty: string;
  question: string;
  codeBlock: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correct: string;
  explanation: string;
  lessonText: string;
  lessonGroup: string;
  scored: boolean;
  marks: string;
  aiVerified: boolean;
  trainerVerified: boolean;
  status: string;
  isActive: boolean;
};

const FIELD =
  "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20";
const LABEL = "block text-sm font-medium";

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <label className={LABEL}>
      {label}
      {children}
      {error ? <span className="mt-1 block text-sm font-normal text-red-600 dark:text-red-400">{error}</span> : null}
    </label>
  );
}

export function QuestionEditor({
  question,
  sections,
}: {
  question: EditableQuestion;
  sections: readonly number[];
}) {
  const [state, save, saving] = useActionState<EditState, FormData>(saveQuestion, { status: "idle" });
  const [activeState, changeActive, changingActive] = useActionState<EditState, FormData>(
    toggleActive,
    { status: "idle" },
  );
  const [confirming, setConfirming] = useState(false);

  const errorFor = (field: string): string | undefined =>
    state.status === "error" ? state.errors.find((error) => error.field === field)?.message : undefined;

  const formError = errorFor("form");

  return (
    <div className="mt-8 space-y-8">
      <form action={save} className="space-y-4">
        <input type="hidden" name="id" value={question.id} />

        <Field label="Question ID">
          {/* Identity is fixed: historical attempts and CSV re-imports both key
              off this value, so it is shown read-only and never submitted. */}
          <input value={question.id} readOnly disabled className={`${FIELD} opacity-60`} />
          <span className="mt-1 block text-sm font-normal text-black/50 dark:text-white/50">
            The question ID cannot be changed.
          </span>
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Section" error={errorFor("section")}>
            <select name="section" defaultValue={String(question.section)} className={FIELD}>
              {sections.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Difficulty" error={errorFor("difficulty")}>
            <select name="difficulty" defaultValue={question.difficulty} className={FIELD}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </Field>

          <Field label="Status" error={errorFor("status")}>
            <select name="status" defaultValue={question.status} className={FIELD}>
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="ready">Ready</option>
            </select>
          </Field>
        </div>

        <Field label="Topic" error={errorFor("topic")}>
          <input name="topic" defaultValue={question.topic} className={FIELD} />
        </Field>

        <Field label="Question" error={errorFor("question")}>
          <textarea name="question" defaultValue={question.question} rows={3} className={FIELD} />
        </Field>

        <Field label="Code block" error={errorFor("codeBlock")}>
          <textarea
            name="codeBlock"
            defaultValue={question.codeBlock}
            rows={4}
            className={`${FIELD} font-mono`}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          {(["A", "B", "C", "D"] as const).map((letter) => {
            const name = `option${letter}` as const;
            return (
              <Field key={letter} label={`Option ${letter}`} error={errorFor(name)}>
                <input name={name} defaultValue={question[name]} className={FIELD} />
              </Field>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Correct answer" error={errorFor("correct")}>
            <select name="correct" defaultValue={question.correct} className={FIELD}>
              {["a", "b", "c", "d"].map((option) => (
                <option key={option} value={option}>
                  {option.toUpperCase()}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Marks" error={errorFor("marks")}>
            <input name="marks" defaultValue={question.marks} inputMode="decimal" className={FIELD} />
          </Field>
        </div>

        <Field label="Explanation" error={errorFor("explanation")}>
          <textarea name="explanation" defaultValue={question.explanation} rows={2} className={FIELD} />
        </Field>

        <Field label="Lesson text (section 7)" error={errorFor("lessonText")}>
          <textarea name="lessonText" defaultValue={question.lessonText} rows={3} className={FIELD} />
        </Field>

        <Field label="Lesson group (section 7)" error={errorFor("lessonGroup")}>
          <input name="lessonGroup" defaultValue={question.lessonGroup} className={FIELD} />
        </Field>

        <fieldset className="flex flex-wrap gap-6">
          {(
            [
              ["scored", "Scored", question.scored],
              ["aiVerified", "AI verified", question.aiVerified],
              ["trainerVerified", "Trainer verified", question.trainerVerified],
              ["isActive", "Active", question.isActive],
            ] as const
          ).map(([name, label, checked]) => (
            <label key={name} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={name} defaultChecked={checked} />
              {label}
            </label>
          ))}
        </fieldset>

        {errorFor("scored") ? (
          <p className="text-sm text-red-600 dark:text-red-400">{errorFor("scored")}</p>
        ) : null}
        {formError ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{formError}</p> : null}

        {state.status === "error" && !formError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Nothing was saved. Fix the highlighted fields and try again.
          </p>
        ) : null}

        {state.status === "saved" ? (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            Question saved.
          </p>
        ) : null}

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <section className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h2 className="text-sm font-semibold">
          {question.isActive ? "Deactivate this question" : "Activate this question"}
        </h2>

        {confirming ? (
          <form action={changeActive} className="mt-2">
            <input type="hidden" name="id" value={question.id} />
            <input type="hidden" name="isActive" value={String(!question.isActive)} />
            <p className="text-sm text-black/70 dark:text-white/70">
              {question.isActive
                ? `Deactivate ${question.id}? It stays in the question bank and in historical exam records, but will no longer be treated as active for future exam selection.`
                : `Activate ${question.id}? It will be treated as active for future exam selection again.`}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={changingActive}
                className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
              >
                {changingActive ? "Saving…" : question.isActive ? "Deactivate" : "Activate"}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-2 rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
          >
            {question.isActive ? "Deactivate" : "Activate"}
          </button>
        )}

        {activeState.status === "error" ? (
          <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
            {activeState.errors[0]?.message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
