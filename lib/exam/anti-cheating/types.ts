import type { ViolationType } from "@/lib/generated/prisma/enums";

export type { ViolationType };

/// Result of reporting one detected event to the server.
///
/// The browser only ever learns the count and the limit after the fact, never
/// before — there is no client-readable "how many warnings are left" beyond
/// what the last response said.
export type RecordViolationResult =
  | { kind: "warning"; count: number; limit: number }
  /// The limit was reached by this event; the attempt is now terminated.
  | { kind: "terminated"; count: number; limit: number }
  /// The attempt was already finished (by any means) before this event
  /// arrived. Nothing was recorded against it.
  | { kind: "already-final" }
  | { kind: "unauthorized" };

/// Whether a violation count that has just reached `count` should terminate
/// the attempt. Pure and separate from the transaction in service.ts so the
/// limit rule itself — not the database plumbing around it — can be unit
/// tested directly, and so the limit is never duplicated as a second
/// hardcoded comparison anywhere else.
export function reachesLimit(count: number, limit: number): boolean {
  return count >= limit;
}
