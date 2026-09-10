-- Adds the admin-only verification reference to the question bank.
--
-- This migration originally also added a `section_code` column. That column was
-- never read by the application and is dropped again by the migration that
-- follows this one; the statements are kept here so environments that already
-- applied this migration and environments applying it for the first time end up
-- in the same state.
--
-- attempt_questions deliberately gains nothing. Its `section` snapshot already
-- identifies the section for a drawn paper, and verify_code is admin-only bank
-- data that must never travel with a candidate's paper.

ALTER TABLE "questions" ADD COLUMN "section_code" TEXT;
ALTER TABLE "questions" ADD COLUMN "verify_code" TEXT;

CREATE INDEX "questions_section_code_idx" ON "questions" ("section_code");
