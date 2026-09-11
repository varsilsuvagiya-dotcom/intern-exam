import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { backfillPendingScoring, countPendingScoring } from "@/lib/exam/pending-scoring";

/// Scoring recovery endpoint.
///
/// Submission never depends on scoring succeeding, so a scoring failure leaves
/// a real submitted attempt without a result. This is what goes back for those
/// attempts. It is safe to call at any time and safe to call repeatedly:
/// scoring recomputes the whole result from the stored paper and answers, so a
/// second run over the same attempt writes the same values.
///
/// Driven externally rather than by an in-process timer, because a timer would
/// be process-local: every application instance would run its own copy, and a
/// deployment with no instance running would silently stop repairing anything.
/// A scheduler calling this URL keeps the work exactly once per schedule no
/// matter how many instances are behind the load balancer.
///
/// GET reports how many attempts are waiting, for monitoring. POST performs the
/// retry.

export const dynamic = "force-dynamic";

/// How many attempts one invocation will score.
///
/// The run holds a transaction-scoped advisory lock, so the whole batch sits
/// inside one transaction and must finish well within the 15s transaction
/// timeout configured for the Prisma client. Scoring one attempt costs roughly
/// five round trips; at the ~80-110ms round trip measured against this database
/// that is about 0.4s each, so:
///
///     20 attempts x ~0.4s  ~=  8s   (comfortably inside 15s)
///     50 attempts x ~0.4s  ~= 19s   (would abort the batch)
///
/// 20 is therefore the bound, with roughly half the budget left as headroom for
/// a slower link. Anything still pending is picked up by the next scheduled
/// run, so a large backlog drains over several invocations rather than risking
/// one oversized transaction that times out and scores nothing.
const BATCH_LIMIT = 20;

function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";

  if (!header.startsWith(prefix)) {
    return false;
  }

  const presented = Buffer.from(header.slice(prefix.length));
  const expected = Buffer.from(secret);

  // Length is compared first because timingSafeEqual throws on a mismatch.
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}

function authorize(request: Request): NextResponse | null {
  const secret = process.env.SCORING_RETRY_SECRET;

  // Refuse to serve rather than fall back to running unauthenticated: this
  // endpoint reads candidate scoring state and does real database work.
  if (!secret) {
    console.error("Scoring retry rejected: SCORING_RETRY_SECRET is not configured.");
    return NextResponse.json(
      { success: false, error: "Scoring retry is not configured." },
      { status: 500 },
    );
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  }

  return null;
}

export async function GET(request: Request): Promise<NextResponse> {
  const refused = authorize(request);

  if (refused) {
    return refused;
  }

  try {
    const pending = await countPendingScoring();

    // `pending` is the number an operator should alert on. Zero is the healthy
    // steady state; a number that does not fall across successive runs means
    // scoring is failing for a reason a retry cannot fix.
    return NextResponse.json({ success: true, pending });
  } catch (error) {
    console.error("Scoring retry status failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ success: false, error: "Status unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const refused = authorize(request);

  if (refused) {
    return refused;
  }

  try {
    const outcome = await backfillPendingScoring(BATCH_LIMIT);
    const remaining = await countPendingScoring();

    return NextResponse.json({
      success: true,
      examined: outcome.examined,
      scored: outcome.scored,
      skipped: outcome.skipped,
      failed: outcome.failed,
      remaining,
    });
  } catch (error) {
    console.error("Scoring retry run failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ success: false, error: "Retry failed." }, { status: 500 });
  }
}
