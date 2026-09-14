import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  DifficultyChip,
  QuestionActiveBadge,
} from "@/components/admin/question-status-badge";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Chip } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { LESSON_SECTION, SECTION_BLUEPRINT } from "@/lib/exam-settings/exam-blueprint";

import { QuestionEditor } from "./question-editor";

export const metadata: Metadata = { title: "Edit question" };

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

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
    <PageBody width="form">
      <PageHeader
        breadcrumbs={[{ label: "Questions", href: "/admin/questions" }, { label: "Edit question" }]}
        title="Edit question"
        description={`Created ${formatDate(question.createdAt)} · Last updated ${formatDate(question.updatedAt)}`}
      />

      {/* Identity and current state, read-only. The editable copies of
          difficulty and section live in the form; these are here so the page
          identifies itself without the admin having to read the controls. */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs break-all text-muted">{question.id}</span>
        <Chip>{question.section}</Chip>
        <DifficultyChip difficulty={question.difficulty} />
        <QuestionActiveBadge isActive={question.isActive} />
      </div>

      <QuestionEditor
        sections={SECTION_BLUEPRINT.map((entry) => ({
          code: entry.code,
          name: entry.name,
          marksPerQuestion: entry.marksPerQuestion,
        }))}
        lessonSection={LESSON_SECTION}
        question={{
          id: question.id,
          section: question.section,
          topic: question.topic,
          difficulty: question.difficulty,
          question: question.question,
          codeBlock: question.codeBlock ?? "",
          verifyCode: question.verifyCode ?? "",
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
          isActive: question.isActive,
        }}
      />
    </PageBody>
  );
}
