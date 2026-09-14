import { Badge, type StatusTone } from "@/components/ui/badge";
import type { AttemptStatus } from "@/lib/generated/prisma/enums";

/// The stored `AttemptStatus` enum, presented.
///
/// The database value is never changed — only its label and tone. There are
/// exactly three statuses in CloudUS; no "completed", "passed" or "expired"
/// exists, and none may be invented here.
///
/// `auto_submitted` is a warning rather than an error: the candidate ran out of
/// time, which is worth noticing but is not a failure.
const TONE: Record<AttemptStatus, StatusTone> = {
  in_progress: "info",
  submitted: "success",
  auto_submitted: "warning",
  terminated: "danger",
};

export function AttemptStatusBadge({
  status,
  label,
}: {
  status: AttemptStatus;
  /// The label the query layer already produced, so wording lives in one place.
  label: string;
}) {
  return <Badge tone={TONE[status]}>{label}</Badge>;
}
