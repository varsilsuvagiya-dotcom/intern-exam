import "server-only";

import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

/// Read-only queries behind the admin candidates page.
///
/// Nothing here writes. Every value that reaches Prisma has been through
/// `parseFilters`, which maps unrecognised input to a safe default rather than
/// passing it on, so a hand-edited query string cannot steer the query.

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

export type CandidateFilters = {
  search: string;
  page: number;
  pageSize: number;
};

type RawParams = Record<string, string | string[] | undefined>;

export function readParam(params: RawParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/// A page number that is negative, zero, fractional or not a number at all
/// becomes page 1. Page size must be one of the offered sizes.
export function parsePaging(params: RawParams): { page: number; pageSize: number } {
  const pageSizeRaw = Number(readParam(params, "pageSize"));
  const pageSize = PAGE_SIZES.includes(pageSizeRaw as (typeof PAGE_SIZES)[number])
    ? pageSizeRaw
    : DEFAULT_PAGE_SIZE;

  const pageRaw = Number(readParam(params, "page"));
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  return { page, pageSize };
}

export function parseCandidateFilters(params: RawParams): CandidateFilters {
  return {
    // Bounded so a very long query string cannot become a very long LIKE.
    search: readParam(params, "q").slice(0, 200),
    ...parsePaging(params),
  };
}

function buildWhere(filters: CandidateFilters): Prisma.CandidateWhereInput {
  if (!filters.search) {
    return {};
  }

  // Prisma parameterises these; no user text is concatenated into SQL.
  return {
    OR: [
      { name: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { mobile: { contains: filters.search, mode: "insensitive" } },
    ],
  };
}

export type CandidateListItem = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  registeredAt: Date;
  updatedAt: Date;
  attemptCount: number;
};

export type CandidateListResult = {
  candidates: CandidateListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listCandidates(filters: CandidateFilters): Promise<CandidateListResult> {
  const where = buildWhere(filters);

  const [total, rows] = await Promise.all([
    prisma.candidate.count({ where }),
    prisma.candidate.findMany({
      where,
      orderBy: [{ registeredAt: "desc" }, { id: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      // `_count` is a join aggregate in the same statement, so the attempt
      // counts cost one query for the page rather than one query per row.
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        registeredAt: true,
        updatedAt: true,
        _count: { select: { attempts: true } },
      },
    }),
  ]);

  return {
    candidates: rows.map(({ _count, ...row }) => ({ ...row, attemptCount: _count.attempts })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}

/// Resolves a candidate id that arrived in a query string. Returns null for
/// anything that does not name a real candidate, so the attempts page can drop
/// the filter instead of trusting the value or leaking whether an id exists.
export async function findCandidateLabel(
  candidateId: string,
): Promise<{ id: string; name: string; email: string } | null> {
  if (!candidateId) {
    return null;
  }

  return prisma.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true, name: true, email: true },
  });
}
