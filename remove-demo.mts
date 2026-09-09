import "dotenv/config";
import { PrismaClient } from "./lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/// Removes everything seed-demo.mts created, plus any attempts made against it,
/// and closes the exam again. Leaves the admin account and exam settings intact.
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

await prisma.answer.deleteMany({});
await prisma.attemptQuestion.deleteMany({});
await prisma.examSession.deleteMany({});
await prisma.attempt.deleteMany({});
await prisma.question.deleteMany({ where: { id: { startsWith: "DEMO_" } } });
await prisma.candidate.deleteMany({ where: { id: { startsWith: "DEMO_" } } });
await prisma.examSetting.update({ where: { id: "singleton" }, data: { isOpen: false } });

console.log("removed. questions:", await prisma.question.count(),
  "| candidates:", await prisma.candidate.count(),
  "| attempts:", await prisma.attempt.count(),
  "| exam: CLOSED");
await prisma.$disconnect();
