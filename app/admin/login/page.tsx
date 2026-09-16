import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/auth/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Admin sign in" };

export default async function AdminLoginPage() {
  if (await getAdminSession()) {
    redirect("/admin");
  }

  return (
    // No sidebar: nothing to navigate to before signing in. The page still
    // sits inside the admin palette, so it reads as the same system.
    <main className="flex min-h-screen w-full items-center justify-center px-4 py-12">
      {/* Nudged above centre — a form pinned to the exact middle reads as
          low on tall screens. */}
      <div className="w-full max-w-[400px] -translate-y-4">
        <div className="mb-6 flex justify-center">
          <Image
            src="/cloudus-logo.png"
            alt="CloudUS Infotech"
            width={2825}
            height={685}
            priority
            className="h-12 w-auto max-w-full object-contain"
          />
        </div>

        <div className="rounded-lg border border-line bg-surface p-6">
          <h1 className="text-xl leading-7 font-semibold tracking-tight text-ink">
            Admin sign in
          </h1>
          <p className="mt-1 text-[13px] leading-[18px] text-muted">
            Manage the question bank, candidates and results.
          </p>

          <LoginForm />
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Authorised administrators only.
        </p>
      </div>
    </main>
  );
}
