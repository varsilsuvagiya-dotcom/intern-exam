"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { X } from "lucide-react";

/// A minimal modal dialog: overlay, focus trap, Escape to close, focus
/// returned to the trigger on close. The admin app otherwise uses inline
/// disclosed panels (see CandidateEditor), which are the right fit when a form
/// sits directly above the row it edits — but an import is a one-off action
/// with its own multi-stage result, not tied to a specific row, so a proper
/// dialog is the better fit here and is written as a small reusable primitive
/// rather than one-off overlay markup.
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  /// Set while a request the dialog started is in flight, so the admin cannot
  /// dismiss it mid-import (Escape, backdrop click, and the close button are
  /// all disabled) and accidentally lose track of whether it completed.
  preventClose = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  preventClose?: boolean;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    triggerRef.current = document.activeElement;

    // Focus lands in the panel as it opens, deferred a frame so the content
    // exists before anything tries to focus into it.
    const frame = requestAnimationFrame(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      (focusable ?? panelRef.current)?.focus();
    });

    return () => {
      cancelAnimationFrame(frame);
      // Returns focus to whatever opened the dialog, so keyboard and
      // screen-reader users land back where they were rather than at the top
      // of the page.
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && !preventClose) {
        onClose();
        return;
      }

      // A simple focus trap: Tab past either end wraps to the other.
      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;

        const focusable = Array.from(
          panel.querySelectorAll<HTMLElement>(
            "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
          ),
        ).filter((el) => !el.hasAttribute("disabled"));

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, preventClose, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={preventClose ? undefined : onClose}
        disabled={preventClose}
        className="fixed inset-0 cursor-default bg-ink/40 disabled:cursor-not-allowed"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="relative z-10 max-h-[calc(100vh-2rem)] w-full max-w-[560px] overflow-y-auto rounded-lg border border-line bg-surface p-4 shadow-lg lg:p-5"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[15px] font-semibold text-ink">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-[13px] text-muted">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={preventClose}
            aria-label="Close dialog"
            className="-my-1 -mr-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-inset hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
