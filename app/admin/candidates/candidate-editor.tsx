"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

import { Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CandidateForm, type EditableCandidate } from "./candidate-form";

/// Which panel is open: none, the add form, or one candidate's edit form.
type Target = { mode: "closed" } | { mode: "add" } | { mode: "edit"; candidate: EditableCandidate };

const EditorContext = createContext<{
  target: Target;
  open: (next: Target) => void;
} | null>(null);

function useEditor() {
  const context = useContext(EditorContext);

  if (!context) {
    throw new Error("Candidate editor controls must be rendered inside <CandidateEditor>.");
  }

  return context;
}

/// Holds which form is open, so the "Add candidate" button above the table and
/// the "Edit" button on every row can drive one panel between them.
///
/// The table itself stays a server component: it is passed through as
/// `children` and never re-rendered by this state. Only the small `EditButton`
/// on each row is a client component, and it carries just the three fields the
/// form needs — the page already loaded them for the row.
export function CandidateEditor({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Target>({ mode: "closed" });

  const open = useCallback((next: Target) => setTarget(next), []);
  const close = useCallback(() => setTarget({ mode: "closed" }), []);

  return (
    <EditorContext.Provider value={{ target, open }}>
      <div className="mb-6">
        <Button
          type="button"
          variant="primary"
          onClick={() => open(target.mode === "add" ? { mode: "closed" } : { mode: "add" })}
          aria-expanded={target.mode === "add"}
          icon={<Plus aria-hidden="true" className="size-4" />}
        >
          Add candidate
        </Button>

        {/* One panel, above the table, whichever action opened it. An edit
            opened from a row scrolls into view rather than appearing off
            screen on a long page. */}
        {target.mode !== "closed" ? (
          <div
            className="mt-4"
            ref={(node) => {
              if (target.mode === "edit") {
                node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
              }
            }}
          >
            <CandidateForm
              candidate={target.mode === "edit" ? target.candidate : null}
              onClose={close}
            />
          </div>
        ) : null}
      </div>

      {children}
    </EditorContext.Provider>
  );
}

/// The per-row edit control.
export function EditButton({ candidate }: { candidate: EditableCandidate }) {
  const { target, open } = useEditor();
  const active = target.mode === "edit" && target.candidate.id === candidate.id;

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => open(active ? { mode: "closed" } : { mode: "edit", candidate })}
      aria-expanded={active}
      // The row is identified in the label because several of these buttons
      // share one page and "Edit" alone does not say whom.
      aria-label={`Edit ${candidate.name}`}
      icon={<Pencil aria-hidden="true" className="size-3.5" />}
    >
      Edit
    </Button>
  );
}
