import "server-only";

import { prisma } from "@/lib/db";

import { matchCandidate } from "./match-candidate";
import type { CandidateImportRow, RowError } from "./parse-candidates";
import { toWriteData } from "./write-data";

export type ImportSummary = {
  totalRows: number;
  created: number;
  updated: number;
  failed: number;
  conflicts: number;
  errors: RowError[];
};

/// Chunk size for the concurrency-limited write loop. Each chunk still does
/// its own lookups and writes inside one transaction *per candidate*, never
/// one transaction spanning the whole file — a live sheet with thousands of
/// rows must not hold a single long-lived transaction, and a failure on one
/// candidate must never touch another (brief §16, §22).
///
/// Known limitation: two rows in the *same* file that both resolve to "create"
/// for the same not-yet-existing email/mobile, and land in the same
/// concurrent chunk, can each read "no match" before either has written and
/// both create a new candidate — `email`/`mobile` carry no database-unique
/// constraint to stop a second insert (Phase 12 deliberately left them
/// unenforced; see docs/candidate-import-field-mapping.md). Not addressed
/// here: the real live sheet has zero duplicate emails (Phase 12 audit), and
/// a genuine duplicate row in a future file is exactly the kind of identity
/// question an admin should see reported, not one this import should
/// silently collapse by serializing every write.
const CONCURRENCY = 10;

async function importRow(row: CandidateImportRow): Promise<
  | { outcome: "created" | "updated" }
  | { outcome: "conflict"; error: RowError }
  | { outcome: "failed"; error: RowError }
> {
  try {
    return await prisma.$transaction(async (tx) => {
      const [byEmail, byMobile] = await Promise.all([
        tx.candidate.findMany({ where: { email: row.email }, select: { id: true } }),
        tx.candidate.findMany({ where: { mobile: row.mobile }, select: { id: true } }),
      ]);

      const match = matchCandidate({
        rowNumber: row.rowNumber,
        name: row.name,
        email: row.email,
        mobile: row.mobile,
        byEmail,
        byMobile,
      });

      if (match.kind === "conflict") {
        return {
          outcome: "conflict" as const,
          error: { row: row.rowNumber, field: "identity", name: row.name, email: row.email, message: match.message },
        };
      }

      const data = toWriteData(row);

      if (match.kind === "create") {
        await tx.candidate.create({ data });
        return { outcome: "created" as const };
      }

      await tx.candidate.update({ where: { id: match.candidateId }, data });
      return { outcome: "updated" as const };
    });
  } catch (error) {
    // A stable message only — the error may carry the connection string.
    console.error("Candidate import row failed.", {
      row: row.rowNumber,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      outcome: "failed",
      error: {
        row: row.rowNumber,
        field: "database",
        name: row.name,
        email: row.email,
        message: "This row could not be saved due to a server error.",
      },
    };
  }
}

/// Imports a batch of already-validated rows. Row-level validation happened in
/// parse-candidates.ts; this layer only does identity matching and the
/// create/update write, each inside its own transaction, so one candidate is
/// never left partially written and one bad candidate can never roll back
/// another (brief §16, §22).
///
/// Deliberately does not create CandidateExam, Attempt or ExamSession rows —
/// this import only ever touches Candidate.
export async function importCandidates(rows: CandidateImportRow[]): Promise<ImportSummary> {
  let created = 0;
  let updated = 0;
  let conflicts = 0;
  const errors: RowError[] = [];

  for (let index = 0; index < rows.length; index += CONCURRENCY) {
    const chunk = rows.slice(index, index + CONCURRENCY);
    const results = await Promise.all(chunk.map((row) => importRow(row)));

    for (const result of results) {
      switch (result.outcome) {
        case "created":
          created++;
          break;
        case "updated":
          updated++;
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

  return {
    totalRows: rows.length,
    created,
    updated,
    failed: errors.length - conflicts,
    conflicts,
    errors,
  };
}
