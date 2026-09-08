import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth/require-admin";
import { examBlueprintSummary, getExamSettings } from "@/lib/exam-settings";

import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Exam settings" };

const CELL = "border-b border-black/5 px-3 py-2 text-left dark:border-white/10";

export default async function ExamSettingsPage() {
  await requireAdmin();

  const settings = await getExamSettings();
  const { sections, totalQuestions, totalMarks } = examBlueprintSummary();

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Exam settings</h1>
        <Link href="/admin" className="text-sm underline">
          Admin home
        </Link>
      </div>

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

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Exam structure</h2>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          The shape of the paper is fixed by the exam specification and is not editable. Scoring and
          paper generation are built on these values.
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {["#", "Section", "Questions", "Marks each", "Total", "Scored"].map((header) => (
                  <th key={header} className={`${CELL} font-medium`}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <tr key={section.section}>
                  <td className={CELL}>{section.section}</td>
                  <td className={CELL}>{section.name}</td>
                  <td className={CELL}>{section.questionCount}</td>
                  <td className={CELL}>{section.marksPerQuestion}</td>
                  <td className={CELL}>{section.questionCount * section.marksPerQuestion}</td>
                  <td className={CELL}>{section.scored ? "Yes" : "No"}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className={CELL} colSpan={2}>
                  Total
                </td>
                <td className={CELL}>{totalQuestions}</td>
                <td className={CELL} />
                <td className={CELL}>{totalMarks}</td>
                <td className={CELL} />
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-sm text-black/60 dark:text-white/60">
          Section 7 is drawn as 2 lesson groups of 3 questions that stay together. Section 8 is
          stored but never scored.
        </p>
      </section>
    </main>
  );
}
