"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getViolationSummary } from "@/lib/admin/attempt-violations";
import type { ViolationSummary } from "@/lib/admin/violation-types";

/// Backs the live violation panel on the attempt detail page. Polled on an
/// interval rather than pushed — this project has no realtime/websocket
/// infrastructure, and one small polling action is not reason enough to add
/// one. Admin-gated the same way every other admin action is; the attempt id
/// carries no more access than the attempt detail page itself already grants.
export async function fetchAttemptViolations(attemptId: string): Promise<ViolationSummary | null> {
  await requireAdmin();

  if (typeof attemptId !== "string" || attemptId === "" || attemptId.length > 100) {
    return null;
  }

  return getViolationSummary(attemptId);
}
