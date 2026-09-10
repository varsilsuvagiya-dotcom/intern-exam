import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

const MOBILES = ["9000000001", "9000000002", "9000000003", "9000000004", "9000000005"];

async function main(): Promise<void> {
  const candidates = await prisma.candidate.findMany({ where: { mobile: { in: MOBILES } } });
  const ids = candidates.map((c) => c.id);

  if (ids.length === 0) {
    console.log("No test candidates found — nothing to remove.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Removing ${ids.length} test candidate(s) and everything tied to their attempts...`);
  console.log("  answers          ", (await prisma.answer.deleteMany({ where: { attempt: { candidateId: { in: ids } } } })).count);
  console.log("  attempt_questions", (await prisma.attemptQuestion.deleteMany({ where: { attempt: { candidateId: { in: ids } } } })).count);
  console.log("  exam_sessions    ", (await prisma.examSession.deleteMany({ where: { attempt: { candidateId: { in: ids } } } })).count);
  console.log("  attempts         ", (await prisma.attempt.deleteMany({ where: { candidateId: { in: ids } } })).count);
  console.log("  candidates       ", (await prisma.candidate.deleteMany({ where: { id: { in: ids } } })).count);

  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
