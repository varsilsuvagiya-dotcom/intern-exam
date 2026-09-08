import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-3 text-black/60 dark:text-white/60">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
