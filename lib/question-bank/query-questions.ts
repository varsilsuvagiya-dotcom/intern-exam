import "server-only";

import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Difficulty, QuestionStatus } from "@/lib/generated/prisma/enums";

import { isSectionCode, type SectionCode } from "@/lib/exam-settings/exam-blueprint";

import {
  checkActivationReadiness,
  type NotReadyReason,
} from "./activation-readiness";
import { DIFFICULTY_VALUES, STATUS_VALUES } from "./csv-contract";

/// Whether an inactive question would pass activation validation today.
export const READINESS_VALUES = ["ready-to-activate", "not-ready"] as const;
export type Readiness = (typeof READINESS_VALUES)[number];

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type QuestionFilters = {
  search: string;
  section: SectionCode | null;
  difficulty: Difficulty | null;
  status: QuestionStatus | null;
  active: boolean | null;
  scored: boolean | null;
  /// Readiness is derived from the row contents, not stored, so it cannot be a
  /// SQL predicate. It filters the page after the query.
  readiness: Readiness | null;
  page: number;
  pageSize: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function readParam(params: RawParams, key: string): string {
  const value = params[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/// Query strings are user input: anything unrecognised falls back to the
/// unfiltered default rather than erroring or reaching the database.
export function parseFilters(params: RawParams): QuestionFilters {
  const sectionRaw = readParam(params, "section").toUpperCase();
  const section = isSectionCode(sectionRaw) ? sectionRaw : null;

  const pageSizeRaw = Number(readParam(params, "pageSize"));
  const pageSize = PAGE_SIZES.includes(pageSizeRaw as (typeof PAGE_SIZES)[number])
    ? pageSizeRaw
    : DEFAULT_PAGE_SIZE;

  const pageRaw = Number(readParam(params, "page"));
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? pageRaw : 1;

  const tristate = (key: string, truthy: string): boolean | null => {
    const value = readParam(params, key);
    return value === "" ? null : value === truthy;
  };

  return {
    search: readParam(params, "search").slice(0, 200),
    section,
    difficulty: DIFFICULTY_VALUES[readParam(params, "difficulty").toLowerCase()] ?? null,
    status: STATUS_VALUES[readParam(params, "status").toLowerCase()] ?? null,
    active: tristate("active", "active"),
    scored: tristate("scored", "scored"),
    readiness: READINESS_VALUES.includes(readParam(params, "readiness") as Readiness)
      ? (readParam(params, "readiness") as Readiness)
      : null,
    page,
    pageSize,
  };
}

function buildWhere(filters: QuestionFilters): Prisma.QuestionWhereInput {
  if (filters.search) {
    // A search term is the admin looking for one specific question — most
    // often by id, after finding it somewhere that did not also show the
    // filters currently set on this page. Combining it with a leftover
    // Section/Difficulty/etc. would silently hide the very row they are
    // searching for, so a search overrides every other filter rather than
    // narrowing within them. `readiness` gets the same treatment below, since
    // it is applied after this query rather than inside `where`.
    //
    // Prisma parameterises these; no string concatenation reaches SQL.
    return {
      OR: [
        { id: { contains: filters.search, mode: "insensitive" } },
        { question: { contains: filters.search, mode: "insensitive" } },
        { topic: { contains: filters.search, mode: "insensitive" } },
      ],
    };
  }

  const where: Prisma.QuestionWhereInput = {};

  if (filters.section !== null) where.section = filters.section;
  if (filters.difficulty !== null) where.difficulty = filters.difficulty;
  if (filters.status !== null) where.status = filters.status;
  if (filters.active !== null) where.isActive = filters.active;
  if (filters.scored !== null) where.scored = filters.scored;

  return where;
}

export type QuestionListItem = {
  id: string;
  section: string;
  topic: string;
  difficulty: Difficulty;
  question: string;
  lessonGroup: string | null;
  marks: string;
  scored: boolean;
  status: QuestionStatus;
  isActive: boolean;
  /// Why this question could not be activated, empty when it is fit. Derived
  /// per row so the table can explain a refusal in place.
  notReadyReasons: NotReadyReason[];
};

export type QuestionListResult = {
  questions: QuestionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export async function listQuestions(filters: QuestionFilters): Promise<QuestionListResult> {
  const where = buildWhere(filters);

  // Readiness is computed from row contents, so it cannot be pushed into SQL.
  // When it is filtered on, the matching set is read in full and paged in
  // memory; otherwise the database pages as before.
  const select = {
    id: true,
    section: true,
    topic: true,
    difficulty: true,
    question: true,
    optionA: true,
    optionB: true,
    optionC: true,
    optionD: true,
    correct: true,
    lessonText: true,
    lessonGroup: true,
    marks: true,
    scored: true,
    status: true,
    isActive: true,
  } as const;

  const orderBy = [{ section: "asc" as const }, { id: "asc" as const }];

  const decorate = (row: {
    marks: { toString(): string };
    section: string;
    difficulty: Difficulty;
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correct: string;
    lessonText: string | null;
    lessonGroup: string | null;
    status: QuestionStatus;
    id: string;
    topic: string;
    scored: boolean;
    isActive: boolean;
  }): QuestionListItem => {
    const marks = row.marks.toString();
    const verdict = checkActivationReadiness({ ...row, marks });

    return {
      id: row.id,
      section: row.section,
      topic: row.topic,
      difficulty: row.difficulty,
      question: row.question,
      lessonGroup: row.lessonGroup,
      marks,
      scored: row.scored,
      status: row.status,
      isActive: row.isActive,
      notReadyReasons: verdict.ready ? [] : verdict.reasons,
    };
  };

  if (filters.readiness !== null && !filters.search) {
    const rows = await prisma.question.findMany({ where, orderBy, select });
    const wantReady = filters.readiness === "ready-to-activate";
    const matching = rows
      .map(decorate)
      .filter((row) => (row.notReadyReasons.length === 0) === wantReady);

    const start = (filters.page - 1) * filters.pageSize;

    return {
      questions: matching.slice(start, start + filters.pageSize),
      total: matching.length,
      page: filters.page,
      pageSize: filters.pageSize,
      totalPages: Math.max(1, Math.ceil(matching.length / filters.pageSize)),
    };
  }

  const [total, rows] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      orderBy,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      select,
    }),
  ]);

  return {
    questions: rows.map(decorate),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}
