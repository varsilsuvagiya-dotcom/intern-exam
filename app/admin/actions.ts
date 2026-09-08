"use server";

import { redirect } from "next/navigation";

import { destroySession } from "@/lib/auth/session";

export async function logout(): Promise<void> {
  // Safe when the session is already gone: the delete matches zero rows and the
  // cookie is cleared regardless.
  await destroySession();
  redirect("/admin/login");
}
