"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { persistAnswer } from "./actions";

export type SaveStatus = "idle" | "saving" | "saved" | "failed" | "expired";

/// Free text saves after a pause rather than on every keystroke.
const TEXT_DEBOUNCE_MS = 600;

/// The longest `flush()` will wait for outstanding saves before reporting that
/// it could not confirm them. Generous enough for a full paper's queue settling
/// against a remote database, short enough that a candidate is never left
/// waiting on a request that will never land.
const FLUSH_TIMEOUT_MS = 30_000;

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
  ///
  /// The wait is bounded. A Server Action whose connection dropped mid-flight
  /// does not reject promptly — the browser keeps retrying underneath and the
  /// promise can stay pending indefinitely. Waiting on it forever meant one
  /// momentary network blip left every later flush hanging, so the submit
  /// dialog sat on "Saving and checking your answers…" with no way forward.
  /// Timing out resolves false rather than true: the honest answer is that the
  /// saves could not be confirmed, and the dialog already refuses to state
  /// counts it cannot trust and offers a retry.
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

    if (waiting.length === 0) {
      return true;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), FLUSH_TIMEOUT_MS);
    });

    try {
      const results = await Promise.race([
        Promise.all(waiting).then((values) => values.every(Boolean)),
        timedOut,
      ]);

      if (!results) {
        // Whatever is still pending is not going to land. Dropping it stops one
        // abandoned request from making every later flush time out too; it can
        // still settle on its own, and its own sequence check decides whether
        // its result is applied.
        inFlight.current.clear();
      }

      return results;
    } finally {
      clearTimeout(timer);
    }
  }, [send]);

  // Best-effort flush if the candidate navigates away mid-typing.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

  return { status, save, flush };
}
