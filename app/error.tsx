"use client";

/// The application error boundary.
///
/// This is the screen a candidate sees when `/exam` itself fails, so its
/// wording already pointed them at their supervisor. What it lacked was the
/// candidate design system: it used raw opacity utilities and `dark:` variants
/// that light-only CloudUS does not have. It deliberately exposes nothing
/// about the error — no message, no digest, no stack.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="cloudus-exam flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-exam-ink">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm text-exam-muted">
          Please try again. If the problem continues, tell your examination supervisor.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex min-h-11 items-center rounded-exam-md border border-exam-line-strong bg-exam-surface px-4 text-sm font-medium text-exam-ink transition-colors duration-[120ms] hover:bg-exam-subtle"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
