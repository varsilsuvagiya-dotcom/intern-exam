"use client";

/// A binary on/off control for an action that takes effect immediately —
/// unlike a checkbox in a form, there is no separate "Save" step. Used where
/// the surrounding UI is a table row rather than a form (see the candidates
/// page's selection toggle), so the existing `Input`/`Select` form controls
/// in components/ui/field.tsx don't fit.
export function Switch({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /// Required, not optional: a bare switch with no visible text needs an
  /// accessible name from somewhere, and this is the only place one is given.
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full",
        "transition-colors duration-[120ms] ease-out cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        checked ? "bg-primary" : "bg-inset",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "inline-block size-4 transform rounded-full bg-surface shadow-sm transition-transform duration-[120ms] ease-out",
          checked ? "translate-x-6" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}
