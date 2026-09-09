-- Persistent exam progress recovery.
--
-- Two additive columns, both nullable or defaulted, so every existing attempt
-- stays valid: an attempt with no recorded position resumes at its first
-- question exactly as it did before, and a question with no visited_at reads
-- as "Not seen". No historical progress is invented.

ALTER TABLE "attempts"
  ADD COLUMN "current_display_order" INTEGER,
  ADD COLUMN "current_position_seq" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "attempt_questions"
  ADD COLUMN "visited_at" TIMESTAMP(3);
