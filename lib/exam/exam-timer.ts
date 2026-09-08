import "server-only";

import { prisma } from "@/lib/db";

/// Server-authoritative exam timing.
///
/// The deadline is always `startedAt + durationMinutes`, computed from the
/// attempt row and the current settings. Nothing the browser reports about time
/// is trusted: a candidate who changes their machine's clock, reloads, or leaves
/// and returns gets the same deadline they started with.

export type TimingState = {
  serverNow: number;
  expiresAt: number;
  remainingSeconds: number;
  durationMinutes: number;
  expired: boolean;
};

export type AttemptTiming =
  | { kind: "ok"; timing: TimingState }
  | { kind: "not-found" }
  | { kind: "finished" };

export function computeTiming(startedAt: Date, durationMinutes: number, now = Date.now()): TimingState {
  const expiresAt = startedAt.getTime() + durationMinutes * 60_000;
  const remainingMs = expiresAt - now;

  return {
    serverNow: now,
    expiresAt,
    remainingSeconds: Math.max(0, Math.floor(remainingMs / 1000)),
    durationMinutes,
    expired: remainingMs <= 0,
  };
}

/// Reads the live timing for an attempt. The attempt id must already have been
/// resolved from the session cookie by the caller.
export async function getAttemptTiming(attemptId: string): Promise<AttemptTiming> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { startedAt: true, status: true },
  });

  if (!attempt) {
    return { kind: "not-found" };
  }

  if (attempt.status !== "in_progress") {
    return { kind: "finished" };
  }

  const settings = await prisma.examSetting.findUniqueOrThrow({
    where: { id: "singleton" },
    select: { durationMinutes: true },
  });

  return { kind: "ok", timing: computeTiming(attempt.startedAt, settings.durationMinutes) };
}
