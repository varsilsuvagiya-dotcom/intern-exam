"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-3 text-black/60 dark:text-white/60">
          Please try again. If the problem continues, contact the supervisor.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
