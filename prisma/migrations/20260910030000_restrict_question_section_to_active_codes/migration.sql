-- Restricts questions.section to the seven active section codes.
--
-- The previous migration parked the retired Attitude questions under the
-- placeholder 'ATTITUDE_REMOVED' so they could be deactivated without inventing
-- a section code for them. That placeholder is now removed: the canonical
-- section column holds one of the seven active codes and nothing else.
--
-- Any remaining placeholder rows are deleted rather than remapped. Remapping
-- would file an Attitude question under a section it never belonged to, which
-- is worse than removing it. The delete is safe because attempt_questions
-- references questions with ON DELETE RESTRICT: if a historical paper still
-- pointed at one of these rows, this statement would fail rather than orphan a
-- sat exam, and the migration would stop here for a human to look at.
DELETE FROM "questions" WHERE "section" = 'ATTITUDE_REMOVED';

-- From here on the column is constrained, so no future import, edit or
-- migration can reintroduce a value outside the active set. attempt_questions
-- is deliberately untouched: its `section` is an Int snapshot of the paper as
-- drawn and keeps whatever numbering that exam was recorded under.
ALTER TABLE "questions"
  ADD CONSTRAINT "questions_section_active_codes"
  CHECK ("section" IN ('LOG', 'NUM', 'JS', 'OUT', 'BUG', 'STP', 'LRN'));
