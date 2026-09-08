import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";

import { QuestionEditor } from "./question-editor";

export const metadata: Metadata = { title: "Edit question" };

export default async function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const question = await prisma.question.findUnique({ where: { id: decodeURIComponent(id) } });

  if (!question) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link href="/admin/questions" className="text-sm underline">
        ← Back to question bank
      </Link>

      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{question.id}</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Created {question.createdAt.toISOString().slice(0, 10)} · Last updated{" "}
        {question.updatedAt.toISOString().slice(0, 10)}
      </p>

      <QuestionEditor
        question={{
          id: question.id,
          section: question.section,
          topic: question.topic,
          difficulty: question.difficulty,
          question: question.question,
          codeBlock: question.codeBlock ?? "",
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
          correct: question.correct,
          explanation: question.explanation ?? "",
          lessonText: question.lessonText ?? "",
          lessonGroup: question.lessonGroup ?? "",
          scored: question.scored,
          marks: question.marks.toString(),
          aiVerified: question.aiVerified,
          trainerVerified: question.trainerVerified,
          status: question.status,
          isActive: question.isActive,
        }}
      />
    </main>
  );
}
