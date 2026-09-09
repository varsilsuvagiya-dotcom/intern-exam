import type { ReactNode } from "react";

/// The five status tones in CloudUS. There are no others — no "archived",
/// "published", "flagged" or "reviewed" state exists in the data model.
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE: Record<StatusTone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  info: "bg-info-bg text-info",
  neutral: "bg-neutral-bg text-neutral",
};

/// A status badge always carries its text label: color alone never conveys
/// state, so the badge stays readable for colorblind users and screen readers.
export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE[tone],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/// A property, not a state — difficulty, section number. Outlined and neutral
/// so it never competes with a real status badge.
export function Chip({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-sm border border-line px-1.5 py-0.5",
        "text-xs font-medium text-ink-secondary whitespace-nowrap",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
