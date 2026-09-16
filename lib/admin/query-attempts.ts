import "server-only";

import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { AttemptStatus } from "@/lib/generated/prisma/enums";

import { parsePaging, readParam } from "./query-candidates";

/// Read-only queries behind the admin attempts page.
///
/// Scores are read from the columns scoring persisted. Nothing here recomputes a
/// score, and nothing here writes: viewing an attempt must never change it.
///
/// Each attempt's maximum is the sum of the marks on its own drawn paper, not
/// a single blueprint constant — sections can be toggled on and off, so two
/// attempts sat under different active sections legitimately have different
/// maximums, and neither is wrong.

const STATUS_VALUES: Record<string, AttemptStatus> = {
  in_progress: "in_progress",
  submitted: "submitted",
  auto_submitted: "auto_submitted",
  terminated: "terminated",
};

/// Human labels for the stored enum. The stored value itself is never changed.
export const STATUS_LABELS: Record<AttemptStatus, string> = {
  in_progress: "In Progress",
  submitted: "Submitted",
  auto_submitted: "Auto Submitted",
  terminated: "Terminated",
};

/// The only orderings the page will ever run. A sort key that is not in this
/// map falls back to `newest`, so a query parameter can never reach `orderBy`
/// as an arbitrary field name or direction.
const SORTS = {
  newest: { startedAt: "desc" },
  oldest: { startedAt: "asc" },
  submitted_desc: { submittedAt: "desc" },
  submitted_asc: { submittedAt: "asc" },
  score_desc: { totalScore: "desc" },
  score_asc: { totalScore: "asc" },
} satisfies Record<string, Prisma.AttemptOrderByWithRelationInput>;

export type SortKey = keyof typeof SORTS;

export const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  submitted_desc: "Submitted (newest)",
  submitted_asc: "Submitted (oldest)",
  score_desc: "Score (high to low)",
  score_asc: "Score (low to high)",
};

export const DEFAULT_SORT: SortKey = "newest";

/// The ordering used by a query, resolved through the allowlist above. Exported
/// so the export shares one definition of "newest first" with the list.
export function sortOrder(sort: SortKey): Prisma.AttemptOrderByWithRelationInput[] {
  return [SORTS[sort], { id: "desc" }];
}

export type ScoringFilter = "scored" | "pending" | null;

export type AttemptFilters = {
  search: string;
  status: AttemptStatus | null;
  scoring: ScoringFilter;
  candidateId: string;
  sort: SortKey;
  page: number;
  pageSize: number;
};

type RawParams = Record<string, string | string[] | undefined>;

export function parseAttemptFilters(params: RawParams): AttemptFilters {
  const sortRaw = readParam(params, "sort");
  const scoringRaw = readParam(params, "scoring");

  return {
    search: readParam(params, "q").slice(0, 200),
    status: STATUS_VALUES[readParam(params, "status")] ?? null,
    scoring: scoringRaw === "scored" || scoringRaw === "pending" ? scoringRaw : null,
    // Only carried through the query; it is resolved against the database
    // before being applied, so an unknown id filters nothing.
    candidateId: readParam(params, "candidate").slice(0, 100),
    // `Object.hasOwn`, not `in`: `in` walks the prototype chain, so "__proto__"
    // and "constructor" would pass the allowlist and then index to undefined.
    sort: Object.hasOwn(SORTS, sortRaw) ? (sortRaw as SortKey) : DEFAULT_SORT,
    ...parsePaging(params),
  };
}

/// Exported so the CSV export applies exactly the same filters as the list it
/// was launched from, rather than reimplementing them and drifting.
export function buildWhere(
  filters: AttemptFilters,
  candidateId: string | null,
): Prisma.AttemptWhereInput {
  const where: Prisma.AttemptWhereInput = {};

  if (filters.search) {
    where.candidate = {
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { mobile: { contains: filters.search, mode: "insensitive" } },
      ],
    };
  }

  if (filters.status !== null) {
    where.status = filters.status;
  }

  // "Scoring pending" means finalized but not yet scored. An in-progress attempt
  // is not pending — it has simply not finished — so it is excluded here.
  if (filters.scoring === "scored") {
    where.scoredAt = { not: null };
  } else if (filters.scoring === "pending") {
    where.scoredAt = null;
    where.status = filters.status ?? { in: ["submitted", "auto_submitted"] };
  }

  if (candidateId) {
    where.candidateId = candidateId;
  }

  return where;
}

