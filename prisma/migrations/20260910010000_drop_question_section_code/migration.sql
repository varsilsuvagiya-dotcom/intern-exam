-- Drops `questions.section_code`.
--
-- The column was added alongside `verify_code` but nothing ever read it: the
-- application resolves a source section code to the integer `questions.section`
-- at import time, and `section` is what paper generation, scoring, the admin
-- list and the snapshot on attempt_questions all run on. Carrying a second
-- section representation that no query reads is a source of truth that can only
-- drift, so it is removed rather than kept.
--
-- No data is lost: the column held NULL for every row.
--
-- `questions.section` is deliberately left as an integer. Section 8 still
-- exists in the current system and has no section code, so converting `section`
-- to text is a later change that belongs with Section 8 removal.

DROP INDEX IF EXISTS "questions_section_code_idx";
ALTER TABLE "questions" DROP COLUMN IF EXISTS "section_code";
