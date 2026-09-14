import Image from "next/image";
import { ShieldAlert } from "lucide-react";

import { ExamPanel } from "@/components/exam/surface";

/// Shown when the attempt was ended by the anti-cheating limit rather than by
/// the candidate submitting. Deliberately not the ordinary CompletionScreen:
/// this is not a normal successful submission, and the wording must not
/// suggest it was one.
export function TerminationScreen() {
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
          <ShieldAlert aria-hidden="true" className="mx-auto size-9 text-exam-danger" />

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-exam-ink">
            Examination terminated
          </h1>

          <p className="mt-3 text-[15px] leading-relaxed text-exam-ink-secondary">
            The maximum number of unauthorized activity violations has been reached. Your
            examination has been securely saved and terminated.
          </p>

          <p className="mt-5 border-t border-exam-line pt-5 text-sm text-exam-muted">
            You do not need to do anything else. You may now close this window. Please contact
            your examination supervisor if you believe this was in error.
          </p>
        </ExamPanel>
      </div>
    </main>
  );
}
