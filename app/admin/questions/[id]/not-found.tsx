import Link from "next/link";

export default function QuestionNotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Question not found</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-white/60">
        No question in the bank has that ID. It may have been removed, or the link may be wrong.
      </p>
      <Link href="/admin/questions" className="mt-6 inline-block text-sm underline">
        ← Back to question bank
      </Link>
    </main>
  );
}
