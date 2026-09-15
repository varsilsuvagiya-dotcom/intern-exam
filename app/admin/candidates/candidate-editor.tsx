"use client";

import { useState, type ReactNode } from "react";

import Link from "next/link";
import { CheckSquare, Pencil, Plus, Upload } from "lucide-react";

import { Button, buttonClass } from "@/components/ui/button";

import { CandidateForm } from "./candidate-form";
import { ImportCandidatesDialog } from "./import-dialog";
import { SelectCandidatesDialog } from "./select-dialog";

/// Holds whether the "Add candidate" panel is open, plus the two import
/// dialogs. Editing is no longer part of this state: it moved to its own
/// route (app/admin/candidates/[id]/edit) so an edit gets a full page and a
/// real URL rather than a panel sharing this list page's state.
export function CandidateEditor({ children }: { children: ReactNode }) {
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);

  return (
    <>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={() => setAddOpen((value) => !value)}
            aria-expanded={addOpen}
            icon={<Plus aria-hidden="true" className="size-4" />}
          >
            Add candidate
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setImportOpen(true)}
            icon={<Upload aria-hidden="true" className="size-4" />}
          >
            Import CSV
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setSelectOpen(true)}
            icon={<CheckSquare aria-hidden="true" className="size-4" />}
          >
            Import Selected Candidates
          </Button>
        </div>

        {addOpen ? (
          <div className="mt-4">
            <CandidateForm candidate={null} onClose={() => setAddOpen(false)} />
          </div>
        ) : null}
      </div>

      <ImportCandidatesDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <SelectCandidatesDialog open={selectOpen} onClose={() => setSelectOpen(false)} />

      {children}
    </>
  );
}

/// The per-row edit control — a plain link to the candidate's own edit page,
/// not a client-state toggle. Styled as a button (`buttonClass`) so it reads
/// identically to the old in-page Edit button.
export function EditButton({ candidateId, candidateName }: { candidateId: string; candidateName: string }) {
  return (
    <Link
      href={`/admin/candidates/${encodeURIComponent(candidateId)}/edit`}
      // The name is in the label because several of these links share one
      // page and "Edit" alone does not say whom.
      aria-label={`Edit ${candidateName}`}
      className={buttonClass("secondary", "sm")}
    >
      <Pencil aria-hidden="true" className="size-3.5" />
      Edit
    </Link>
  );
}
