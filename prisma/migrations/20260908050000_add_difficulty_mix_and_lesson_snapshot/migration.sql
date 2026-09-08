-- Two additions needed by paper generation.
--
-- 1. The difficulty mix. The original requirements list it as admin-editable
--    exam configuration, and unlike the section counts it is genuinely tunable,
--    so it belongs in settings rather than in code. Defaults are the specified
--    40/40/20; a check constraint keeps the three from drifting off 100.
--
-- 2. The section 7 lesson snapshot. A drawn paper must render its lesson text
--    without reading the live question row, the same reason the rest of the
--    question content is already snapshotted here. Nullable, because only
--    section 7 carries a lesson.
--
-- Written by hand for the same reason as the earlier migrations: generating it
-- needs a shadow database the Supabase pooler does not allow, and diffing
-- against the live database emits DROP statements for the partial unique index
-- `attempts_one_in_progress_per_candidate` and the option-order check
-- constraint, neither of which Prisma's schema syntax can express.
--
-- Purely additive: five nullable-or-defaulted columns and one check constraint.
-- No existing table, index, or constraint is touched, and the defaults mean the
-- existing settings row needs no backfill.

ALTER TABLE "exam_settings"
    ADD COLUMN "easy_percent"   INTEGER NOT NULL DEFAULT 40,
    ADD COLUMN "medium_percent" INTEGER NOT NULL DEFAULT 40,
    ADD COLUMN "hard_percent"   INTEGER NOT NULL DEFAULT 20;

-- A mix that does not add up to 100 is not a valid target, whatever wrote it.
ALTER TABLE "exam_settings"
    ADD CONSTRAINT "exam_settings_difficulty_mix_check"
    CHECK (
        "easy_percent" >= 0 AND "medium_percent" >= 0 AND "hard_percent" >= 0
        AND "easy_percent" + "medium_percent" + "hard_percent" = 100
    );

ALTER TABLE "attempt_questions"
    ADD COLUMN "lesson_text"  TEXT,
    ADD COLUMN "lesson_group" TEXT;
