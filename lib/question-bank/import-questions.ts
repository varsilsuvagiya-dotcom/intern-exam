import "server-only";

import { prisma } from "@/lib/db";

import type { QuestionRow } from "./csv-import";

export type ImportSummary = { total: number; created: number; updated: number };

/// Chunk size for the write loop. Large enough that a few thousand rows take a
/// handful of round trips, small enough to keep one statement batch modest.
const CHUNK_SIZE = 100;

export async function countExisting(ids: string[]): Promise<number> {
  return prisma.question.count({ where: { id: { in: ids } } });
}

/// Writes the whole validated batch inside one transaction, so a failure part
/// way through leaves the question bank untouched rather than half-imported.
/// The batch may span any number of files and any combination of sections; by
/// the time it reaches here it is simply a list of validated rows.
///
/// Updates deliberately do not touch AttemptQuestion: those rows carry their own
/// snapshot of the question as it was drawn, which is what keeps a submitted
/// attempt reviewable after the bank is edited.
export async function importQuestions(rows: QuestionRow[]): Promise<ImportSummary> {
  const ids = rows.map((row) => row.id);
  const existingBefore = await countExisting(ids);

  await prisma.$transaction(
    async (tx) => {
      for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
        const chunk = rows.slice(index, index + CHUNK_SIZE);

        await Promise.all(
          chunk.map((row) => {
            const { id, ...fields } = row;

            // Upsert on the primary key: concurrent imports of the same id
            // cannot produce a duplicate, and the id itself is never rewritten.
            //
            // A new question is created inactive. Activation is a deliberate
            // administrative act, so importing a file must never be enough to
            // put a question in front of a candidate.
            //
            // `isActive` is deliberately absent from the update branch, and
            // `scored` from both. They are application state rather than source
            // data: re-importing a file must not reactivate a question an admin
            // deactivated, nor deactivate one they activated.
            return tx.question.upsert({
              where: { id },
              create: { id, ...fields, isActive: false },
              update: fields,
            });
          }),
        );
      }
    },
    { timeout: 120_000 },
  );

  return {
    total: rows.length,
    created: rows.length - existingBefore,
    updated: existingBefore,
  };
}
