"use client";

import { AlertCircle, Check, Loader2 } from "lucide-react";

import type { SaveStatus } from "./use-autosave";

/// Renders the autosave state the hook actually reports.
///
/// It has no state of its own and no timers: every word here is driven by
/// `useAutosave`, so "Saved" appears only once the server has confirmed the
/// write. The wording for a failure is unchanged from before this phase —
/// it tells the candidate the honest thing, that the retry happens when they
/// next change the answer.
const PRESENTATION: Record<
  Exclude<SaveStatus, "idle">,
  { label: string; short: string; className: string; icon: typeof Check }
> = {
  saving: {
    label: "Saving…",
    short: "Saving…",
    className: "text-exam-muted",
    icon: Loader2,
  },
  saved: {
    label: "Answer saved",
    short: "Saved",
    className: "text-exam-success",
    icon: Check,
  },
  failed: {
    label: "Not saved — retrying when you change it again",
    short: "Not saved",
    className: "text-exam-danger",
    icon: AlertCircle,
  },
  expired: {
    label: "Time is up",
    short: "Time is up",
    className: "text-exam-danger",
    icon: AlertCircle,
  },
};

export function ExamSaveStatus({
  status,
  className = "",
}: {
  status: SaveStatus;
  className?: string;
}) {
  // Before the first save there is genuinely nothing to report. The region
  // still renders so it can announce later without being inserted.
  const presentation = status === "idle" ? null : PRESENTATION[status];

  return (
    <p
      role="status"
      className={[
        "flex items-center gap-1.5 text-[13px] font-medium",
        presentation?.className ?? "",
        className,
      ].join(" ")}
    >
      {presentation ? (
        <>
          <presentation.icon
            aria-hidden="true"
            className={[
              "size-3.5 shrink-0",
              status === "saving" ? "animate-spin motion-reduce:animate-none" : "",
            ].join(" ")}
          />
          {/* One string in the accessibility tree, always the full sentence:
              the visible short form is `aria-hidden`, so a screen reader is
              not read two versions of the same status, and what it announces
              does not change with the viewport. */}
          <span aria-hidden="true" className="max-lg:hidden">
            {presentation.label}
          </span>
          <span aria-hidden="true" className="lg:hidden">
            {presentation.short}
          </span>
          <span className="sr-only">{presentation.label}</span>
        </>
      ) : null}
    </p>
  );
}
