"use client";

import { useEffect, useRef, useState } from "react";

import type { TimingState } from "@/lib/exam/exam-timer";

import { fetchTiming } from "./actions";

/// Re-synced with the server this often. The countdown between syncs is only a
/// display: the server's deadline is what actually governs the exam.
const RESYNC_MS = 30_000;

/// The one threshold this component has ever had. It is a presentation
/// threshold, not a business rule — nothing server-side changes at five
/// minutes — so it is styled here rather than moved.
const LOW_SECONDS = 300;

/// Hours are shown only once the exam is long enough to need them. A 75-minute
/// paper reads "01:14:59" at the start and "09:59" near the end, rather than
/// "74:59", which is hard to convert under pressure.
function format(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(rest).padStart(2, "0");

  return hours > 0 ? `${String(hours).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}

/// Spoken form for the announcement. Screen readers say "01:14:59" as digits;
/// this says what a person would say.
function spoken(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  if (minutes <= 1) return "1 minute of examination time remaining.";
  return `${minutes} minutes of examination time remaining.`;
}

export function ExamTimerDisplay({
  initial,
  onExpire,
}: {
  initial: TimingState;
  onExpire: () => void;
}) {
  const [remaining, setRemaining] = useState(initial.remainingSeconds);

  // The offset between this browser's clock and the server's, measured on mount
  // and at every sync. Counting from it means changing the machine's clock
  // shifts both sides equally and cannot buy extra time.
  const skewRef = useRef(0);
  const expiresAtRef = useRef(initial.expiresAt);
  const expiredRef = useRef(false);

  useEffect(() => {
    skewRef.current = initial.serverNow - Date.now();

    const tick = () => {
      const serverNow = Date.now() + skewRef.current;
      const left = Math.max(0, Math.floor((expiresAtRef.current - serverNow) / 1000));
      setRemaining(left);

      if (left === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };

    tick();
    const ticker = setInterval(tick, 1000);

    const resync = setInterval(async () => {
      const response = await fetchTiming();

      if (response.kind === "ok") {
        skewRef.current = response.timing.serverNow - Date.now();
        expiresAtRef.current = response.timing.expiresAt;

        if (response.timing.expired && !expiredRef.current) {
          expiredRef.current = true;
          onExpire();
        }
      } else if (!expiredRef.current) {
        // The attempt is gone or no longer in progress; stop answering.
        expiredRef.current = true;
        onExpire();
      }
    }, RESYNC_MS);

    return () => {
      clearInterval(ticker);
      clearInterval(resync);
    };
  }, [initial.serverNow, onExpire]);

  const expired = remaining === 0;
  const low = remaining <= LOW_SECONDS && !expired;

  // Announced at five minutes and then at each whole minute below it, rather
  // than on every tick. Previously the countdown itself became the live region
  // once it went low, so a screen reader read out all three hundred remaining
  // seconds one by one.
  const announcement = expired
    ? "Examination time has ended."
    : low && remaining % 60 === 0
      ? spoken(remaining)
      : "";

  return (
    <div className="flex flex-col items-end leading-none">
      <span
        id="exam-timer-label"
        className="text-[11px] font-medium uppercase tracking-wide text-exam-muted"
      >
        Time remaining
      </span>

      {/* `role="timer"` names this for assistive tech without making it a live
          region; the announcement below is what actually speaks. */}
      <span
        role="timer"
        aria-labelledby="exam-timer-label"
        className={[
          "exam-tabular mt-1 text-[26px] font-semibold tracking-tight tabular-nums",
          expired ? "text-exam-danger" : low ? "text-exam-danger" : "text-exam-ink",
        ].join(" ")}
      >
        {format(remaining)}
      </span>

      {/* The low state is never carried by colour alone: the red is paired
          with a word. */}
      {low || expired ? (
        <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-exam-danger">
          {expired ? "Time is up" : "Ending soon"}
        </span>
      ) : null}

      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
