import type {
  InputHTMLAttributes,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/// Shared control styling. Inputs use the stronger border so they read as
/// interactive against a card, which the surrounding surface does not.
const CONTROL = [
  "w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink",
  "placeholder:text-disabled transition-colors duration-[120ms] ease-out",
  "disabled:bg-inset disabled:text-disabled disabled:cursor-not-allowed",
].join(" ");

const INVALID = "border-danger";

export function Input({
  invalid,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
  /// React 19 passes `ref` as an ordinary prop, so it needs declaring rather
  /// than forwarding. A form that stays open after submitting re-focuses its
  /// first field.
  ref?: Ref<HTMLInputElement>;
}) {
  return (
    <input
      {...props}
      aria-invalid={invalid || undefined}
      className={[CONTROL, "h-9", invalid ? INVALID : "", className].join(" ")}
    />
  );
}

export function Select({
  invalid,
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...props}
      aria-invalid={invalid || undefined}
      className={[
        CONTROL,
        "h-9 cursor-pointer disabled:cursor-not-allowed",
        invalid ? INVALID : "",
        className,
      ].join(" ")}
    >
      {children}
    </select>
  );
}

export function Textarea({
  invalid,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      aria-invalid={invalid || undefined}
      className={[CONTROL, "py-2 resize-y", invalid ? INVALID : "", className].join(" ")}
    />
  );
}

/// A read-only-by-design value — the question ID, which comes from the CSV and
/// can never be edited. Deliberately styled differently from a *disabled*
/// control, which implies "not editable right now"; this is "not editable, ever".
export function ReadOnlyValue({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex h-9 w-full items-center rounded-md border border-line bg-inset px-3",
        "text-sm text-ink-secondary",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
