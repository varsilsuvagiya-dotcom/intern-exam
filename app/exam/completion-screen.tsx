import type { TerminalStatus } from "@/lib/exam/finalize-attempt";

/// Shown once an attempt is final. Deliberately carries no score, no marks and
/// no answer information — candidates are contacted separately.
export function CompletionScreen({ status }: { status: TerminalStatus }) {
  const automatic = status === "auto_submitted";

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {automatic ? "Time expired" : "Exam submitted"}
        </h1>
        <p className="mt-3 text-black/70 dark:text-white/70">
          {automatic
            ? "Your exam was submitted automatically because the exam time ended. Your answers have been recorded."
            : "Your exam has been submitted successfully. Your answers have been recorded."}
        </p>
        <p className="mt-4 text-sm text-black/50 dark:text-white/50">
          You may now leave this page. Our team will contact shortlisted candidates.
        </p>
      </div>
    </main>
  );
}
