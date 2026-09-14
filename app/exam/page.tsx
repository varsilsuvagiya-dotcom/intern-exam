import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCandidatePaper } from "@/lib/exam/candidate-paper";
import { prisma } from "@/lib/db";
import { getExamSessionAttemptId } from "@/lib/exam/exam-session";
import { getAttemptTiming } from "@/lib/exam/exam-timer";
import { loadProgress } from "@/lib/exam/exam-progress";
import { loadAnswers } from "@/lib/exam/save-answer";

import { CompletionScreen } from "./completion-screen";
import { TerminationScreen } from "./termination-screen";
import { ExamShell } from "./exam-shell";

export const metadata: Metadata = { title: "Exam" };

// Reads a session cookie and live attempt state on every request.
export const dynamic = "force-dynamic";

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-exam-ink">{title}</h1>
        <p className="mt-2 text-sm text-exam-muted">{body}</p>
        <Link href="/exam/start" className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-exam-primary underline">
          Back to the start page
        </Link>
      </div>
    </main>
  );
}

export default async function ExamPage() {
  const attemptId = await getExamSessionAttemptId();

  if (!attemptId) {
    redirect("/exam/start");
  }

  // A finalized attempt never reopens the exam, however the page is reached.
  const finished = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: { status: true },
  });

  if (finished) {
    if (finished.status === "terminated") {
      return <TerminationScreen />;
    }
    if (finished.status !== "in_progress") {
      return <CompletionScreen status={finished.status} />;
    }
  }

  const access = await getCandidatePaper(attemptId);

  if (access.kind === "finished") {
    return <CompletionScreen status="submitted" />;
  }

  if (access.kind === "not-found") {
    return (
      <Notice
        title="Unable to load your exam"
        body="Please tell the exam administrator so they can help you continue."
      />
    );
  }

  const [timing, answers, progress] = await Promise.all([
    getAttemptTiming(attemptId),
    loadAnswers(attemptId),
    loadProgress(attemptId),
  ]);

  if (timing.kind !== "ok") {
    return <CompletionScreen status="submitted" />;
  }

  return (
    <ExamShell
      paper={access.paper}
      initialAnswers={answers}
      initialTiming={timing.timing}
      // Read on the server and passed in as initial state rather than applied
      // after mount, so a resumed exam renders directly at the right question
      // instead of showing question 1 and then jumping.
      initialProgress={progress}
    />
  );
}
