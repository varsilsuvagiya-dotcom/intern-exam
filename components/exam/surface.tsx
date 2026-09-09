import type { HTMLAttributes, ReactNode } from "react";

import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

/// Candidate-side surfaces and notices.
///
/// The examination screen is built from borders and spacing, not from stacked
/// cards with shadows. `Panel` is the one container primitive; anything that
/// needs to float (the submit dialog) reaches for a shadow token directly
/// rather than getting a variant here it would be the only user of.

/// Panels are frequently labelled regions (`aria-labelledby` pointing at the
/// heading inside them), so the remaining HTML attributes are forwarded rather
/// than dropped. Without this a caller can pass `aria-labelledby`, get no type
/// error, and silently lose the label.
type PanelProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "aside" | "article";
};

export function ExamPanel({
  children,
  className = "",
  as: Tag = "div",
  ...rest
}: PanelProps) {
  return (
    <Tag
      {...rest}
      className={[
        "rounded-exam-lg border border-exam-line bg-exam-surface",
        className,
      ].join(" ")}
    >
      {children}
    </Tag>
  );
}

/// A quieter container for supporting content — the S7 lesson box, the
/// "Before you begin" list. Reads as *referenced* material rather than as the
/// thing being acted on.
export function ExamSubtlePanel({
  children,
  className = "",
  as: Tag = "div",
  ...rest
}: PanelProps) {
  return (
    <Tag
      {...rest}
      className={[
        "rounded-exam-lg border border-exam-line bg-exam-subtle",
        className,
      ].join(" ")}
    >
      {children}
    </Tag>
  );
}

/// The candidate status vocabulary. There are no others: no "flagged", no
/// "marked for review" — that state does not exist in CloudUS.
export type ExamTone = "success" | "warning" | "danger" | "info" | "neutral";

const NOTICE_TONE: Record<
  Exclude<ExamTone, "neutral">,
  { box: string; icon: typeof Info }
> = {
  success: {
    box: "bg-exam-success-bg border-exam-success/30 text-exam-success",
    icon: CheckCircle2,
  },
  warning: {
    box: "bg-exam-warning-bg border-exam-warning/30 text-exam-warning",
    icon: AlertTriangle,
  },
  danger: {
    box: "bg-exam-danger-bg border-exam-danger/30 text-exam-danger",
    icon: AlertCircle,
  },
  info: { box: "bg-exam-info-bg border-exam-info/30 text-exam-info", icon: Info },
};

/// A persistent message in the content flow: a closed exam, a failed start, a
/// resumed attempt. It stays until the condition does.
///
/// There is deliberately no toast equivalent on the candidate side. A message
/// that appears and then vanishes is wrong for someone concentrating on a
/// question — they will miss it, and it may have been the one telling them an
/// answer did not save.
export function ExamNotice({
  tone = "info",
  title,
  children,
  className = "",
}: {
  tone?: Exclude<ExamTone, "neutral">;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = NOTICE_TONE[tone];

  return (
    <div
      // Errors and warnings interrupt; success and info wait their turn.
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={["flex gap-3 rounded-exam-md border p-4", box, className].join(" ")}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-[18px] shrink-0" />
      <div className="min-w-0 text-sm">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}

/// A full-bleed strip across the top of the exam, for a condition that applies
/// to the whole screen rather than to one control — time expired, most of all.
/// Separate from `ExamNotice` because it is not in the content flow and must
/// not inherit its rounding or inset.
export function ExamBanner({
  tone = "danger",
  children,
  className = "",
}: {
  tone?: Exclude<ExamTone, "neutral">;
  children: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = NOTICE_TONE[tone];

  return (
    <div
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={[
        "flex items-center justify-center gap-2 border-b px-4 py-3 text-sm font-medium",
        box,
        className,
      ].join(" ")}
    >
      <Icon aria-hidden="true" className="size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

const STATUS_TONE: Record<ExamTone, string> = {
  success: "bg-exam-success-bg text-exam-success",
  warning: "bg-exam-warning-bg text-exam-warning",
  danger: "bg-exam-danger-bg text-exam-danger",
  info: "bg-exam-info-bg text-exam-info",
  neutral: "bg-exam-neutral-bg text-exam-neutral",
};

/// A small status label — a save state, a section marker. Always carries its
/// text: color alone never conveys meaning on the candidate side.
export function ExamStatus({
  tone = "neutral",
  icon,
  children,
  className = "",
}: {
  tone?: ExamTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-exam-sm px-2 py-0.5",
        "text-xs font-medium whitespace-nowrap",
        STATUS_TONE[tone],
        className,
      ].join(" ")}
    >
      {icon}
      {children}
    </span>
  );
}

/// A property rather than a state — marks, section number, question type.
/// Outlined and neutral so it never competes with a real status.
export function ExamChip({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-exam-sm border border-exam-line-strong px-2 py-0.5",
        "text-xs font-medium text-exam-ink-secondary whitespace-nowrap",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
