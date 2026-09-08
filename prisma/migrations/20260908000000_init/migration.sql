-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('draft', 'review', 'ready');

-- CreateEnum
CREATE TYPE "OptionKey" AS ENUM ('a', 'b', 'c', 'd');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('in_progress', 'submitted', 'auto_submitted');

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "section" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "question" TEXT NOT NULL,
    "code_block" TEXT,
    "option_a" TEXT NOT NULL,
    "option_b" TEXT NOT NULL,
    "option_c" TEXT NOT NULL,
    "option_d" TEXT NOT NULL,
    "correct" "OptionKey" NOT NULL,
    "explanation" TEXT,
    "lesson_text" TEXT,
    "lesson_group" TEXT,
    "scored" BOOLEAN NOT NULL DEFAULT true,
    "marks" DECIMAL(4,2) NOT NULL,
    "ai_verified" BOOLEAN NOT NULL DEFAULT false,
    "trainer_verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "QuestionStatus" NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "google_form_response_id" TEXT,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "total_score" DECIMAL(5,2),
    "status" "AttemptStatus" NOT NULL DEFAULT 'in_progress',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempt_questions" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "section" INTEGER NOT NULL,
    "display_order" INTEGER NOT NULL,
    "shuffled_option_order" "OptionKey"[],
    "marks" DECIMAL(4,2) NOT NULL,

    CONSTRAINT "attempt_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "attempt_question_id" TEXT NOT NULL,
    "selected_option" "OptionKey",
    "text_answer" TEXT,
    "is_correct" BOOLEAN,
    "marks_awarded" DECIMAL(4,2),
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "questions_section_status_is_active_difficulty_idx" ON "questions"("section", "status", "is_active", "difficulty");

-- CreateIndex
CREATE INDEX "questions_lesson_group_idx" ON "questions"("lesson_group");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_google_form_response_id_key" ON "candidates"("google_form_response_id");

-- CreateIndex
CREATE INDEX "candidates_mobile_idx" ON "candidates"("mobile");

-- CreateIndex
CREATE INDEX "candidates_email_idx" ON "candidates"("email");

-- CreateIndex
CREATE INDEX "attempts_candidate_id_status_idx" ON "attempts"("candidate_id", "status");

-- CreateIndex
CREATE INDEX "attempts_status_idx" ON "attempts"("status");

-- CreateIndex
CREATE INDEX "attempts_started_at_idx" ON "attempts"("started_at");

-- CreateIndex
CREATE INDEX "attempts_submitted_at_idx" ON "attempts"("submitted_at");

-- CreateIndex
CREATE INDEX "attempt_questions_question_id_idx" ON "attempt_questions"("question_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_questions_attempt_id_question_id_key" ON "attempt_questions"("attempt_id", "question_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempt_questions_attempt_id_display_order_key" ON "attempt_questions"("attempt_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "answers_attempt_question_id_key" ON "answers"("attempt_question_id");

-- CreateIndex
CREATE INDEX "answers_attempt_id_idx" ON "answers"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempt_questions" ADD CONSTRAINT "attempt_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_attempt_question_id_fkey" FOREIGN KEY ("attempt_question_id") REFERENCES "attempt_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce "one active attempt per candidate" in the database rather than in
-- application code. Prisma's schema syntax cannot express a partial index, so
-- this is written by hand; it is intentionally absent from schema.prisma and
-- `prisma migrate diff` will therefore always report it as drift.
CREATE UNIQUE INDEX "attempts_one_in_progress_per_candidate"
    ON "attempts" ("candidate_id")
    WHERE "status" = 'in_progress';

-- A drawn paper always records all four options in the order shown.
ALTER TABLE "attempt_questions"
    ADD CONSTRAINT "attempt_questions_shuffled_option_order_check"
    CHECK (array_length("shuffled_option_order", 1) = 4);
