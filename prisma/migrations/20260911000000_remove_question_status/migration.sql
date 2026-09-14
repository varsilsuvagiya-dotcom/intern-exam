-- Collapses the question workflow to two states: active or inactive.
--
-- The three-stage authoring status (draft / review / ready) is removed
-- entirely. Paper generation now draws on isActive alone; a question no
-- longer needs to be marked "ready" before it can also be activated. New
-- questions still start inactive (the isActive default already read `false`
-- for this reason before this migration), so nothing imported becomes
-- eligible for a real exam without an explicit admin activation.
ALTER TABLE "questions" DROP COLUMN "status";

DROP TYPE "QuestionStatus";

-- The old index covered status; the new one reflects what paper generation
-- actually filters on.
DROP INDEX IF EXISTS "questions_section_status_is_active_difficulty_idx";
CREATE INDEX "questions_section_is_active_difficulty_idx" ON "questions" ("section", "is_active", "difficulty");

-- isActive's default changes from true to false: activation is a deliberate
-- administrative act, not the default state of a newly written row.
ALTER TABLE "questions" ALTER COLUMN "is_active" SET DEFAULT false;
