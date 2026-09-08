import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";

export const EXAM_COOKIE = "cloudus_exam_session";

const TOKEN_BYTES = 32;
/// Comfortably longer than the exam itself, so a session never expires out from
/// under a candidate mid-paper. The attempt's own status is what ends an exam.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/// The cookie carries the raw token; only this hash is stored. SHA-256 is right
/// here rather than bcrypt: the token is 256 bits of CSPRNG output, so it is
/// unguessable and needs no key stretching.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createExamSession(attemptId: string): Promise<void> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.examSession.create({
    data: { attemptId, tokenHash: hashToken(token), expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(EXAM_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/// Resolves the attempt this browser is entitled to, or null. The attempt id is
/// never read from the request, so a candidate cannot reach another's exam by
/// editing anything client-side.
export async function getExamSessionAttemptId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(EXAM_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.examSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, attemptId: true, expiresAt: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    // Cleared as encountered, which keeps the table tidy without a scheduler.
    await prisma.examSession.deleteMany({ where: { id: session.id } });
    return null;
  }

  return session.attemptId;
}

export async function clearExamSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(EXAM_COOKIE)?.value;

  if (token) {
    await prisma.examSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  cookieStore.delete(EXAM_COOKIE);
}
