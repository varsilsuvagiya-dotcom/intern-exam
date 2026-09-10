import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

// `mobile` has no unique constraint on this model (it is not the app's
// identity key for anything but eligibility lookup), so idempotency here is
// done by hand: find by mobile first, update if found, create otherwise.
const CANDIDATES = [
  { name: "Test Candidate One", email: "test.candidate1@example.invalid", mobile: "9000000001" },
  { name: "Test Candidate Two", email: "test.candidate2@example.invalid", mobile: "9000000002" },
  { name: "Test Candidate Three", email: "test.candidate3@example.invalid", mobile: "9000000003" },
  { name: "Test Candidate Four", email: "test.candidate4@example.invalid", mobile: "9000000004" },
  { name: "Test Candidate Five", email: "test.candidate5@example.invalid", mobile: "9000000005" },
];

async function main(): Promise<void> {
  console.log("Creating 5 test candidates...\n");

  for (const c of CANDIDATES) {
    const existing = await prisma.candidate.findFirst({ where: { mobile: c.mobile } });
    const candidate = existing
      ? await prisma.candidate.update({ where: { id: existing.id }, data: c })
      : await prisma.candidate.create({ data: c });

    console.log(
      `  ${candidate.name.padEnd(20)} mobile=${candidate.mobile}  email=${candidate.email}  id=${candidate.id}`,
    );
  }

  console.log("\nDone. Use any of these mobile numbers on /exam/start to test the candidate flow.");
  console.log("Remove them later with: npx tsx .seed/remove-candidates.ts");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
