import "server-only";

import { prisma } from "@/lib/db";

import type { ViolationSummary } from "./violation-types";

/// Read-only admin view of one attempt's anti-cheating record. Never writes:
/// violations are created only by the candidate-facing service in
/// lib/exam/anti-cheating/service.ts.

export async function getViolationSummary(attemptId: string): Promise<ViolationSummary | null> {
  const [attempt, settings, rows] = await Promise.all([
    prisma.attempt.findUnique({
      where: { id: attemptId },
      select: { status: true, violationCount: true },
    }),
    prisma.examSetting.findUniqueOrThrow({
      where: { id: "singleton" },
      select: { unauthorizedActivityLimit: true },
    }),
    prisma.examViolation.findMany({
      where: { attemptId },
      orderBy: { sequence: "asc" },
      select: { id: true, type: true, detectedAt: true, sequence: true },
    }),
  ]);

  if (!attempt) {
    return null;
  }

  return {
    count: attempt.violationCount,
    limit: settings.unauthorizedActivityLimit,
    status: attempt.status,
    rows,
  };
}
