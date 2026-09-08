"use client";

import { useEffect, useRef, useState } from "react";

import type { TimingState } from "@/lib/exam/exam-timer";

import { fetchTiming } from "./actions";

/// Re-synced with the server this often. The countdown between syncs is only a
/// display: the server's deadline is what actually governs the exam.
const RESYNC_MS = 30_000;

function format(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
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

  const low = remaining <= 300 && remaining > 0;

  return (
    <span className="text-sm text-black/60 dark:text-white/60">
      Time remaining:{" "}
      <span
        className={`font-medium tabular-nums ${low ? "text-red-600 dark:text-red-400" : ""}`}
        aria-live={low ? "polite" : "off"}
      >
        {remaining === 0 ? "00:00" : format(remaining)}
      </span>
    </span>
  );
}
