"use client";

import { useState, useTransition } from "react";

import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

import { setCandidateSelection } from "./selection-actions";

/// The per-row selection control on the candidates table. Just the switch —
/// its `aria-checked` state and accessible label (built from the candidate's
/// name) are what a screen reader announces, so removing the visible "Selected
/// / Not selected" badge next to it does not remove the non-color signal,
/// only the always-on text chip.
///
/// Optimistic: the switch flips immediately on click, before the server
/// responds, so toggling several rows in a row feels instant. If the write
/// fails, it reverts and a toast explains why — see `useToast`'s own
/// reasoning for why a failure here is a toast rather than a page-level alert:
/// it's a small, recoverable, per-row action, not a blocking condition.
export function SelectionToggle({
  candidateId,
  candidateName,
  initialSelected,
}: {
  candidateId: string;
  candidateName: string;
  initialSelected: boolean;
}) {
  const [selected, setSelected] = useState(initialSelected);
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  const handleChange = (next: boolean) => {
    const previous = selected;
    setSelected(next);

    startTransition(async () => {
      const result = await setCandidateSelection(candidateId, next);

      if (!result.ok) {
        setSelected(previous);
        push({ tone: "danger", message: result.message });
      }
    });
  };

  return (
    <Switch
      checked={selected}
      onChange={handleChange}
      disabled={pending}
      label={selected ? `Deselect ${candidateName} for the exam` : `Select ${candidateName} for the exam`}
    />
  );
}
