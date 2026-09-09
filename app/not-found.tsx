import Link from "next/link";

/// Reached by a candidate who mistypes a URL, and by anyone else.
///
/// Rendered inside `.cloudus-exam` and built from the exam tokens rather than
/// raw opacity utilities: it is a candidate-facing surface, and it previously
/// carried `dark:` variants that light-only CloudUS does not have.
export default function NotFound() {
  return (
    <main className="cloudus-exam flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-exam-ink">Page not found</h1>
        <p className="mt-3 text-sm text-exam-muted">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-exam-md border border-exam-line-strong bg-exam-surface px-4 text-sm font-medium text-exam-ink transition-colors duration-[120ms] hover:bg-exam-subtle"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
