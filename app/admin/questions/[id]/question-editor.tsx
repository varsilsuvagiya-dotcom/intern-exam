"use client";

import { useActionState, useId, useState } from "react";

import { AlertTriangle, Save } from "lucide-react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, ReadOnlyValue, Textarea } from "@/components/ui/field";
import { useActionToast } from "@/components/ui/toast";
import { ThemeSelect } from "@/components/ui/theme-select";

import { saveQuestion, toggleActive, type EditState } from "./actions";

export type EditableQuestion = {
  id: string;
  section: string;
  topic: string;
  difficulty: string;
  question: string;
  codeBlock: string;
  verifyCode: string;
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

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;
type OptionLetter = (typeof OPTION_LETTERS)[number];

/// One selectable section, as the blueprint describes it.
export type SectionOption = { code: string; name: string; marksPerQuestion: number };

/// One labelled control with its helper text and its error.
///
/// The error is wired to the control through `aria-describedby` rather than
/// merely sitting near it, so a screen reader user hears why the field is
/// rejected instead of finding an unexplained invalid state.
function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {hint ? (
        <p id={hintId} className="mt-0.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}

      <div className="mt-1.5">{children({ id, describedBy, invalid: Boolean(error) })}</div>

      {/* Never colour alone: the message is text, and it is announced. */}
      {error ? (
        <p id={errorId} className="mt-1.5 flex gap-1.5 text-[13px] text-danger">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

/// A titled group of related fields. Replaces the old flat list, where identity,
/// content, options, scoring and verification all sat at one level.
function Group({
  title,
  description,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={`rounded-lg border border-line bg-surface p-4 lg:p-5 ${className}`}>
      <legend className="px-1 text-[13px] font-semibold text-ink">{title}</legend>
      {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </fieldset>
  );
}

function Checkbox({
  name,
  label,
  hint,
  defaultChecked,
  checked,
  onChange,
  disabled,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex gap-2.5">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        checked={checked}
        disabled={disabled}
        onChange={onChange ? (event) => onChange(event.target.checked) : undefined}
        className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)] disabled:cursor-not-allowed"
      />
      <span className="min-w-0">
        <span className="block text-sm text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function QuestionEditor({
  question,
  sections,
  lessonSection,
}: {
  question: EditableQuestion;
  /// Supplied by the server page from the exam blueprint, so this component
  /// holds no copy of the section list, its names or its marks.
  sections: readonly SectionOption[];
  /// The section drawn as whole lessons.
  lessonSection: string;
}) {
  const [state, save, saving] = useActionState<EditState, FormData>(saveQuestion, {
    status: "idle",
  });
  const [activeState, changeActive, changingActive] = useActionState<EditState, FormData>(
    toggleActive,
    { status: "idle" },
  );
  const [confirming, setConfirming] = useState(false);

  // Mirrored so the form can show the right fields as the admin works. The
  // submitted values are what the server validates; this only drives display.
  const [section, setSection] = useState(question.section);
  // ThemeSelect is controlled, unlike the native `<select>` these replace, so
  // each needs a value to control even where nothing else reacts to it.
  const [difficulty, setDifficulty] = useState(question.difficulty);
  const [status, setStatus] = useState(question.status);
  // Preserved as authored; every active section is scored.
  const scored = question.scored;
  const [correct, setCorrect] = useState(question.correct);
  const [options, setOptions] = useState({
    A: question.optionA,
    B: question.optionB,
    C: question.optionC,
    D: question.optionD,
  });

  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  const errorFor = (field: string): string | undefined =>
    state.status === "error"
      ? state.errors.find((error) => error.field === field)?.message
      : undefined;

  const formError = errorFor("form");
  const failed = state.status === "error";

  // Success and failure both come from the action's own returned state, so a
  // toast can never fire without a real result behind it.
  useActionToast(state, (current) =>
    current.status === "saved" ? { tone: "success", message: "Question saved." } : null,
  );
  useActionToast(activeState, (current) =>
    current.status === "saved"
      ? {
          tone: "success",
          message: question.isActive ? "Question deactivated." : "Question activated.",
        }
      : null,
  );

  const isLesson = section === lessonSection;
  const blueprintMarks = sections.find((entry) => entry.code === section) ?? null;
  // Lesson values on a non-7 question are shown rather than silently dropped:
  // hiding a field that still holds data is how data goes missing unnoticed.
  const strayLesson = !isLesson && Boolean(question.lessonText || question.lessonGroup);

  return (
    <div className="space-y-6">
      {/* True, load-bearing, and previously only implicit. */}
      <Alert tone="info">
        Editing a question does not change papers candidates have already sat. Attempts keep their
        own snapshot of every question as it was drawn.
      </Alert>

      <form action={save} className="space-y-4" noValidate>
        <input type="hidden" name="id" value={question.id} />

        {/* Errors are reported once at the top as well as at each field, so a
            failure is visible without hunting down a long form. */}
        {failed ? (
          <Alert tone="danger" title="Nothing was saved">
            {formError ?? "Fix the highlighted fields below and save again."}
          </Alert>
        ) : null}

        <Group
          title="Identity"
          description="How this question is filed. The ID is fixed; everything else here is editable."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id={fieldId("id")}
              label="Question ID"
              hint="Fixed. Historical attempts and CSV re-imports both key off this value."
            >
              {({ id }) => (
                <ReadOnlyValue className="font-mono text-xs">
                  <span id={id} className="truncate" title={question.id}>
                    {question.id}
                  </span>
                </ReadOnlyValue>
              )}
            </Field>

            <Field
              id={fieldId("topic")}
              label="Topic"
              required
              error={errorFor("topic")}
              hint="At most 200 characters."
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="topic"
                  defaultValue={question.topic}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field id={fieldId("section")} label="Section" required error={errorFor("section")}>
              {({ id, describedBy, invalid }) => (
                <ThemeSelect
                  id={id}
                  name="section"
                  value={section}
                  onChange={setSection}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  options={sections.map((option) => [
                    option.code,
                    `${option.code} — ${option.name}`,
                  ])}
                />
              )}
            </Field>

            <Field
              id={fieldId("difficulty")}
              label="Difficulty"
              required
              error={errorFor("difficulty")}
            >
              {({ id, describedBy, invalid }) => (
                <ThemeSelect
                  id={id}
                  name="difficulty"
                  value={difficulty}
                  onChange={setDifficulty}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  options={[
                    ["easy", "Easy"],
                    ["medium", "Medium"],
                    ["hard", "Hard"],
                  ]}
                />
              )}
            </Field>

            {/* Status is the authoring workflow. Whether the question may be
                drawn into a paper is `isActive`, below — a separate concept,
                deliberately not merged into this control. */}
            <Field
              id={fieldId("status")}
              label="Status"
              required
              error={errorFor("status")}
              hint="Authoring workflow only."
            >
              {({ id, describedBy, invalid }) => (
                <ThemeSelect
                  id={id}
                  name="status"
                  value={status}
                  onChange={setStatus}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  options={[
                    ["draft", "Draft"],
                    ["review", "Review"],
                    ["ready", "Ready"],
                  ]}
                />
              )}
            </Field>
          </div>
        </Group>

        <Group title="Question">
          <Field id={fieldId("question")} label="Question text" required error={errorFor("question")}>
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                name="question"
                defaultValue={question.question}
                rows={5}
                aria-describedby={describedBy}
                invalid={invalid}
                className="min-h-[7.5rem] leading-6"
              />
            )}
          </Field>

          <Field
            id={fieldId("codeBlock")}
            label="Code block"
            hint="Optional. Shown to the candidate as a code block, exactly as typed."
            error={errorFor("codeBlock")}
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                name="codeBlock"
                defaultValue={question.codeBlock}
                rows={10}
                spellCheck={false}
                aria-describedby={describedBy}
                invalid={invalid}
                className="font-mono text-xs leading-5"
              />
            )}
          </Field>
        </Group>

        <Group
          title="Options and correct answer"
          description="The correct answer is chosen by the radio beside each option, so it can never drift from the option text it belongs to."
        >
          {errorFor("correct") ? (
            <p className="flex gap-1.5 text-[13px] text-danger">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <span>{errorFor("correct")}</span>
            </p>
          ) : null}

          {/* One radiogroup over the four options. Selecting the correct answer
              is a choice *among the options themselves* rather than a separate
              letter dropdown, which is what made picking the wrong letter easy. */}
          <div
            role="radiogroup"
            aria-label="Correct answer"
            className="space-y-3 md:space-y-2"
          >
            {OPTION_LETTERS.map((letter) => {
              const name = `option${letter}` as `option${OptionLetter}`;
              const key = letter.toLowerCase();
              const selected = correct === key;
              const error = errorFor(name);

              return (
                <div
                  key={letter}
                  className={[
                    "rounded-md border p-3 transition-colors duration-[120ms]",
                    selected ? "border-primary-border bg-primary-subtle" : "border-line bg-surface",
                  ].join(" ")}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct"
                        value={key}
                        checked={selected}
                        onChange={() => setCorrect(key)}
                        className="size-4 accent-[var(--color-primary)]"
                      />
                      <span className="text-sm font-medium text-ink">Option {letter}</span>
                    </label>

                    {/* Stated in words, not by tint alone. */}
                    {selected ? <Badge tone="success">Correct answer</Badge> : null}
                  </div>

                  <div className="mt-2">
                    <label htmlFor={fieldId(name)} className="sr-only">
                      Option {letter} text
                    </label>
                    <Textarea
                      id={fieldId(name)}
                      name={name}
                      value={options[letter]}
                      onChange={(event) =>
                        setOptions((current) => ({ ...current, [letter]: event.target.value }))
                      }
                      rows={3}
                      aria-describedby={error ? `${fieldId(name)}-error` : undefined}
                      invalid={Boolean(error)}
                    />
                    {error ? (
                      <p
                        id={`${fieldId(name)}-error`}
                        className="mt-1.5 flex gap-1.5 text-[13px] text-danger"
                      >
                        <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                        <span>{error}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Group>

        <Group
          title="Explanation"
          description="Shown only in admin result review. Candidates never see it."
        >
          <Field id={fieldId("explanation")} label="Explanation" error={errorFor("explanation")}>
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                name="explanation"
                defaultValue={question.explanation}
                rows={4}
                aria-describedby={describedBy}
                invalid={invalid}
                className="min-h-[6rem] leading-6"
              />
            )}
          </Field>
        </Group>

        <Group
          title="Internal verification"
          description="Admin reference only. Never sent to a candidate's browser."
        >
          <Field
            id={fieldId("verifyCode")}
            label="Verify code"
            hint="Optional. Carried in from the source file for internal checking."
            error={errorFor("verifyCode")}
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                name="verifyCode"
                defaultValue={question.verifyCode}
                rows={3}
                aria-describedby={describedBy}
                invalid={invalid}
                className="min-h-[4.5rem] font-mono text-[13px] leading-6"
              />
            )}
          </Field>
        </Group>

        {/* Rendered only for section 7, or when a non-7 question still carries
            lesson data. In the latter case the inputs stay mounted so saving
            cannot quietly blank values the form is not showing. */}
        {isLesson || strayLesson ? (
          <Group
            title="Section 7 — Learn-and-Apply"
            description="Section 7 is drawn as whole lessons: the lesson text is shown once above the three questions that share its group."
            className={isLesson ? "border-primary-border bg-primary-subtle/40" : ""}
          >
            {strayLesson ? (
              <Alert tone="warning">
                This question is in section {section} but still carries lesson data. It is shown
                here so it is not lost; clear both fields if it does not belong to a lesson.
              </Alert>
            ) : null}

            <Field
              id={fieldId("lessonGroup")}
              label="Lesson group"
              required={isLesson}
              error={errorFor("lessonGroup")}
              hint="The identifier shared by the questions drawn together as one lesson."
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="lessonGroup"
                  defaultValue={question.lessonGroup}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>

            <Field
              id={fieldId("lessonText")}
              label="Lesson text"
              required={isLesson}
              error={errorFor("lessonText")}
              hint="Shown once above every question in this lesson group."
            >
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  name="lessonText"
                  defaultValue={question.lessonText}
                  rows={6}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  className="min-h-[9rem] leading-6"
                />
              )}
            </Field>
          </Group>
        ) : (
          // Not rendered as fields, but still submitted, so switching a question
          // to another section does not silently erase its lesson content.
          <>
            <input type="hidden" name="lessonGroup" value={question.lessonGroup} />
            <input type="hidden" name="lessonText" value={question.lessonText} />
          </>
        )}

        <Group title="Scoring">
          {/* Every active section is scored, so `scored` is no longer a choice.
              It is still submitted so a question that predates the seven-section
              exam keeps the value it was authored with rather than being
              silently flipped on save. */}
          <input type="hidden" name="scored" value={scored ? "true" : "false"} />

          <div className="sm:max-w-[220px]">
            <Field
              id={fieldId("marks")}
              label="Marks"
              required
              error={errorFor("marks")}
              hint={
                blueprintMarks
                  ? `The exam blueprint uses ${blueprintMarks.marksPerQuestion} for ${blueprintMarks.name}.`
                  : undefined
              }
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="marks"
                  defaultValue={question.marks}
                  inputMode="decimal"
                  aria-describedby={describedBy}
                  invalid={invalid}
                  className="tabular"
                />
              )}
            </Field>
          </div>
        </Group>

        <Group
          title="Verification"
          description="Review flags. Neither affects whether the question can be drawn into a paper."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox name="aiVerified" label="AI verified" defaultChecked={question.aiVerified} />
            <Checkbox
              name="trainerVerified"
              label="Trainer verified"
              defaultChecked={question.trainerVerified}
            />
          </div>
        </Group>

        {/* `isActive` is owned by the activation block below, but the save
            action validates the whole question, so the current value travels
            with the form rather than being reset by a save. */}
        <input type="hidden" name="isActive" value={String(question.isActive)} />

        {/* Reachable without scrolling to the end of a long form. */}
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-page/95 px-4 py-3 backdrop-blur-sm lg:-mx-6 lg:px-6">
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            loadingLabel="Saving…"
            icon={<Save aria-hidden="true" className="size-4" />}
          >
            Save changes
          </Button>

          <p aria-live="polite" className="text-[13px] text-muted">
            {saving
              ? "Saving…"
              : failed
                ? "Not saved — see the errors above."
                : state.status === "saved"
                  ? "All changes saved."
                  : ""}
          </p>
        </div>
      </form>

      {/* Deactivation is a flag, never a delete. There is no delete action on
          this page and none may be added. */}
      <section className="rounded-lg border border-warning/30 bg-warning-bg p-4 lg:p-5">
        <h2 className="text-[13px] font-semibold text-ink">
          {question.isActive ? "Deactivate question" : "Activate question"}
        </h2>
        <p className="mt-1 text-[13px] text-ink-secondary">
          {question.isActive
            ? "A deactivated question stays in the bank and in every historical attempt, but is no longer drawn into new papers."
            : "An active question can be drawn into new papers again."}
        </p>

        <div className="mt-3">
          <Badge tone={question.isActive ? "success" : "warning"}>
            Currently {question.isActive ? "active" : "inactive"}
          </Badge>
        </div>

        {activeState.status === "error" ? (
          <Alert tone="danger" className="mt-3">
            {activeState.errors[0]?.message ?? "The change could not be saved."}
          </Alert>
        ) : null}

        {confirming ? (
          <form action={changeActive} className="mt-4">
            <input type="hidden" name="id" value={question.id} />
            <input type="hidden" name="isActive" value={String(!question.isActive)} />
            <p className="text-[13px] text-ink">
              {question.isActive
                ? `Deactivate ${question.id}?`
                : `Activate ${question.id}?`}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="submit"
                variant={question.isActive ? "destructive" : "primary"}
                loading={changingActive}
                loadingLabel="Saving…"
              >
                {question.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button type="button" variant="tertiary" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="mt-4">
            <Button
              type="button"
              variant={question.isActive ? "destructive" : "secondary"}
              onClick={() => setConfirming(true)}
            >
              {question.isActive ? "Deactivate" : "Activate"}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
