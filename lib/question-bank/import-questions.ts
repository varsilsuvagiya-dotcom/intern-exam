import "server-only";

import { prisma } from "@/lib/db";
import { LESSON_SECTION, QUESTIONS_PER_LESSON_GROUP } from "@/lib/exam-settings/exam-blueprint";

import { checkActivationReadiness } from "./activation-readiness";
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
/// Which of the incoming rows may be created active.
///
/// A new question is imported active so a fresh bank is usable without a
/// separate bulk-activate pass — but only if it would have passed that pass.
/// This is the same `checkActivationReadiness` the admin activation path uses,
/// so importing can never put a question in front of a candidate that an
/// explicit activation would have refused.
///
/// The lesson-group size rule is the one check a single row cannot answer, so
/// it is applied here across the batch: Learn-and-Apply is drawn as whole
/// lessons of three, and a group that does not have exactly three questions
/// would break the draw. Group sizes are counted from the incoming rows *and*
/// the rows already in the bank, since a file may complete a group that is
/// partly imported already.
async function activatableIds(rows: QuestionRow[]): Promise<Set<string>> {
  const groups = [
    ...new Set(
      rows
        .filter((row) => row.section === LESSON_SECTION && row.lessonGroup)
        .map((row) => row.lessonGroup as string),
    ),
  ];

  // Rows in this batch replace their stored counterparts, so a stored row whose
  // id is also being imported must not be counted twice.
  const incomingIds = new Set(rows.map((row) => row.id));
  const stored = groups.length
    ? await prisma.question.findMany({
        where: { lessonGroup: { in: groups } },
        select: { id: true, lessonGroup: true },
      })
    : [];

  const sizes = new Map<string, number>();
  for (const row of rows) {
    if (row.section === LESSON_SECTION && row.lessonGroup) {
      sizes.set(row.lessonGroup, (sizes.get(row.lessonGroup) ?? 0) + 1);
    }
  }
  for (const row of stored) {
    if (row.lessonGroup && !incomingIds.has(row.id)) {
      sizes.set(row.lessonGroup, (sizes.get(row.lessonGroup) ?? 0) + 1);
    }
  }

  const activatable = new Set<string>();

  for (const row of rows) {
    if (!checkActivationReadiness(row).ready) {
      continue;
    }

    if (
      row.section === LESSON_SECTION &&
      (!row.lessonGroup || sizes.get(row.lessonGroup) !== QUESTIONS_PER_LESSON_GROUP)
    ) {
      continue;
    }

    activatable.add(row.id);
  }

  return activatable;
}

export async function importQuestions(rows: QuestionRow[]): Promise<ImportSummary> {
  const ids = rows.map((row) => row.id);
  const existingBefore = await countExisting(ids);
  const activatable = await activatableIds(rows);

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
            // A new question is created active when it passes the same
            // readiness gate the admin activation path applies, and inactive
            // when it does not — so a fresh bank is usable straight after an
            // import, without import ever activating something an explicit
            // activation would have refused.
            //
            // `isActive` is deliberately absent from the update branch, and
            // `scored` from both. They are application state rather than source
            // data: re-importing a file must not reactivate a question an admin
            // deactivated, nor deactivate one they activated.
            return tx.question.upsert({
              where: { id },
              create: { id, ...fields, isActive: activatable.has(id) },
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
