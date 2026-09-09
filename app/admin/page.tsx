import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/require-admin";

import { logout } from "./actions";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  const admin = await requireAdmin();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <h1 className="text-2xl font-semibold tracking-tight">CloudUS Admin</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          You are signed in as {admin.email}.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {[
            ["/admin/candidates", "Candidates"],
            ["/admin/attempts", "Attempts"],
            ["/admin/questions", "Question bank"],
            ["/admin/questions/import", "Import CSV"],
            ["/admin/settings", "Exam settings"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
            >
              {label}
            </Link>
          ))}
        </div>
        <form action={logout} className="mt-4">
          <button
            type="submit"
            className="rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/20"
          >
            Log out
          </button>
        </form>
      </div>
    </main>
  );
}

