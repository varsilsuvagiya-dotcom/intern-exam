import type { Metadata } from "next";

import { PageBody, PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth/require-admin";

import { CsvReference } from "./csv-reference";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import questions" };

export default async function ImportQuestionsPage() {
  await requireAdmin();

  return (
    <PageBody>
      <PageHeader
        breadcrumbs={[{ label: "Questions", href: "/admin/questions" }, { label: "Import CSV" }]}
        title="Import question bank"
        // The existing wording, kept: it states the one thing an admin most
        // needs to know before uploading.
        description="Upload a CSV to preview it. Nothing is written until you confirm."
      />

      <div className="mb-6">
        <CsvReference />
      </div>

      <ImportForm />
    </PageBody>
  );
}
