-- Phase 12: candidate-import readiness.
--
-- Two additive changes, nothing existing is altered:
--
-- 1. Candidate gains the live-sheet application/profile fields the Phase 13
--    CSV import will populate. Every new column is nullable, so every
--    existing candidate row (synced from the Google Form, or added by hand)
--    remains valid with no backfill.
--
-- 2. A new candidate_exams table records per-exam selection/eligibility,
--    separate from Candidate itself. A candidate existing in `candidates`
--    does not imply eligibility for any exam; only a matching row here does.
--    It references exam_settings.id because the codebase has only the
--    ExamSetting singleton today, not a separate Exam model.
--
-- No column is dropped, no existing constraint is removed, no existing table
-- is recreated.

ALTER TABLE "candidates" ADD COLUMN "source_timestamp" TIMESTAMP(3);
ALTER TABLE "candidates" ADD COLUMN "current_city" TEXT;
ALTER TABLE "candidates" ADD COLUMN "willing_full_time_surat" TEXT;
ALTER TABLE "candidates" ADD COLUMN "date_of_birth" DATE;
ALTER TABLE "candidates" ADD COLUMN "highest_qualification" TEXT;
ALTER TABLE "candidates" ADD COLUMN "college_name" TEXT;
ALTER TABLE "candidates" ADD COLUMN "year_of_passing" TEXT;
ALTER TABLE "candidates" ADD COLUMN "cgpa_or_percentage" TEXT;
ALTER TABLE "candidates" ADD COLUMN "technologies" TEXT;
ALTER TABLE "candidates" ADD COLUMN "project_info" TEXT;
ALTER TABLE "candidates" ADD COLUMN "github_url" TEXT;
ALTER TABLE "candidates" ADD COLUMN "linkedin_url" TEXT;
ALTER TABLE "candidates" ADD COLUMN "live_project_url" TEXT;
ALTER TABLE "candidates" ADD COLUMN "self_learning_info" TEXT;
ALTER TABLE "candidates" ADD COLUMN "ai_tools_info" TEXT;
ALTER TABLE "candidates" ADD COLUMN "reason_for_joining" TEXT;
ALTER TABLE "candidates" ADD COLUMN "resume_url" TEXT;
ALTER TABLE "candidates" ADD COLUMN "terms_agreement" TEXT;
ALTER TABLE "candidates" ADD COLUMN "information_confirmation" TEXT;
ALTER TABLE "candidates" ADD COLUMN "hear_about_program" TEXT;

-- A row's mere existence means "selected". No INELIGIBLE state yet — nothing
-- today needs to represent an explicit negative selection.
CREATE TYPE "CandidateExamStatus" AS ENUM ('SELECTED');

CREATE TABLE "candidate_exams" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "exam_id" TEXT NOT NULL,
    "status" "CandidateExamStatus" NOT NULL DEFAULT 'SELECTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_exams_pkey" PRIMARY KEY ("id")
);

-- Prevents the same selected-candidate file from creating a duplicate
-- eligibility row when imported more than once.
CREATE UNIQUE INDEX "candidate_exams_candidate_id_exam_id_key" ON "candidate_exams" ("candidate_id", "exam_id");
CREATE INDEX "candidate_exams_exam_id_idx" ON "candidate_exams" ("exam_id");

ALTER TABLE "candidate_exams" ADD CONSTRAINT "candidate_exams_candidate_id_fkey"
  FOREIGN KEY ("candidate_id") REFERENCES "candidates" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "candidate_exams" ADD CONSTRAINT "candidate_exams_exam_id_fkey"
  FOREIGN KEY ("exam_id") REFERENCES "exam_settings" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
