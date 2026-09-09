import type {
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";

import { AlertCircle } from "lucide-react";

/// Candidate-side form controls.
///
/// Larger than the admin equivalents (44px against 36px) and with a stronger
/// resting border: a candidate fills these in once, on an unfamiliar machine,
/// and a control that reads as "not quite editable" costs them a moment they
/// do not have.

const CONTROL = [
  "w-full rounded-exam-md border border-exam-line-strong bg-exam-surface px-3",
  "text-base text-exam-ink placeholder:text-exam-disabled",
  "transition-colors duration-[120ms] ease-out",
  "hover:border-exam-muted",
  "disabled:bg-exam-inset disabled:text-exam-disabled disabled:cursor-not-allowed disabled:hover:border-exam-line-strong",
].join(" ");

/// An invalid control is not marked by color alone: the border changes, and
/// `FieldError` below always renders an icon plus text next to it.
const INVALID = "border-exam-danger";

export function ExamInput({
  invalid,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={[CONTROL, "h-11", invalid ? INVALID : "", className].join(" ")}
    />
  );
}

export function ExamTextarea({
  invalid,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={[
        CONTROL,
        "py-2.5 resize-y leading-relaxed",
        invalid ? INVALID : "",
        className,
      ].join(" ")}
    />
  );
}

export function ExamLabel({
  htmlFor,
  children,
  className = "",
}: {
  htmlFor: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={["block text-sm font-medium text-exam-ink", className].join(" ")}
    >
      {children}
    </label>
  );
}

/// Guidance shown before the candidate makes a mistake — the mobile-number
/// note, a character allowance. Muted, but not so quiet it reads as decoration.
export function ExamHint({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p id={id} className={["text-sm text-exam-muted", className].join(" ")}>
      {children}
    </p>
  );
}

/// A validation message. Carries an icon as well as color so the failure does
/// not depend on red being perceived, and is announced when it appears.
export function ExamFieldError({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      id={id}
      role="alert"
      className={[
        "flex items-start gap-1.5 text-sm font-medium text-exam-danger",
        className,
      ].join(" ")}
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/// One labelled control with its hint and error, wired together.
///
/// The wiring is the point: `aria-describedby` has to name the hint *and* the
/// error, and `aria-invalid` has to follow the error's presence. Doing that by
/// hand at each call site is exactly how a field ends up announcing nothing,
/// which is the gap the design plan recorded as GAP-6. Render props rather
/// than cloning children, so the ids stay explicit and typed.
export function ExamField({
  id,
  label,
  hint,
  error,
  className = "",
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (props: {
    id: string;
    invalid: boolean;
    "aria-describedby": string | undefined;
  }) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={["flex flex-col gap-1.5", className].join(" ")}>
      <ExamLabel htmlFor={id}>{label}</ExamLabel>
      {hint ? <ExamHint id={hintId}>{hint}</ExamHint> : null}
      {children({ id, invalid: Boolean(error), "aria-describedby": describedBy })}
      {error ? <ExamFieldError id={errorId}>{error}</ExamFieldError> : null}
    </div>
  );
}
