"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { VIOLATION_TYPE_LABELS, type ViolationSummary } from "@/lib/admin/violation-types";

/// Live unauthorized-activity view on the attempt detail page.
///
/// Polls rather than pushes: the admin side of this project has no
/// realtime/websocket infrastructure (every admin page is plain
/// server-rendered), and this one panel is not reason enough to add one.
/// Polling stops once the attempt is no longer in progress — a finished
/// attempt's violation log does not change, so there is nothing left to poll
/// for.
const POLL_MS = 8000;

function formatTime(value: Date): string {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ViolationPanel({
  attemptId,
  initial,
  fetchSummary,
}: {
  attemptId: string;
  initial: ViolationSummary;
  /// The server action that re-reads the summary. Passed in rather than
  /// imported directly so this component stays decoupled from exactly which
  /// route's actions.ts supplies it.
  fetchSummary: (attemptId: string) => Promise<ViolationSummary | null>;
}) {
  const [summary, setSummary] = useState(initial);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (summary.status !== "in_progress") return;

    let cancelled = false;

    const interval = setInterval(() => {
      void fetchSummary(attemptId).then((next) => {
        if (!cancelled && next) setSummary(next);
      });
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId, summary.status]);

  const tone = summary.count === 0 ? "neutral" : summary.count >= summary.limit ? "danger" : "warning";

  return (
    <section className="rounded-lg border border-line bg-surface p-4 lg:p-5">
      <h2 className="text-[13px] font-medium tracking-[0.04em] text-muted uppercase">
        Unauthorized activity
      </h2>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          disabled={summary.rows.length === 0}
          className="inline-flex items-center gap-2 rounded-md disabled:cursor-default"
        >
          <Badge tone={tone}>
            {summary.count} / {summary.limit}
          </Badge>
          {summary.rows.length > 0 ? (
            <span className="text-xs font-medium text-primary hover:underline">
              {open ? "Hide details" : "View details"}
            </span>
          ) : null}
        </button>
      </div>

      {open && summary.rows.length > 0 ? (
        <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto border-t border-line pt-3">
          {summary.rows.map((row) => (
            <li key={row.id} className="flex items-baseline gap-2 text-sm">
              <span className="tabular shrink-0 text-muted">{formatTime(row.detectedAt)}</span>
              <span className="text-ink">{VIOLATION_TYPE_LABELS[row.type]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
