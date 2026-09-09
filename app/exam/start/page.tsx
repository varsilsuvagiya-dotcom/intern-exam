import type { Metadata } from "next";
import Image from "next/image";

import { examBlueprintSummary, getExamSettings } from "@/lib/exam-settings";

import { StartForm } from "./start-form";
import { BeforeYouBegin, ExamClosedNotice } from "./start-panels";

export const metadata: Metadata = { title: "Start exam" };

// The open/closed state must be read on every request. A prerendered page could
// otherwise keep offering the form after an admin has closed the exam.
export const dynamic = "force-dynamic";

export default async function ExamStartPage() {
  const settings = await getExamSettings();
  // The blueprint is the authoritative source for the paper's shape — the same
  // one paper generation and scoring validate against, and the one the admin
  // settings screen displays. Nothing about the exam is restated here.
  const { totalQuestions, totalMarks } = examBlueprintSummary();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6 md:py-14">
      <div className="w-full max-w-xl">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/cloudus-logo.png"
            alt="CloudUS Infotech"
            width={2825}
            height={685}
            priority
            className="h-9 w-auto max-w-full object-contain"
          />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-exam-ink sm:text-[28px]">
            {settings.examName}
          </h1>
          <p className="mt-2 text-sm text-exam-muted">
            {settings.isOpen
              ? "Please read the information below, then enter your details to begin."
              : "This examination is not currently open."}
          </p>
        </div>

        {settings.isOpen ? (
          <>
            <BeforeYouBegin
              totalQuestions={totalQuestions}
              totalMarks={totalMarks}
              durationMinutes={settings.durationMinutes}
              className="mt-8"
            />
            <StartForm className="mt-6" />
          </>
        ) : (
          <ExamClosedNotice className="mt-8" />
        )}
      </div>
    </main>
  );
}
