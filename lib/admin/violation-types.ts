import type { ViolationType } from "@/lib/generated/prisma/enums";

/// Client-safe types and labels for the admin violation UI. Split out from
/// attempt-violations.ts (which is `server-only` and imports Prisma) so the
/// client-side ViolationPanel can use these without pulling the database
/// client into the browser bundle.

export type ViolationRow = {
  id: string;
  type: ViolationType;
  detectedAt: Date;
  sequence: number;
};

export type ViolationSummary = {
  count: number;
  limit: number;
  status: "in_progress" | "submitted" | "auto_submitted" | "terminated";
  rows: ViolationRow[];
};

/// Human labels for the stored enum, mirroring STATUS_LABELS' pattern in
/// query-attempts.ts: the stored value is never changed, only its label.
export const VIOLATION_TYPE_LABELS: Record<ViolationType, string> = {
  TAB_SWITCH: "Tab switch",
  WINDOW_BLUR: "Window switch",
  FULLSCREEN_EXIT: "Fullscreen exit",
  COPY: "Copy attempt",
  CUT: "Cut attempt",
  PASTE: "Paste attempt",
  CONTEXT_MENU: "Right-click",
  KEYBOARD_SHORTCUT: "Restricted shortcut",
  DEVTOOLS: "Potential DevTools activity",
  PRINT: "Print attempt",
  PAGE_LEAVE: "Page leave / close",
  DRAG_DROP: "Drag and drop",
  OTHER: "Other activity",
};
