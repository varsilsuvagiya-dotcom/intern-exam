import type { Metadata } from "next";

import { requireAdmin } from "@/lib/auth/require-admin";

import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import questions" };

export default async function ImportQuestionsPage() {
  await requireAdmin();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Import question bank</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Upload a CSV to preview it. Nothing is written until you confirm.
      </p>
      <ImportForm />
    </main>
  );
}
