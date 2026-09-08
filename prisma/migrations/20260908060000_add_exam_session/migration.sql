-- Candidate exam sessions.
--
-- Candidates have no accounts, so this is not authentication: it is a
-- capability scoped to one attempt, issued after eligibility has already been
-- proven, which lets the exam screen identify the candidate's own attempt
-- without ever trusting an attempt id from the browser.
--
-- Written by hand for the same reason as the earlier migrations: generating it
-- needs a shadow database the Supabase pooler does not allow, and diffing
-- against the live database emits DROP statements for the partial unique index
-- `attempts_one_in_progress_per_candidate` and the option-order check
-- constraint, neither of which Prisma's schema syntax can express.
--
-- Purely additive: one new table, its indexes, and one foreign key.

-- CreateTable
CREATE TABLE "exam_sessions" (
    "id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exam_sessions_token_hash_key" ON "exam_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "exam_sessions_attempt_id_idx" ON "exam_sessions"("attempt_id");

-- CreateIndex
CREATE INDEX "exam_sessions_expires_at_idx" ON "exam_sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "exam_sessions" ADD CONSTRAINT "exam_sessions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
