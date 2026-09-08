import "server-only";

import type { Difficulty } from "@/lib/generated/prisma/enums";

export type DifficultyMix = { easy: number; medium: number; hard: number };
export type DifficultyCounts = Record<Difficulty, number>;

export const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

/// Turns a percentage mix into whole question counts for one section, then
/// bends the result to fit what the question bank actually holds.
///
/// Rounding uses largest-remainder: floor every share, then hand the leftover
/// questions to the difficulties with the largest fractional parts, breaking
/// ties in easy/medium/hard order. This always sums to exactly `required`,
/// where naive rounding would not — 40/40/20 of 4 questions is 1.6/1.6/0.8,
/// which rounds to 2/2/1 and overshoots.
///
/// Scarcity is then handled by clamping any difficulty to what exists and
/// redistributing the shortfall to difficulties that still have spare
/// questions, so a section reaches its exact count whenever the bank holds
/// enough questions overall. It returns null only when it genuinely cannot:
/// too few eligible questions in total.
export function allocateDifficultyCounts(
  required: number,
  mix: DifficultyMix,
  available: DifficultyCounts,
): DifficultyCounts | null {
  const totalAvailable = DIFFICULTY_ORDER.reduce((sum, key) => sum + available[key], 0);

  if (totalAvailable < required) {
    return null;
  }

  const exact: Record<Difficulty, number> = {
    easy: (required * mix.easy) / 100,
    medium: (required * mix.medium) / 100,
    hard: (required * mix.hard) / 100,
  };

  const counts: DifficultyCounts = {
    easy: Math.floor(exact.easy),
    medium: Math.floor(exact.medium),
    hard: Math.floor(exact.hard),
  };

  let remainder = required - DIFFICULTY_ORDER.reduce((sum, key) => sum + counts[key], 0);

  const byFraction = [...DIFFICULTY_ORDER].sort((a, b) => {
    const diff = (exact[b] - Math.floor(exact[b])) - (exact[a] - Math.floor(exact[a]));
    return diff !== 0 ? diff : DIFFICULTY_ORDER.indexOf(a) - DIFFICULTY_ORDER.indexOf(b);
  });

  for (const key of byFraction) {
    if (remainder <= 0) break;
    counts[key] += 1;
    remainder -= 1;
  }

  // Clamp to what the bank holds, collecting whatever could not be placed.
  let shortfall = 0;
  for (const key of DIFFICULTY_ORDER) {
    if (counts[key] > available[key]) {
      shortfall += counts[key] - available[key];
      counts[key] = available[key];
    }
  }

  // Push the shortfall onto whichever difficulties still have room. Ordered by
  // spare capacity so the result stays as close to the target mix as the bank
  // allows.
  while (shortfall > 0) {
    const candidates = DIFFICULTY_ORDER.filter((key) => available[key] > counts[key]).sort(
      (a, b) => available[b] - counts[b] - (available[a] - counts[a]),
    );

    if (candidates.length === 0) {
      return null;
    }

    counts[candidates[0]] += 1;
    shortfall -= 1;
  }

  return counts;
}
