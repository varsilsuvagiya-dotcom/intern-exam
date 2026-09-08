-- Runtime exam configuration.
--
-- Written by hand for the same reason as the earlier migrations: generating it
-- needs a shadow database the Supabase pooler does not allow, and diffing
-- against the live database emits DROP statements for the partial unique index
-- `attempts_one_in_progress_per_candidate` and the option-order check
-- constraint, neither of which Prisma's schema syntax can express.
--
-- Purely additive: one new table, one check constraint, one seeded row. No
-- existing table, index, or constraint is touched.

-- CreateTable
CREATE TABLE "exam_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "exam_name" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "is_open" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_settings_pkey" PRIMARY KEY ("id")
);

-- There is one exam, so there is one configuration row. Pinning the only legal
-- primary key makes a second row impossible rather than merely discouraged.
-- Prisma's schema syntax cannot express a check constraint, so it is added here.
ALTER TABLE "exam_settings"
    ADD CONSTRAINT "exam_settings_singleton_check"
    CHECK ("id" = 'singleton');

-- Duration is stored in minutes and must be a sane positive value.
ALTER TABLE "exam_settings"
    ADD CONSTRAINT "exam_settings_duration_check"
    CHECK ("duration_minutes" > 0 AND "duration_minutes" <= 1440);

-- Seed the default configuration. Closed by default: a deployment must never
-- admit candidates before an admin opens the exam. ON CONFLICT DO NOTHING keeps
-- a re-run from resetting an administrator's configured state.
INSERT INTO "exam_settings" ("id", "exam_name", "duration_minutes", "is_open", "created_at", "updated_at")
VALUES ('singleton', 'CloudUS Online Exam', 75, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
