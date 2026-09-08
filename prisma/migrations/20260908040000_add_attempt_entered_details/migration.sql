-- What the candidate typed on the exam start screen.
--
-- Recorded on the attempt rather than written back to `candidates`, because the
-- Google Form record is the authoritative application data. Keeping both lets an
-- admin spot a candidate who entered a different name or email than they
-- applied with, without corrupting the synchronized record.
--
-- Written by hand for the same reason as the earlier migrations: generating it
-- needs a shadow database the Supabase pooler does not allow, and diffing
-- against the live database emits DROP statements for the partial unique index
-- `attempts_one_in_progress_per_candidate` and the option-order check
-- constraint, neither of which Prisma's schema syntax can express.
--
-- Purely additive: two nullable columns. Nullable because attempts created
-- before this migration have no entered details, and none exist to backfill.

ALTER TABLE "attempts"
    ADD COLUMN "entered_name"  TEXT,
    ADD COLUMN "entered_email" TEXT;
