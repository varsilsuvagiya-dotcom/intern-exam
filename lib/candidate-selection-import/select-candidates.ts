import "server-only";

import { prisma } from "@/lib/db";

import { matchSelectionRow } from "./match-selection";
import type { RowError, SelectionRow } from "./parse-selection";

export type SelectionSummary = {
  totalRows: number;
  selected: number;
  alreadySelected: number;
  notFound: number;
  conflicts: number;
  failed: number;
  errors: RowError[];
};

/// Chunk size for the concurrency-limited loop — each row still gets its own
/// transaction, never one transaction spanning the whole file (brief §18).
const CONCURRENCY = 10;

type RowOutcome =
  | { outcome: "selected" }
  | { outcome: "alreadySelected" }
  | { outcome: "notFound"; error: RowError }
  | { outcome: "conflict"; error: RowError }
  | { outcome: "failed"; error: RowError };

/// Prisma's error code for a unique-constraint violation. Used to treat a
/// concurrent duplicate insert (two admins importing the same file at once)
/// as "already selected" rather than a crash — brief §18's race-condition
/// requirement.
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

async function selectRow(row: SelectionRow, examId: string): Promise<RowOutcome> {
  try {
    return await prisma.$transaction(async (tx) => {
      const [byEmail, byMobile] = await Promise.all([
        row.email ? tx.candidate.findMany({ where: { email: row.email }, select: { id: true } }) : [],
        row.mobile ? tx.candidate.findMany({ where: { mobile: row.mobile }, select: { id: true } }) : [],
      ]);

      const match = matchSelectionRow({ byEmail, byMobile }, { email: row.email, mobile: row.mobile });

      if (match.kind === "conflict") {
        return {
          outcome: "conflict" as const,
          error: {
            row: row.rowNumber,
            field: "identity",
            name: row.name ?? undefined,
            email: row.email ?? undefined,
            mobile: row.mobile ?? undefined,
            message: match.message,
          },
        };
      }

      if (match.kind === "notFound") {
        return {
          outcome: "notFound" as const,
          error: {
            row: row.rowNumber,
            field: "email",
            name: row.name ?? undefined,
            email: row.email ?? undefined,
            mobile: row.mobile ?? undefined,
            message:
              "Candidate not found in the Candidate table. This candidate must first exist in the live candidate import.",
          },
        };
      }

      const existing = await tx.candidateExam.findUnique({
        where: { candidateId_examId: { candidateId: match.candidateId, examId } },
        select: { id: true },
      });

      if (existing) {
        return { outcome: "alreadySelected" as const };
      }

      await tx.candidateExam.create({ data: { candidateId: match.candidateId, examId } });
      return { outcome: "selected" as const };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      // Two concurrent imports raced to create the same CandidateExam; the
      // unique constraint rejected the loser. The row IS selected — just not
      // by this transaction — so it is correctly counted as already-selected
      // rather than failed.
      return { outcome: "alreadySelected" };
    }

    // A stable message only — the error may carry the connection string.
    console.error("Selected-candidate row failed.", {
      row: row.rowNumber,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      outcome: "failed",
      error: {
        row: row.rowNumber,
        field: "database",
        name: row.name ?? undefined,
        email: row.email ?? undefined,
        mobile: row.mobile ?? undefined,
        message: "This row could not be processed due to a server error.",
      },
    };
  }
}

/// Selects a batch of already-validated rows for one exam. Row-level
/// validation happened in parse-selection.ts; this layer only does the
/// Candidate lookup and the CandidateExam create, each inside its own
/// transaction, so one row is never left half-written and one bad row can
/// never roll back another (brief §17, §18).
///
/// Deliberately never creates or updates Candidate — only CandidateExam.
/// Deliberately never touches Attempt, Answer, or ExamSession.
export async function selectCandidates(rows: SelectionRow[], examId: string): Promise<SelectionSummary> {
  let selected = 0;
  let alreadySelected = 0;
  let notFound = 0;
  let conflicts = 0;
  const errors: RowError[] = [];

  for (let index = 0; index < rows.length; index += CONCURRENCY) {
    const chunk = rows.slice(index, index + CONCURRENCY);
    const results = await Promise.all(chunk.map((row) => selectRow(row, examId)));

    for (const result of results) {
      switch (result.outcome) {
        case "selected":
          selected++;
          break;
        case "alreadySelected":
          alreadySelected++;
          break;
        case "notFound":
          notFound++;
          errors.push(result.error);
          break;
        case "conflict":
          conflicts++;
          errors.push(result.error);
          break;
        case "failed":
          errors.push(result.error);
          break;
      }
    }
  }

  const failed = errors.length - notFound - conflicts;

  return { totalRows: rows.length, selected, alreadySelected, notFound, conflicts, failed, errors };
}
