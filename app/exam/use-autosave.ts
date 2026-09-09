"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { persistAnswer } from "./actions";

export type SaveStatus = "idle" | "saving" | "saved" | "failed" | "expired";

/// Free text saves after a pause rather than on every keystroke.
const TEXT_DEBOUNCE_MS = 600;

type Value = { selectedOption?: string | null; textAnswer?: string | null };

/// Persists answers as the candidate works.
///
/// Each question carries its own sequence number. A response is only applied if
/// it belongs to the newest request for that question, so a slow save of "B"
/// landing after a fast save of "C" cannot make the UI claim B was stored.
export function useAutosave(onExpired: () => void) {
  const [status, setStatus] = useState<SaveStatus>("idle");

  const sequences = useRef<Map<string, number>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pending = useRef<Map<string, Value>>(new Map());
  const inFlight = useRef<Set<Promise<boolean>>>(new Set());

  const send = useCallback(
    (questionId: string, value: Value): Promise<boolean> => {
      const sequence = (sequences.current.get(questionId) ?? 0) + 1;
      sequences.current.set(questionId, sequence);

      setStatus("saving");

      const request = (async (): Promise<boolean> => {
        try {
          const result = await persistAnswer(questionId, value);

          // A newer save for this question started while this one was in
          // flight; that one's result is the one that matters.
          if (sequences.current.get(questionId) !== sequence) {
            return true;
          }

          if (result.kind === "saved") {
            setStatus("saved");
            return true;
          }

          if (result.kind === "expired" || result.kind === "finished") {
            setStatus("expired");
            onExpired();
            return false;
          }

          setStatus("failed");
          return false;
        } catch {
          if (sequences.current.get(questionId) === sequence) {
            setStatus("failed");
          }
          return false;
        }
      })();

      inFlight.current.add(request);
      void request.finally(() => inFlight.current.delete(request));

      return request;
    },
    [onExpired],
  );

  /// MCQ answers save immediately; free text waits for a pause in typing.
  const save = useCallback(
    (questionId: string, value: Value, debounce: boolean) => {
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

      pending.current.set(questionId, value);
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

  /// Sends anything still waiting on its debounce and waits for every request to
  /// land. Resolves false if any save failed, so a submission can refuse to
  /// proceed on counts that would be wrong.
  const flush = useCallback(async (): Promise<boolean> => {
    const waiting: Promise<boolean>[] = [];

    for (const [questionId, timer] of timers.current) {
      clearTimeout(timer);
      const value = pending.current.get(questionId);
      if (value) {
        waiting.push(send(questionId, value));
      }
    }

    timers.current.clear();
    pending.current.clear();
    waiting.push(...inFlight.current);

    const results = await Promise.all(waiting);
    return results.every(Boolean);
  }, [send]);

  // Best-effort flush if the candidate navigates away mid-typing.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

  return { status, save, flush };
}