export type AttemptScoring =
  /// Still running: there is no final score to show, and showing one would lie.
  | { kind: "not-finalized" }
  /// Finalized, but scoring has not stored a result yet.
  | { kind: "pending" }
  | { kind: "scored"; totalScore: string; maxScore: string }
  /// Ended by the anti-cheating limit. Never scored, unlike submitted /
  /// auto_submitted, so it is its own outcome rather than a scoring state
  /// that will eventually resolve.
  | { kind: "terminated" };

export type AttemptListItem = {
  id: string;
  status: AttemptStatus;
  statusLabel: string;
  startedAt: Date;
  submittedAt: Date | null;
  scoring: AttemptScoring;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidateMobile: string;
  /// What the candidate typed on the start screen, when it differs from the
  /// registered details. Surfaced so an admin can spot a mismatch.
  enteredName: string | null;
  enteredEmail: string | null;
  violationCount: number;
};

export type AttemptListResult = {
  attempts: AttemptListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /// Set when a candidate filter was applied and resolved to a real candidate.
  candidate: { id: string; name: string; email: string } | null;
  /// True when a candidate id was supplied but matched nothing.
  unknownCandidate: boolean;
};

function scoringOf(
  row: {
    status: AttemptStatus;
    scoredAt: Date | null;
    totalScore: { toString(): string } | null;
  },
  maxScore: string,
): AttemptScoring {
  if (row.status === "in_progress") {
    return { kind: "not-finalized" };
  }

  if (row.status === "terminated") {
    return { kind: "terminated" };
  }

  if (row.scoredAt === null || row.totalScore === null) {
    return { kind: "pending" };
  }

  return { kind: "scored", totalScore: Number(row.totalScore.toString()).toFixed(2), maxScore };
}

export async function listAttempts(filters: AttemptFilters): Promise<AttemptListResult> {
  // The candidate id is validated against the database before it is used as a
  // filter, rather than being trusted because it came from a link.
  const candidate = filters.candidateId
    ? await prisma.candidate.findUnique({
        where: { id: filters.candidateId },
        select: { id: true, name: true, email: true },
      })
    : null;

  const unknownCandidate = filters.candidateId !== "" && candidate === null;

  if (unknownCandidate) {
    return {
      attempts: [],
      total: 0,
      page: 1,
      pageSize: filters.pageSize,
      totalPages: 1,
      candidate: null,
      unknownCandidate: true,
    };
  }

  const where = buildWhere(filters, candidate?.id ?? null);

  const [total, rows] = await Promise.all([
    prisma.attempt.count({ where }),
    prisma.attempt.findMany({
      where,
      // `id` breaks ties so paging is stable when two attempts share a timestamp
      // or a score, and so rows cannot repeat or vanish between pages.
      orderBy: [SORTS[filters.sort], { id: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      select: {
        id: true,
        status: true,
        startedAt: true,
        submittedAt: true,
        scoredAt: true,
        totalScore: true,
        enteredName: true,
        enteredEmail: true,
        candidateId: true,
        violationCount: true,
        candidate: { select: { name: true, email: true, mobile: true } },
      },
    }),
  ]);

  // Each attempt's max is the sum of the marks on its own drawn paper — one
  // grouped aggregate for the whole page rather than a query per row.
  const marksByAttempt =
    rows.length === 0
      ? new Map<string, string>()
      : new Map(
          (
            await prisma.attemptQuestion.groupBy({
              by: ["attemptId"],
              // Same `scored` filter as scoring and the sheet export use, so
              // this list's denominator matches the attempt detail page's.
              where: { attemptId: { in: rows.map((row) => row.id) }, scored: true },
              _sum: { marks: true },
            })
          ).map((group) => [group.attemptId, (group._sum.marks ?? 0).toString()]),
        );

  return {
    attempts: rows.map((row) => ({
      id: row.id,
      status: row.status,
      statusLabel: STATUS_LABELS[row.status],
      startedAt: row.startedAt,
      submittedAt: row.submittedAt,
      scoring: scoringOf(row, Number(marksByAttempt.get(row.id) ?? 0).toFixed(2)),
      candidateId: row.candidateId,
      candidateName: row.candidate.name,
      candidateEmail: row.candidate.email,
      candidateMobile: row.candidate.mobile,
      enteredName: row.enteredName,
      enteredEmail: row.enteredEmail,
      violationCount: row.violationCount,
    })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
    candidate,
    unknownCandidate: false,
  };
}
