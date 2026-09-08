"use server";

import { redirect } from "next/navigation";

import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

// One message for every failure, so the form never reveals which accounts exist.
const INVALID_CREDENTIALS = "Invalid email or password.";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH = "$2b$12$8nSZE6mFOQ/alFuqeDpX.upcFo.a9dAtYDTb5ec00UBZka/AzPhEy";

export type LoginState = { error: string } | null;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password || !EMAIL_PATTERN.test(email)) {
    return { error: INVALID_CREDENTIALS };
  }

  const admin = await prisma.admin.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // Verify even when no admin matched, so a missing account and a wrong
  // password take the same amount of time. This is a real bcrypt hash of a
  // random throwaway string; no password produces it.
  const hash = admin?.passwordHash ?? DUMMY_HASH;
  const passwordMatches = await verifyPassword(password, hash);

  if (!admin || !passwordMatches) {
    return { error: INVALID_CREDENTIALS };
  }

  await createSession(admin.id);
  redirect("/admin");
}
