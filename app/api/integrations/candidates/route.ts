import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { validateCandidatePayload } from "@/lib/integrations/candidate-payload";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";

  if (!header.startsWith(prefix)) {
    return false;
  }

  const presented = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(secret);

  return presented.length === expected.length && timingSafeEqual(presented, expected);
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.GOOGLE_APPS_SCRIPT_SECRET;

  // Refuse to serve rather than fall back to accepting anonymous writes.
  if (!secret) {
    console.error("Candidate sync rejected: GOOGLE_APPS_SCRIPT_SECRET is not configured.");
    return NextResponse.json(
      { success: false, error: "Integration is not configured." },
      { status: 500 },
    );
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = validateCandidatePayload(body);

  if (!parsed.ok) {
    return NextResponse.json({ success: false, errors: parsed.errors }, { status: 400 });
  }

  const { googleFormResponseId, name, email, mobile } = parsed.value;

  try {
    // Upsert on the unique google_form_response_id, so an Apps Script retry
    // updates the existing candidate instead of creating a second one. The
    // candidate id, the response id and any existing attempts are untouched.
    const candidate = await prisma.candidate.upsert({
      where: { googleFormResponseId },
      create: { googleFormResponseId, name, email, mobile },
      update: { name, email, mobile },
      select: { id: true, createdAt: true, updatedAt: true },
    });

    const created = candidate.createdAt.getTime() === candidate.updatedAt.getTime();
    console.info(`Candidate sync succeeded (created=${created}).`);

    return NextResponse.json(
      { success: true, candidate_id: candidate.id, created },
      { status: created ? 201 : 200 },
    );
  } catch (error) {
    // Two simultaneous requests for one response id can both miss the row and
    // both try to insert; the unique constraint rejects the loser. The record
    // now exists, so applying this payload as an update is the correct result.
    if (isUniqueViolation(error)) {
      const candidate = await prisma.candidate.update({
        where: { googleFormResponseId },
        data: { name, email, mobile },
        select: { id: true },
      });

      console.info("Candidate sync succeeded (created=false, resolved race).");
      return NextResponse.json(
        { success: true, candidate_id: candidate.id, created: false },
        { status: 200 },
      );
    }

    // Log a stable message only; the error may carry the connection string.
    console.error("Candidate sync failed while writing to the database.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { success: false, error: "Candidate could not be synchronized." },
      { status: 500 },
    );
  }
}
