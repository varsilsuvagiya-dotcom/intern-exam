import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCandidatePaper } from "@/lib/exam/candidate-paper";
import { getExamSessionAttemptId } from "@/lib/exam/exam-session";

import { ExamShell } from "./exam-shell";

export const metadata: Metadata = { title: "Exam" };

// Reads a session cookie and live attempt state on every request.
export const dynamic = "force-dynamic";

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">{body}</p>
        <Link href="/exam/start" className="mt-6 inline-block text-sm underline">
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

  const access = await getCandidatePaper(attemptId);

  if (access.kind === "finished") {
    return (
      <Notice
        title="Your exam is complete"
        body="This exam has already been submitted. Your supervisor will take it from here."
      />
    );
  }

  if (access.kind === "not-found") {
    return (
      <Notice
        title="Unable to load your exam"
        body="Please tell the exam administrator so they can help you continue."
      />
    );
  }

  return <ExamShell paper={access.paper} />;
}
