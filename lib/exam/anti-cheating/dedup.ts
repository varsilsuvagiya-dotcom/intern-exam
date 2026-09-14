import type { ViolationType } from "./types";

/// Several browser events can fire for one candidate action — a tab switch is
/// itself a blur, so `visibilitychange` and `window.blur` commonly land
/// together, and opening DevTools can trigger both a keyboard shortcut report
/// and, moments later, the window-dimension heuristic. Grouping related types
/// under one canonical label lets them collapse to a single report, but the
/// grouping alone under-covers a burst: two *different* canonical types
/// arriving from the same physical action (e.g. TAB_SWITCH and DEVTOOLS
/// firing together) were still counted as two violations. So the rule is two
/// layers: any event inside a very short burst window of the previous one is
/// the same incident regardless of type, and *in addition* one canonical
/// type is suppressed for a longer window so its own repeats do not restart
/// the count.
const DEDUP_GROUP: Partial<Record<ViolationType, ViolationType>> = {
  WINDOW_BLUR: "TAB_SWITCH",
};

/// Any violation arriving this soon after the previous one is folded into the
/// same incident, whatever type either one is. Covers same-action event
/// storms (blur + visibilitychange + a resize-triggered heuristic all firing
/// within the same tick or two).
export const BURST_WINDOW_MS = 800;

/// A longer window during which a repeat of the *same* canonical type is
/// still suppressed, so (for example) DevTools staying open does not keep
/// re-reporting on every subsequent resize tick.
export const DEDUP_WINDOW_MS = 1500;

export function canonicalViolationType(type: ViolationType): ViolationType {
  return DEDUP_GROUP[type] ?? type;
}

/// Whether a violation of `type`, detected at `now`, should be reported given
/// what was last reported. Pure so the windowing rule can be tested without a
/// browser or a timer.
export function shouldReport(
  type: ViolationType,
  now: number,
  last: { type: ViolationType; at: number } | null,
  windowMs: number = DEDUP_WINDOW_MS,
  burstMs: number = BURST_WINDOW_MS,
): boolean {
  if (!last) return true;

  if (now - last.at < burstMs) return false;

  const canonical = canonicalViolationType(type);
  if (last.type !== canonical) return true;

  return now - last.at >= windowMs;
}
