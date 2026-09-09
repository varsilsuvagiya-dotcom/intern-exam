-- Phase 12: scoring engine.
--
-- Additive only. No existing column, constraint or index is dropped or altered.

-- 1. Snapshot the historical "is this question scored" flag on the drawn paper.
--    Without it, scoring a past attempt would have to consult the live Question
--    row, and an admin flipping `scored` there would silently rewrite history.
ALTER TABLE "attempt_questions"
    ADD COLUMN IF NOT EXISTS "scored" BOOLEAN NOT NULL DEFAULT true;

-- Backfill existing papers from the question bank as it stands right now. This
-- is the only moment the live Question row is a legitimate source: these rows
-- predate the column, and the bank has not been edited since they were drawn.
UPDATE "attempt_questions" AS aq
   SET "scored" = q."scored"
  FROM "questions" AS q
 WHERE q."id" = aq."question_id";

-- 2. Per-section and total scores, as explicit typed columns.
--    Decimal(5,2) matches the existing total_score column: 70.00 fits, and two
--    decimal places cover the 1 / 1.5 / 2 / 2.5 mark values exactly.
ALTER TABLE "attempts"
    ADD COLUMN IF NOT EXISTS "section_1_score" DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS "section_2_score" DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS "section_3_score" DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS "section_4_score" DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS "section_5_score" DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS "section_6_score" DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS "section_7_score" DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS "section_8_score" DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS "scored_at" TIMESTAMP(3);

-- 3. A stored score can never fall outside the marks a valid paper can produce.
--    The engine already refuses to persist an out-of-range total; this makes a
--    bad write impossible rather than merely unlikely.
ALTER TABLE "attempts"
    ADD CONSTRAINT "attempts_total_score_range_check"
    CHECK ("total_score" IS NULL OR ("total_score" >= 0 AND "total_score" <= 70));

-- Finding the attempts still awaiting scoring must not scan the whole table.
CREATE INDEX IF NOT EXISTS "attempts_scored_at_idx" ON "attempts"("scored_at");
