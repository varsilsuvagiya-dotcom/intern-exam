"use client";

import { useRouter } from "next/navigation";

import { CandidateForm, type EditableCandidate } from "../../candidate-form";

/// Thin client wrapper around `CandidateForm` for the full-page edit route.
/// `CandidateForm` itself is unchanged — it already takes an `onClose`
/// callback, which on the old in-page panel closed the panel and here instead
/// navigates back to the candidates list once a save succeeds or the admin
/// cancels.
export function EditCandidateClient({ candidate }: { candidate: EditableCandidate }) {
  const router = useRouter();

  return <CandidateForm candidate={candidate} onClose={() => router.push("/admin/candidates")} />;
}
