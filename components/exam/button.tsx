import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

import { Loader2 } from "lucide-react";

/// Candidate-side buttons.
///
/// Deliberately a separate primitive from the admin `Button` rather than a
/// size variant of it. The admin scale is 32/36/40px for a mouse on a dense
/// table; an exam control is pressed once, decisively, sometimes in a hurry,
/// and the design plan puts the minimum at 44px on every width — not only on
/// touch. The variant vocabulary is the same because it earned its keep.
///
/// `danger` is outlined, not filled: the only destructive-feeling candidate
/// action is submitting the exam, and that is confirmed in a dialog. A filled
/// red button on an examination screen reads as an alarm.
export type ExamButtonVariant = "primary" | "secondary" | "tertiary" | "danger";
export type ExamButtonSize = "md" | "lg";

const VARIANT: Record<ExamButtonVariant, string> = {
  primary:
    "bg-exam-primary text-white hover:bg-exam-primary-hover active:bg-exam-primary-active disabled:bg-exam-inset disabled:text-exam-disabled",
  secondary:
    "bg-exam-surface text-exam-ink border border-exam-line-strong hover:bg-exam-subtle active:bg-exam-inset disabled:bg-exam-inset disabled:text-exam-disabled disabled:border-exam-line",
  tertiary:
    "bg-transparent text-exam-ink-secondary hover:bg-exam-subtle active:bg-exam-inset disabled:bg-transparent disabled:text-exam-disabled",
  danger:
    "bg-exam-surface text-exam-danger border border-exam-danger/40 hover:bg-exam-danger-bg active:bg-exam-danger-bg disabled:bg-exam-inset disabled:text-exam-disabled disabled:border-exam-line",
};

/// 44px and 48px. Both clear the touch minimum at every width, because the
/// exam is operated under pressure and a mis-click costs a candidate time.
const SIZE: Record<ExamButtonSize, string> = {
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export const examButtonClass = (
  variant: ExamButtonVariant = "secondary",
  size: ExamButtonSize = "md",
  className = "",
): string =>
  [
    "inline-flex items-center justify-center rounded-exam-md font-medium whitespace-nowrap",
    "transition-colors duration-[120ms] ease-out disabled:cursor-not-allowed",
    VARIANT[variant],
    SIZE[size],
    className,
  ].join(" ");

export type ExamButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ExamButtonVariant;
  size?: ExamButtonSize;
  /// Shows a spinner and disables the button. Pair with `loadingLabel` so the
  /// label reads as progress ("Submitting…") rather than staying static.
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
  /// React 19 passes `ref` as an ordinary prop, so it needs declaring rather
  /// than forwarding. The submit dialog returns focus to its trigger on close.
  ref?: Ref<HTMLButtonElement>;
};

export function ExamButton({
  variant = "secondary",
  size = "md",
  loading = false,
  loadingLabel,
  icon,
  className = "",
  children,
  disabled,
  ...props
}: ExamButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={examButtonClass(variant, size, className)}
    >
      {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : icon}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

/// An action with no room for a label. The label still has to exist for
/// assistive tech and for a tooltip, so `label` is required rather than
/// optional.
export function ExamIconButton({
  label,
  size = "md",
  variant = "tertiary",
  className = "",
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  size?: ExamButtonSize;
  variant?: ExamButtonVariant;
}) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={[
        "inline-flex items-center justify-center rounded-exam-md",
        "transition-colors duration-[120ms] ease-out disabled:cursor-not-allowed",
        VARIANT[variant],
        size === "lg" ? "size-12" : "size-11",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
