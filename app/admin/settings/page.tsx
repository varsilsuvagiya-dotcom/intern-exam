import type { Metadata } from "next";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/require-admin";
import { examBlueprintSummary, getExamSettings } from "@/lib/exam-settings";

import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Exam settings" };

/// Filters and the open/closed state gate candidate access, so this page is
/// never served from a cached render.
export const dynamic = "force-dynamic";

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 16).replace("T", " ");
}

export default async function ExamSettingsPage() {
  await requireAdmin();

  const settings = await getExamSettings();
  const { sections, totalQuestions, totalMarks } = examBlueprintSummary();

  return (
    <PageBody>
      <PageHeader
        title="Exam settings"
        description="Configuration for the CloudUS exam. Changes apply to papers drawn from now on."
      />

      {/* Read-only metadata: stated as text, never as a control. */}
      <p className="mb-6 text-[13px] text-muted">
        Last updated <span className="tabular">{formatDate(settings.updatedAt)}</span>
      </p>

      <SettingsForm
        settings={{
          examName: settings.examName,
          durationMinutes: settings.durationMinutes,
          isOpen: settings.isOpen,
          easyPercent: settings.easyPercent,
          mediumPercent: settings.mediumPercent,
          hardPercent: settings.hardPercent,
        }}
      />

      <section aria-labelledby="exam-structure" className="mt-10">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="exam-structure" className="text-base leading-6 font-semibold text-ink">
            Exam structure
          </h2>
          {/* Says plainly that nothing below is editable, so the table is not
              mistaken for a form the way a bare grid of numbers might be. */}
          <Badge tone="neutral">Read-only</Badge>
        </div>
        <p className="mt-1 mb-4 text-[13px] text-muted">
          The shape of the paper is fixed by the exam specification and is not editable. Scoring and
          paper generation are built on these values.
        </p>

        <TableContainer label="Exam structure" minWidth={720}>
          <thead>
            <tr>
              <Th align="right">#</Th>
              <Th>Section</Th>
              <Th align="right">Questions</Th>
              <Th align="right">Marks each</Th>
              <Th align="right">Total</Th>
              <Th>Scored</Th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <Tr key={section.section}>
                <Td align="right" className="text-muted tabular">
                  {section.section}
                </Td>
                <Td className="text-ink">{section.name}</Td>
                <Td align="right" className="text-ink-secondary tabular">
                  {section.questionCount}
                </Td>
                <Td align="right" className="text-ink-secondary tabular">
                  {section.marksPerQuestion}
                </Td>
                <Td align="right" className="text-ink-secondary tabular">
                  {section.questionCount * section.marksPerQuestion}
                </Td>
                <Td>
                  {section.scored ? (
                    <span className="text-[13px] text-ink-secondary">Yes</span>
                  ) : (
                    <Badge tone="neutral">Not scored</Badge>
                  )}
                </Td>
              </Tr>
            ))}
            <tr className="border-t-2 border-line-strong">
              <Td colSpan={2} className="font-semibold text-ink">
                Total
              </Td>
              <Td align="right" className="font-semibold text-ink tabular">
                {totalQuestions}
              </Td>
              <Td />
              <Td align="right" className="font-semibold text-ink tabular">
                {totalMarks}
              </Td>
              <Td />
            </tr>
          </tbody>
        </TableContainer>

        <p className="mt-3 text-[13px] text-muted">
          Section 7 is drawn as 2 lesson groups of 3 questions that stay together. Section 8 is
          stored but never scored.
        </p>
      </section>
    </PageBody>
  );
}
