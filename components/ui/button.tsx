import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Loader2 } from "lucide-react";

/// Button variants, per the design plan §12.
///
/// At most one `primary` per page region: it marks the single most important
/// action. `destructive` is outlined rather than filled because every
/// destructive action in CloudUS is reversible (deactivating a question), so it
/// should read as serious without shouting.
export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-hover active:bg-primary-active disabled:bg-inset disabled:text-disabled",
  secondary:
    "bg-surface text-ink border border-line-strong hover:bg-subtle active:bg-inset disabled:bg-inset disabled:text-disabled",
  tertiary:
    "bg-transparent text-ink-secondary hover:bg-subtle active:bg-inset disabled:bg-transparent disabled:text-disabled",
  destructive:
    "bg-surface text-danger border border-danger/40 hover:bg-danger-bg active:bg-danger-bg disabled:bg-inset disabled:text-disabled disabled:border-line",
};

/// Heights are the design plan's 32 / 36 / 40px on a pointer, and the touch
/// minimum below `md`. The link-styled actions across the admin pages already
/// did this by hand; putting it here is what stops them drifting apart.
const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 max-md:h-11",
  md: "h-9 px-4 text-sm gap-2 max-md:h-11",
  lg: "h-10 px-5 text-sm gap-2 max-md:h-11",
};

export const buttonClass = (
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "md",
  className = "",
): string =>
  [
    "inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap",
    "transition-colors duration-[120ms] ease-out disabled:cursor-not-allowed",
    VARIANT[variant],
    SIZE[size],
    className,
  ].join(" ");

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /// Shows a spinner and disables the button. Pair with `loadingLabel` so the
  /// label reads as progress ("Saving…") rather than staying static.
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  loadingLabel,
  icon,
  className = "",
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={buttonClass(variant, size, className)}
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : (
        icon
      )}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}

/// An action with no room for a label. The label still has to exist for
/// assistive tech and for a tooltip, so `label` is required rather than optional.
export function IconButton({
  label,
  size = "md",
  variant = "tertiary",
  className = "",
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  // Square, and never below 44px on touch widths — the design plan's minimum
  // target size applies to icon-only controls first.
  const box = size === "sm" ? "size-8" : size === "lg" ? "size-10" : "size-9";

  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={[
        "inline-flex items-center justify-center rounded-md",
        "transition-colors duration-[120ms] ease-out disabled:cursor-not-allowed",
        VARIANT[variant],
        box,
        "max-md:size-11",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
