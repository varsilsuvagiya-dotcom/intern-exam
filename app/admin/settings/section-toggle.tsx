"use client";

import { useState, useTransition } from "react";

import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";

import { toggleSection } from "./actions";

/// Flips one section's active flag for future paper generation. Optimistic,
/// matching the candidates page's `SelectionToggle`: the switch moves
/// immediately on click, and reverts with a toast if the server refuses it
/// (most commonly because it is the last enabled section).
export function SectionToggle({ code, name, initialEnabled }: { code: string; name: string; initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [lastServerValue, setLastServerValue] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  // The optimistic value is a local guess; the server's is the truth. When
  // `revalidatePath` re-renders this row with a different `initialEnabled` —
  // another admin's change, or this admin's own toggle landing — adopt it,
  // otherwise the switch keeps showing a stale state on a control that can
  // block every exam start. Render-phase adjustment rather than an effect, so
  // no frame is ever painted with the stale value.
  if (initialEnabled !== lastServerValue) {
    setLastServerValue(initialEnabled);
    setEnabled(initialEnabled);
  }

  const handleChange = (next: boolean) => {
    const previous = enabled;
    setEnabled(next);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("code", code);
      formData.set("enabled", String(next));

      const result = await toggleSection({ status: "idle" }, formData);

      if (result.status === "error") {
        setEnabled(previous);
        push({ tone: "danger", message: result.message });
        return;
      }

      push({
        tone: "success",
        message: next ? `${name} activated for new papers.` : `${name} deactivated for new papers.`,
      });
    });
  };

  return (
    <Switch
      checked={enabled}
      onChange={handleChange}
      disabled={pending}
      label={enabled ? `Deactivate ${name} for new papers` : `Activate ${name} for new papers`}
    />
  );
}
