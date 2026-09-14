import { Badge, Chip } from "@/components/ui/badge";
import type { Difficulty } from "@/lib/generated/prisma/enums";

/// A question has exactly one state that matters for exams: whether it may be
/// drawn into a paper. `isActive` is the whole of it — there is no separate
/// authoring workflow to track alongside it.

export function QuestionActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge tone="success">Active</Badge>
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
