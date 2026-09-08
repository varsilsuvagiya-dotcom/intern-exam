-- Snapshot the question content onto the drawn paper so that historical result
-- review no longer depends on the current, editable `questions` row.
--
-- Written by hand rather than generated: `prisma migrate diff` needs a shadow
-- database, which the Supabase pooler does not permit, and diffing against the
-- live database would report the hand-written partial index and check
-- constraint on this schema as drift and emit DROP statements for them.
--
-- Every column is added NOT NULL. The table is empty, so no backfill is needed,
-- and a nullable snapshot could silently hold nothing. `code_block` and
-- `explanation` are nullable because they are optional on `questions` itself.

ALTER TABLE "attempt_questions"
    ADD COLUMN "question_text" TEXT NOT NULL,
    ADD COLUMN "code_block"    TEXT,
    ADD COLUMN "option_a"      TEXT NOT NULL,
    ADD COLUMN "option_b"      TEXT NOT NULL,
    ADD COLUMN "option_c"      TEXT NOT NULL,
    ADD COLUMN "option_d"      TEXT NOT NULL,
    ADD COLUMN "correct"       "OptionKey" NOT NULL,
    ADD COLUMN "explanation"   TEXT;
