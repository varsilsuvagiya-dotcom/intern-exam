-- Additive anti-cheating layer: a per-attempt violation counter, an
-- append-only violation log, and the server-authoritative limit that decides
-- when an attempt is terminated for unauthorized activity.
--
-- Nothing existing is altered: no column is dropped, no existing enum value
-- is removed or renamed, and every new column is either nullable or carries a
-- default, so every current row remains valid without a backfill.

-- `terminated` is a new terminal outcome alongside the existing submitted /
-- auto_submitted, distinguishing "ended by the anti-cheating limit" from
-- "ended because time ran out". Existing rows are unaffected: adding an enum
-- value never touches data already stored under the earlier values.
ALTER TYPE "AttemptStatus" ADD VALUE 'terminated';

CREATE TYPE "TerminationReason" AS ENUM ('UNAUTHORIZED_ACTIVITY');

CREATE TYPE "ViolationType" AS ENUM (
  'TAB_SWITCH',
  'WINDOW_BLUR',
  'FULLSCREEN_EXIT',
  'COPY',
  'CUT',
  'PASTE',
  'CONTEXT_MENU',
  'KEYBOARD_SHORTCUT',
  'DEVTOOLS',
  'PRINT',
  'PAGE_LEAVE',
  'DRAG_DROP',
  'OTHER'
);

ALTER TABLE "attempts" ADD COLUMN "violation_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "attempts" ADD COLUMN "termination_reason" "TerminationReason";

ALTER TABLE "exam_settings" ADD COLUMN "unauthorized_activity_limit" INTEGER NOT NULL DEFAULT 3;

CREATE TABLE "exam_violations" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "type" "ViolationType" NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_violations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "exam_violations_attempt_id_sequence_idx" ON "exam_violations" ("attempt_id", "sequence");

ALTER TABLE "exam_violations" ADD CONSTRAINT "exam_violations_attempt_id_fkey"
  FOREIGN KEY ("attempt_id") REFERENCES "attempts" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
