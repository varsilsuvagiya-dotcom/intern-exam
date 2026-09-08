"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { persistAnswer } from "./actions";

export type SaveStatus = "idle" | "saving" | "saved" | "failed" | "expired";

/// Free text saves after a pause rather than on every keystroke.
const TEXT_DEBOUNCE_MS = 600;

type Pending = { value: { selectedOption?: string | null; textAnswer?: string | null } };

/// Persists answers as the candidate works.
///
/// Each question carries its own sequence number. A response is only applied if
/// it belongs to the newest request for that question, so a slow save of "B"
/// landing after a fast save of "C" cannot make the UI claim B was stored.
export function useAutosave(onExpired: () => void) {
  const [status, setStatus] = useState<SaveStatus>("idle");

  const sequences = useRef<Map<string, number>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pending = useRef<Map<string, Pending>>(new Map());

  const send = useCallback(
    async (questionId: string, value: Pending["value"]) => {
      const sequence = (sequences.current.get(questionId) ?? 0) + 1;
      sequences.current.set(questionId, sequence);

      setStatus("saving");

      try {
        const result = await persistAnswer(questionId, value);

        // A newer save for this question started while this one was in flight;
        // its result is the one that matters.
        if (sequences.current.get(questionId) !== sequence) {
          return;
        }

        if (result.kind === "saved") {
          setStatus("saved");
          return;
        }

        if (result.kind === "expired" || result.kind === "finished") {
          setStatus("expired");
          onExpired();
          return;
        }

        setStatus("failed");
      } catch {
        if (sequences.current.get(questionId) === sequence) {
          setStatus("failed");
        }
      }
    },
    [onExpired],
  );

  /// MCQ answers save immediately; free text waits for a pause in typing.
  const save = useCallback(
    (questionId: string, value: Pending["value"], debounce: boolean) => {
      const existing = timers.current.get(questionId);

      if (existing) {
        clearTimeout(existing);
        timers.current.delete(questionId);
      }

      if (!debounce) {
        pending.current.delete(questionId);
        void send(questionId, value);
        return;
      }

      pending.current.set(questionId, { value });
      setStatus("saving");

      timers.current.set(
        questionId,
        setTimeout(() => {
          timers.current.delete(questionId);
          pending.current.delete(questionId);
          void send(questionId, value);
        }, TEXT_DEBOUNCE_MS),
      );
    },
    [send],
  );

  // Flush anything still waiting on its debounce if the candidate navigates
  // away, so the last thing they typed is not lost to the timer.
  useEffect(() => {
    const flush = () => {
      for (const [questionId, timer] of timers.current) {
        clearTimeout(timer);
        const waiting = pending.current.get(questionId);
        if (waiting) {
          void send(questionId, waiting.value);
        }
      }
      timers.current.clear();
      pending.current.clear();
    };

    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [send]);

  return { status, save };
}
