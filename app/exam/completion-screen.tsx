import Image from "next/image";
import { CheckCircle2 } from "lucide-react";

import type { TerminalStatus } from "@/lib/exam/finalize-attempt";

import { ExamPanel } from "@/components/exam/surface";

/// The last screen a candidate sees.
///
/// Deliberately carries no score, no marks, no percentage, no grade and no
/// answer information — candidates are contacted separately, and CloudUS has
/// no candidate result page by design. Nothing on this screen is derived from
/// scoring: the only input is the attempt's terminal status.
///
/// It is also deliberately undramatic. No confetti, no illustration, no
/// "well done" — the candidate has just finished a hiring examination, and the
/// job of this screen is to be unambiguous about the fact that it is over and
/// that their work is recorded.
export function CompletionScreen({ status }: { status: TerminalStatus }) {
  const automatic = status === "auto_submitted";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 md:py-16">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <Image
          src="/cloudus-logo.png"
          alt="CloudUS Infotech"
          width={2825}
          height={685}
          priority
          className="h-8 w-auto max-w-full object-contain"
        />

        <ExamPanel as="section" className="mt-8 w-full px-5 py-8 sm:px-8">
          {/* The tick is decorative; the heading carries the meaning, so the
              state is never colour- or icon-only. */}
          <CheckCircle2
            aria-hidden="true"
            className="mx-auto size-9 text-exam-success"
          />

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-exam-ink">
            Examination submitted
          </h1>

          <p className="mt-3 text-[15px] leading-relaxed text-exam-ink-secondary">
            {automatic
              ? "Your examination time ended, so your examination was submitted automatically. Your answers have been recorded."
              : "Your examination has been submitted successfully. Your answers have been recorded."}
          </p>

          <p className="mt-5 border-t border-exam-line pt-5 text-sm text-exam-muted">
            You do not need to do anything else. You may now close this window.
            Our team will contact shortlisted candidates.
          </p>
        </ExamPanel>
      </div>
    </main>
  );
}
