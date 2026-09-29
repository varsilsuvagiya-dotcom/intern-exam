"use client";

import { useState, useTransition } from "react";

import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

import { setCandidateRetake } from "./selection-actions";

/// Per-row switch lifting the one-attempt limit for one specific candidate.
/// While on, every start creates another attempt with no fixed count — not
/// just a single extra one. Same optimistic pattern as `SelectionToggle`:
/// flips immediately, reverts with a toast if the server refuses it.
export function RetakeToggle({
  candidateId,
  candidateName,
  initialAllowed,
}: {
  candidateId: string;
  candidateName: string;
  initialAllowed: boolean;
}) {
  const [allowed, setAllowed] = useState(initialAllowed);
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  const handleChange = (next: boolean) => {
    const previous = allowed;
    setAllowed(next);

    startTransition(async () => {
      const result = await setCandidateRetake(candidateId, next);

      if (!result.ok) {
        setAllowed(previous);
        push({ tone: "danger", message: result.message });
        return;
      }

      push({
        tone: "success",
        message: next
          ? `${candidateName} can now start unlimited attempts.`
          : `${candidateName} is back to one attempt.`,
      });
    });
  };

  return (
    <Switch
      checked={allowed}
      onChange={handleChange}
      disabled={pending}
      label={
        allowed
          ? `Limit ${candidateName} back to one attempt`
          : `Allow unlimited attempts for ${candidateName}`
      }
    />
  );
}
