import "server-only";

import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { SETTINGS_ID } from "@/lib/exam-settings";

/// Read-only queries behind the admin candidates page.
///
/// Nothing here writes. Every value that reaches Prisma has been through
/// `parseFilters`, which maps unrecognised input to a safe default rather than
/// passing it on, so a hand-edited query string cannot steer the query.

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

/// "all" means no filtering by selection at all — the default, and the only
/// value that does not add a `candidateExams` clause to the query.
export const SELECTION_FILTERS = ["all", "selected", "not_selected"] as const;
export type SelectionFilter = (typeof SELECTION_FILTERS)[number];

export type CandidateFilters = {
  search: string;
  selection: SelectionFilter;
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

function parseSelectionFilter(params: RawParams): SelectionFilter {
  const raw = readParam(params, "selected");
  return (SELECTION_FILTERS as readonly string[]).includes(raw) ? (raw as SelectionFilter) : "all";
}

export function parseCandidateFilters(params: RawParams): CandidateFilters {
  return {
    // Bounded so a very long query string cannot become a very long LIKE.
    search: readParam(params, "q").slice(0, 200),
    selection: parseSelectionFilter(params),
    ...parsePaging(params),
  };
}

/// Every free-text Candidate field the search box matches against. Covers
/// identity (name/email/mobile) and the full Phase 12 profile — city,
/// education, technologies, links, long-form answers — so a search for
/// "surat" finds a candidate whose *current city* is Surat, not only one
/// whose name happens to contain it. Deliberately excludes non-text fields
/// (dates, ids) that `contains` cannot search.
const SEARCHABLE_FIELDS = [
  "name",
  "email",
  "mobile",
  "currentCity",
  "willingFullTimeSurat",
  "highestQualification",
  "collegeName",
  "yearOfPassing",
  "cgpaOrPercentage",
  "technologies",
  "projectInfo",
  "githubUrl",
  "linkedinUrl",
  "liveProjectUrl",
  "selfLearningInfo",
  "aiToolsInfo",
  "reasonForJoining",
  "resumeUrl",
  "termsAgreement",
  "informationConfirmation",
  "hearAboutProgram",
] as const satisfies readonly (keyof Prisma.CandidateWhereInput)[];

function buildWhere(filters: CandidateFilters): Prisma.CandidateWhereInput {
  const clauses: Prisma.CandidateWhereInput[] = [];

  if (filters.search) {
    // Prisma parameterises these; no user text is concatenated into SQL.
    clauses.push({
      OR: SEARCHABLE_FIELDS.map((field) => ({
        [field]: { contains: filters.search, mode: "insensitive" as const },
      })),
    });
  }

  // Same existence check as the `isSelected` column below and the exam-start
  // eligibility gate (lib/exam/start-exam.ts) — a CandidateExam row for the
  // current exam (SETTINGS_ID) is what "selected" means throughout this
  // codebase, so the filter is defined identically rather than introduced
  // as a second idea of what selection means.
  if (filters.selection === "selected") {
    clauses.push({ candidateExams: { some: { examId: SETTINGS_ID } } });
  } else if (filters.selection === "not_selected") {
    clauses.push({ candidateExams: { none: { examId: SETTINGS_ID } } });
  }

  return clauses.length > 0 ? { AND: clauses } : {};
}

export type CandidateListItem = {
  id: string;
  name: string;
  email: string;
  mobile: string;
  registeredAt: Date;
  updatedAt: Date;
  attemptCount: number;
  /// Whether a CandidateExam row exists for this candidate and the current
  /// exam (SETTINGS_ID) — the same existence check
  /// lib/exam/start-exam.ts's eligibility gate (Phase 17) uses. Read-only
  /// here: this column only reports what the Selected Candidates import
  /// already decided, it never sets or changes selection itself.
  isSelected: boolean;
  // --- Live-sheet application/profile fields (Phase 12), shown in the
  // expandable row detail rather than as table columns — see
  // app/admin/candidates/candidate-detail.tsx.
  sourceTimestamp: Date | null;
  currentCity: string | null;
  willingFullTimeSurat: string | null;
  dateOfBirth: Date | null;
  highestQualification: string | null;
  collegeName: string | null;
  yearOfPassing: string | null;
  cgpaOrPercentage: string | null;
  technologies: string | null;
  projectInfo: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  liveProjectUrl: string | null;
  selfLearningInfo: string | null;
  aiToolsInfo: string | null;
  reasonForJoining: string | null;
  resumeUrl: string | null;
  termsAgreement: string | null;
  informationConfirmation: string | null;
  hearAboutProgram: string | null;
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
        sourceTimestamp: true,
        currentCity: true,
        willingFullTimeSurat: true,
        dateOfBirth: true,
        highestQualification: true,
        collegeName: true,
        yearOfPassing: true,
        cgpaOrPercentage: true,
        technologies: true,
        projectInfo: true,
        githubUrl: true,
        linkedinUrl: true,
        liveProjectUrl: true,
        selfLearningInfo: true,
        aiToolsInfo: true,
        reasonForJoining: true,
        resumeUrl: true,
        termsAgreement: true,
        informationConfirmation: true,
        hearAboutProgram: true,
        _count: { select: { attempts: true } },
        // Existence-only: at most one row can match, since CandidateExam has
        // @@unique([candidateId, examId]). Selecting just the id keeps this
        // cheap — the join cost is paid once per page, not once per row.
        candidateExams: {
          where: { examId: SETTINGS_ID },
          select: { id: true },
          take: 1,
        },
      },
    }),
  ]);

  return {
    candidates: rows.map(({ _count, candidateExams, ...row }) => ({
      ...row,
      attemptCount: _count.attempts,
      isSelected: candidateExams.length > 0,
    })),
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

/// The single candidate a full-page edit form needs — identity plus every
/// Phase 12 profile field, matching `EditableCandidate` in candidate-form.tsx.
/// Separate from `listCandidates`: the edit page needs one row by id, not a
/// filtered page of many, and does not need `attemptCount`/`isSelected`.
export async function findCandidateForEdit(candidateId: string) {
  if (!candidateId) {
    return null;
  }

  return prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      currentCity: true,
      willingFullTimeSurat: true,
      dateOfBirth: true,
      highestQualification: true,
      collegeName: true,
      yearOfPassing: true,
      cgpaOrPercentage: true,
      technologies: true,
      projectInfo: true,
      githubUrl: true,
      linkedinUrl: true,
      liveProjectUrl: true,
      selfLearningInfo: true,
      aiToolsInfo: true,
      reasonForJoining: true,
      resumeUrl: true,
      termsAgreement: true,
      informationConfirmation: true,
      hearAboutProgram: true,
    },
  });
}
