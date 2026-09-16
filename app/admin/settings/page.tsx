import type { Metadata } from "next";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { TableContainer, Td, Th, Tr } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/require-admin";
import { examBlueprintSummary, getExamSettings } from "@/lib/exam-settings";
import { starvedSections } from "@/lib/exam-settings/exam-blueprint";

import { SectionToggle } from "./section-toggle";
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
  const { sections, totalQuestions, totalMarks } = await examBlueprintSummary();

  const starved = starvedSections(sections);

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
          unauthorizedActivityLimit: settings.unauthorizedActivityLimit,
        }}
      />

      <section aria-labelledby="exam-structure" className="mt-10">
        <h2 id="exam-structure" className="text-base leading-6 font-semibold text-ink">
          Exam structure
        </h2>
        <p className="mt-1 mb-4 text-[13px] text-muted">
          Each section&rsquo;s shape — question count and marks — is fixed by the exam specification
          and is not editable. Switch a section off to exclude it from every paper drawn from now on.
          Papers already drawn, and the attempts sat on them, are never affected by this.
        </p>

        {starved.length > 0 ? (
          <Alert tone="danger" title="No candidate can start the examination" className="mb-4">
            <p>
              {starved.length === 1 ? "This active section does not have" : "These active sections do not have"}{" "}
              enough active questions in the bank, so no paper can be drawn and every candidate&rsquo;s
              start fails:
            </p>
            <ul className="mt-2 list-disc pl-5">
              {starved.map((section) => (
                <li key={section.code}>
                  <span className="font-medium">{section.name}</span> ({section.code}) needs{" "}
                  {section.questionCount} but has {section.available}.
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Import or activate more questions for{" "}
              {starved.length === 1 ? "this section" : "these sections"}, or switch{" "}
              {starved.length === 1 ? "it" : "them"} off below.
            </p>
          </Alert>
        ) : null}

        <TableContainer label="Exam structure" minWidth={780}>
          <thead>
            <tr>
              <Th>Code</Th>
              <Th>Section</Th>
              <Th align="right">Questions</Th>
              <Th align="right">In bank</Th>
              <Th align="right">Marks each</Th>
              <Th align="right">Total</Th>
              <Th>Active</Th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <Tr key={section.code}>
                <Td className="font-mono text-xs text-muted">{section.code}</Td>
                <Td className="text-ink">{section.name}</Td>
                <Td align="right" className="text-ink-secondary tabular">
                  {section.questionCount}
                </Td>
                {/* Red only when it actually blocks a paper: a disabled section
                    that is short contributes to no paper, so it is not an error. */}
                <Td
                  align="right"
                  className={
                    section.enabled && section.available < section.questionCount
                      ? "font-semibold text-danger tabular"
                      : "text-ink-secondary tabular"
                  }
                >
                  {section.available}
                </Td>
                <Td align="right" className="text-ink-secondary tabular">
                  {section.marksPerQuestion}
                </Td>
                <Td align="right" className="text-ink-secondary tabular">
                  {section.questionCount * section.marksPerQuestion}
                </Td>
                <Td>
                  <SectionToggle code={section.code} name={section.name} initialEnabled={section.enabled} />
                </Td>
              </Tr>
            ))}
            <tr className="border-t-2 border-line-strong">
              <Td colSpan={2} className="font-semibold text-ink">
                Total (active sections)
              </Td>
              <Td align="right" className="font-semibold text-ink tabular">
                {totalQuestions}
              </Td>
              {/* In bank, Marks each: no meaningful total. */}
              <Td />
              <Td />
              <Td align="right" className="font-semibold text-ink tabular">
                {totalMarks}
              </Td>
              <Td />
            </tr>
          </tbody>
        </TableContainer>

        <p className="mt-3 text-[13px] text-muted">
          Learn-and-Apply (LRN) is drawn as 2 lesson groups of 3 questions that stay together.
        </p>
      </section>
    </PageBody>
  );
}
