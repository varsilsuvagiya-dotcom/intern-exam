import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { buttonClass } from "@/components/ui/button";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { findCandidateForEdit } from "@/lib/admin/query-candidates";
import { requireAdmin } from "@/lib/auth/require-admin";

import { EditCandidateClient } from "./edit-candidate-client";

export const metadata: Metadata = { title: "Edit candidate" };

/// A candidate is looked up fresh on every visit, so this cannot be cached as
/// a static page — same reasoning as the candidates list page.
export const dynamic = "force-dynamic";

export default async function EditCandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const candidate = await findCandidateForEdit(id);

  if (!candidate) {
    notFound();
  }

  return (
    <PageBody>
      <PageHeader
        title={`Edit ${candidate.name}`}
        description="Corrects this candidate's details. Attempts they have already sat are not affected."
        actions={
          <Link href="/admin/candidates" className={buttonClass("secondary")}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to candidates
          </Link>
        }
      />

      <EditCandidateClient candidate={candidate} />
    </PageBody>
  );
}
