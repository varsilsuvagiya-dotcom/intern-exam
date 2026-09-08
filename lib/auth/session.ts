import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "cloudus_admin_session";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const TOKEN_BYTES = 32;

export type AuthenticatedAdmin = {
  id: string;
  email: string;
};

/// The cookie carries the raw token; only this hash reaches the database, so a
/// leaked dump cannot be replayed as a live session. SHA-256 is correct here
/// rather than bcrypt: the token is 256 bits of CSPRNG output, so it is not
/// guessable and needs no key stretching.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(adminId: string): Promise<void> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.adminSession.create({
    data: { adminId, tokenHash: hashToken(token), expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function getAdminSession(): Promise<AuthenticatedAdmin | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, expiresAt: true, admin: { select: { id: true, email: true } } },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    // Expired sessions are cleared as they are encountered, which keeps the
    // table tidy without a scheduler.
    await prisma.adminSession.deleteMany({ where: { id: session.id } });
    return null;
  }

  return session.admin;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  cookieStore.delete(SESSION_COOKIE);
}
