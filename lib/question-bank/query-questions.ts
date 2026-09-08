import "server-only";

import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Difficulty, QuestionStatus } from "@/lib/generated/prisma/enums";

import { DIFFICULTY_VALUES, STATUS_VALUES, VALID_SECTIONS } from "./csv-contract";

export const PAGE_SIZES = [25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

export type QuestionFilters = {
  search: string;
  section: number | null;
  difficulty: Difficulty | null;
  status: QuestionStatus | null;
  active: boolean | null;
  scored: boolean | null;
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
  const sectionRaw = Number(readParam(params, "section"));
  const section = VALID_SECTIONS.includes(sectionRaw as (typeof VALID_SECTIONS)[number])
    ? sectionRaw
    : null;

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
    page,
    pageSize,
  };
}

function buildWhere(filters: QuestionFilters): Prisma.QuestionWhereInput {
  const where: Prisma.QuestionWhereInput = {};

  if (filters.search) {
    // Prisma parameterises these; no string concatenation reaches SQL.
    where.OR = [
      { id: { contains: filters.search, mode: "insensitive" } },
      { question: { contains: filters.search, mode: "insensitive" } },
      { topic: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.section !== null) where.section = filters.section;
  if (filters.difficulty !== null) where.difficulty = filters.difficulty;
  if (filters.status !== null) where.status = filters.status;
  if (filters.active !== null) where.isActive = filters.active;
  if (filters.scored !== null) where.scored = filters.scored;

  return where;
}

export type QuestionListItem = {
  id: string;
  section: number;
  topic: string;
  difficulty: Difficulty;
  question: string;
  lessonGroup: string | null;
  marks: string;
  scored: boolean;
  status: QuestionStatus;
  isActive: boolean;
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

  const [total, rows] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      orderBy: [{ section: "asc" }, { id: "asc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
      select: {
        id: true,
        section: true,
        topic: true,
        difficulty: true,
        question: true,
        lessonGroup: true,
        marks: true,
        scored: true,
        status: true,
        isActive: true,
      },
    }),
  ]);

  return {
    questions: rows.map((row) => ({ ...row, marks: row.marks.toString() })),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}
