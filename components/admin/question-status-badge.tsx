import { Badge, Chip, type StatusTone } from "@/components/ui/badge";
import type { Difficulty, QuestionStatus } from "@/lib/generated/prisma/enums";

/// A question carries two independent states, and conflating them would be a
/// lie about the data:
///
///   `status`   — where the question is in its authoring workflow.
///   `isActive` — whether it may be drawn into an exam at all.
///
/// A `ready` question can still be inactive, and a `draft` one can still be
/// active. So they are presented as two distinct badges rather than merged
/// into a single invented state.

const STATUS_TONE: Record<QuestionStatus, StatusTone> = {
  // Neither is a problem, so neither is a warning: they are stages of work.
  draft: "neutral",
  review: "info",
  ready: "success",
};

const STATUS_LABEL: Record<QuestionStatus, string> = {
  draft: "Draft",
  review: "Review",
  ready: "Ready",
};

export function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

/// Inactive is the notable state — it means the question is excluded from
/// exams — so it is the one that gets a tone. Active is the norm and stays
/// quiet, to avoid a wall of green down the column.
export function QuestionActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="text-[13px] text-ink-secondary">Active</span>
  ) : (
    <Badge tone="warning">Inactive</Badge>
  );
}

/// Difficulty is a property, not a state. The design system reserves filled
/// status tones for states, so difficulty uses the outlined Chip and earns its
/// distinction from weight rather than from invented colors.
const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function DifficultyChip({ difficulty }: { difficulty: Difficulty }) {
  return <Chip>{DIFFICULTY_LABEL[difficulty]}</Chip>;
}
