import type { ReactNode } from "react";

import { LogOut } from "lucide-react";

import { AdminShell } from "@/components/layout/admin-shell";
import { ToastProvider } from "@/components/ui/toast";
import { getAdminSession } from "@/lib/auth/session";

import { logout } from "./actions";

/// The admin frame.
///
/// This is a visual shell, **not** an authorization boundary. Every page and
/// route handler underneath keeps its own `requireAdmin()` call, and those
/// remain the thing that actually protects the data. The layout only reads the
/// session so the sidebar can show who is signed in, and renders the shell
/// without it when there is none — which is the case on `/admin/login`, where
/// the shell is deliberately absent.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminSession();

  // The login page renders bare: no sidebar to navigate from, nothing to log
  // out of. The `cloudus-admin` class still applies the admin palette.
  if (!admin) {
    return (
      <div className="cloudus-admin flex min-h-screen w-full flex-col">
        <ToastProvider>{children}</ToastProvider>
      </div>
    );
  }

  return (
    <ToastProvider>
      <AdminShell
        email={admin.email}
        logout={
          <form action={logout}>
            <button
              type="submit"
              className="flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm text-ink-secondary transition-colors duration-[120ms] hover:bg-subtle hover:text-ink max-md:h-11"
            >
              <LogOut aria-hidden="true" className="size-[18px] shrink-0" />
              Sign out
            </button>
          </form>
        }
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
