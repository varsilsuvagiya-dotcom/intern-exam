-- Removes Section 8 from the active exam and converts questions.section to the
-- canonical section code.
--
-- Order matters. Section 8 questions are deactivated *before* the conversion,
-- because the conversion has no mapping for section 8 and must not invent one.
-- Nothing is deleted: those rows are referenced by attempt_questions through a
-- RESTRICT foreign key, and the papers that reference them must stay readable.
--
-- attempt_questions.section is deliberately untouched. It is an Int snapshot of
-- the paper as drawn, and rewriting it would falsify a historical record.

-- 1. Take the removed section's questions out of circulation.
--    Paper generation filters on is_active, so this alone stops them being
--    drawn. `status` is left as it is: it records what an author decided about
--    the question, which is still true.
UPDATE "questions" SET "is_active" = false WHERE "section" = 8;

-- 2. Refuse to continue if anything outside the known 1..8 range exists.
--    An unexpected value has no mapping, and guessing at one would silently
--    corrupt the bank. This aborts the transaction and leaves the database as
--    it was.
DO $$
DECLARE unexpected INT;
BEGIN
  SELECT COUNT(*) INTO unexpected FROM "questions" WHERE "section" NOT BETWEEN 1 AND 8;
  IF unexpected > 0 THEN
    RAISE EXCEPTION
      'Aborting: % question row(s) have a section outside 1..8 and cannot be mapped to a section code.',
      unexpected;
  END IF;
END $$;

-- 3. Convert to the canonical code.
--    Section 8 keeps no code of its own: those rows are inactive and carry the
--    literal 'ATTITUDE_REMOVED' so they remain identifiable as historical bank
--    data without occupying a valid active code. They can never be drawn, and
--    the application's section list does not contain this value.
ALTER TABLE "questions" ADD COLUMN "section_code" TEXT;

UPDATE "questions" SET "section_code" = CASE "section"
  WHEN 1 THEN 'LOG'
  WHEN 2 THEN 'NUM'
  WHEN 3 THEN 'JS'
  WHEN 4 THEN 'OUT'
  WHEN 5 THEN 'BUG'
  WHEN 6 THEN 'STP'
  WHEN 7 THEN 'LRN'
  WHEN 8 THEN 'ATTITUDE_REMOVED'
END;

-- 4. Every row must have been mapped before the column becomes authoritative.
DO $$
DECLARE unmapped INT;
BEGIN
  SELECT COUNT(*) INTO unmapped FROM "questions" WHERE "section_code" IS NULL;
  IF unmapped > 0 THEN
    RAISE EXCEPTION 'Aborting: % question row(s) were not mapped to a section code.', unmapped;
  END IF;
END $$;

-- 5. Swap the column in.
DROP INDEX IF EXISTS "questions_section_status_is_active_difficulty_idx";
ALTER TABLE "questions" DROP COLUMN "section";
ALTER TABLE "questions" RENAME COLUMN "section_code" TO "section";
ALTER TABLE "questions" ALTER COLUMN "section" SET NOT NULL;

-- Drawing a paper filters on section + status + is_active + difficulty.
CREATE INDEX "questions_section_status_is_active_difficulty_idx"
  ON "questions" ("section", "status", "is_active", "difficulty");
