import type { ReactNode } from "react";

import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";

import type { StatusTone } from "./badge";

/// An Alert says "read this before continuing": validation failures, blocking
/// errors, and persistent conditions like a closed exam or a pending score.
///
/// It is deliberately distinct from a Toast, which says "that worked, carry on".
/// An error the admin must act on is never a toast — it belongs here, in the
/// content flow, where it stays until the condition is resolved.
export type AlertTone = Extract<StatusTone, "success" | "warning" | "danger" | "info">;

const TONE: Record<AlertTone, { box: string; icon: typeof Info }> = {
  success: { box: "bg-success-bg border-success/30 text-success", icon: CheckCircle2 },
  warning: { box: "bg-warning-bg border-warning/30 text-warning", icon: AlertTriangle },
  danger: { box: "bg-danger-bg border-danger/30 text-danger", icon: AlertCircle },
  info: { box: "bg-info-bg border-info/30 text-info", icon: Info },
};

export function Alert({
  tone = "info",
  title,
  children,
  className = "",
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = TONE[tone];

  return (
    <div
      // Errors and warnings are announced; success and info are not urgent
      // enough to interrupt a screen reader mid-sentence.
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={["flex gap-3 rounded-md border p-4", box, className].join(" ")}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 text-sm">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
      </div>
    </div>
  );
}
