import "server-only";

import { redirect } from "next/navigation";

import { getAdminSession, type AuthenticatedAdmin } from "@/lib/auth/session";

export async function requireAdmin(): Promise<AuthenticatedAdmin> {
  const admin = await getAdminSession();

  if (!admin) {
    redirect("/admin/login");
  }

  return admin;
}
