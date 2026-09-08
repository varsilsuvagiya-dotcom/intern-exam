import type { Metadata } from "next";

import { getExamSettings } from "@/lib/exam-settings";

import { StartForm } from "./start-form";

export const metadata: Metadata = { title: "Start exam" };

// The open/closed state must be read on every request. A prerendered page could
// otherwise keep offering the form after an admin has closed the exam.
export const dynamic = "force-dynamic";

export default async function ExamStartPage() {
  const settings = await getExamSettings();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-center text-2xl font-semibold tracking-tight">{settings.examName}</h1>

        {settings.isOpen ? (
          <>
            <p className="mt-2 text-center text-sm text-black/60 dark:text-white/60">
              Please enter your details to begin.
            </p>
            <StartForm />
          </>
        ) : (
          <p className="mt-6 rounded-lg border border-black/10 p-4 text-center text-sm dark:border-white/15">
            The exam is currently closed. Please contact the administrator.
          </p>
        )}
      </div>
    </main>
  );
}
