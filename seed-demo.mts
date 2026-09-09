import "dotenv/config";
import { PrismaClient } from "./lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

/// Demo content for manual testing. Every id starts with DEMO_ so it can be
/// removed in one statement; see the bottom of this file for the cleanup.
const SECTIONS = [
  { s: 1, name: "Logic & Patterns", need: 10, marks: 1 },
  { s: 2, name: "Number Reasoning", need: 6, marks: 1 },
  { s: 3, name: "Programming Fundamentals", need: 10, marks: 1 },
  { s: 4, name: "Output Prediction", need: 8, marks: 1.5 },
  { s: 5, name: "Debugging", need: 6, marks: 1.5 },
  { s: 6, name: "Steps Problem Solving", need: 4, marks: 2 },
  { s: 8, name: "Attitude", need: 5, marks: 0 },
];
const DIFFS = ["easy", "medium", "hard"] as const;

const rows: any[] = [];

for (const { s, name, need, marks } of SECTIONS) {
  // Three times what a paper needs, so generation always has room to choose.
  for (let i = 0; i < need * 3; i++) {
    rows.push({
      id: `DEMO_Q_S${s}_${String(i + 1).padStart(2, "0")}`,
      section: s,
      topic: name,
      difficulty: DIFFS[i % 3],
      status: "ready",
      isActive: true,
      scored: s !== 8,
      marks,
      question:
        s === 8
          ? `Describe how you would handle this workplace situation. (Demo prompt ${i + 1})`
          : `${name}: demo question ${i + 1}. Which option is correct?`,
      codeBlock:
        s === 4
          ? `let total = 0;\nfor (let i = 1; i <= ${i + 2}; i++) {\n  total += i;\n}\nconsole.log(total);`
          : null,
      optionA: "First option",
      optionB: "Second option",
      optionC: "Third option",
      optionD: "Fourth option",
      correct: (["a", "b", "c", "d"] as const)[i % 4],
      explanation: s === 8 ? null : "Demo explanation, never shown to candidates.",
    });
  }
}

// Section 7: whole lesson groups of exactly 3. A paper draws 2 groups, so 4
// groups gives generation a real choice.
for (let g = 0; g < 4; g++) {
  for (let q = 0; q < 3; q++) {
    rows.push({
      id: `DEMO_Q_S7_G${g + 1}_${q + 1}`,
      section: 7,
      topic: "Learn-and-Apply",
      difficulty: DIFFS[(g + q) % 3],
      status: "ready",
      isActive: true,
      scored: true,
      marks: 2.5,
      lessonGroup: `DEMO_LESSON_${g + 1}`,
      lessonText:
        `Lesson ${g + 1}\n\nRead the following rule carefully, then answer the three questions that follow.\n\n` +
        `A queue processes items in the order they arrive. When an item cannot be processed it is moved ` +
        `to the back of the queue and retried once every other waiting item has had a turn.`,
      question: `Lesson ${g + 1}, question ${q + 1}: apply the rule above.`,
      optionA: "First option",
      optionB: "Second option",
      optionC: "Third option",
      optionD: "Fourth option",
      correct: (["a", "b", "c"] as const)[q % 3],
      explanation: "Demo explanation, never shown to candidates.",
    });
  }
}

await prisma.question.createMany({ data: rows, skipDuplicates: true });

// One test candidate. The mobile number is what you type on /exam/start.
await prisma.candidate.upsert({
  where: { id: "DEMO_CANDIDATE_1" },
  update: {},
  create: {
    id: "DEMO_CANDIDATE_1",
    name: "Demo Candidate",
    email: "demo.candidate@example.com",
    mobile: "9876543210",
  },
});

await prisma.examSetting.update({ where: { id: "singleton" }, data: { isOpen: true } });

const s = await prisma.examSetting.findUniqueOrThrow({ where: { id: "singleton" } });
console.log("\n=== DEMO DATA READY ===");
console.log("questions:", await prisma.question.count());
console.log("candidates:", await prisma.candidate.count());
console.log(`exam: ${s.examName} | ${s.durationMinutes} min | ${s.isOpen ? "OPEN" : "CLOSED"} | mix ${s.easyPercent}/${s.mediumPercent}/${s.hardPercent}`);
console.log("\ncandidate login on /exam/start:");
console.log("  name   : Demo Candidate");
console.log("  email  : demo.candidate@example.com");
console.log("  mobile : 9876543210");
await prisma.$disconnect();
