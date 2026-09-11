"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { ExamSaveStatus } from "./exam-save-status";
import type { SaveStatus } from "./use-autosave";

/// The persistent examination header.
///
/// Sticky, and deliberately short: an exam is sat on office machines at 768 or
/// 800px of height, so every pixel here is one the candidate does not have for
/// the question. It carries only what orients them — platform, examination,
/// who is sitting it, section, time left, save state — and the submit control.
/// There is no navigation, by design: there is nowhere else to go during an
/// examination.
///
/// Layout is one row from `md` up, and two rows below it: identity above,
/// timer and controls below. The timer is never hidden, never shrunk and never
/// moved off screen at any width.
/// The candidate's initials, for the identity block's avatar.
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function ExamHeader({
  examName,
  candidateName,
  candidateEmail,
  attemptRef,
  sectionNumber,
  sectionName,
  saveStatus,
  timer,
  submit,
}: {
  examName: string;
  candidateName: string;
  candidateEmail: string;
  attemptRef: string;
  sectionNumber: number;
  sectionName: string;
  saveStatus: SaveStatus;
  /// The live timer, passed in so this component stays presentational and the
  /// timing logic keeps its own home.
  timer: ReactNode;
  submit: ReactNode;
}) {
  return (
    <header className="z-30 shrink-0 border-b border-exam-line bg-exam-surface">
      <div className="flex w-full flex-col gap-2 px-4 py-2.5 md:flex-row md:items-center md:gap-6 md:px-6 md:py-2 lg:px-8">
        {/* Identity. `min-w-0` lets the long exam and candidate names truncate
            rather than push the timer out of the viewport. */}
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/cloudus-logo.png"
            alt="CloudUS Infotech"
            width={2825}
            height={685}
            priority
            className="h-6 w-auto shrink-0 object-contain md:h-7"
          />

          <div className="min-w-0 border-l border-exam-line pl-3">
            {/* The examination's name is the page's heading. The question
                below is an h2 — a candidate is inside one examination, not on
                a page about a question. */}
            <h1 className="truncate text-sm font-semibold text-exam-ink" title={examName}>
              {examName}
            </h1>
            <p className="truncate text-[13px] text-exam-muted">
              Section {sectionNumber}
              <span className="max-sm:hidden"> — {sectionName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 md:ml-auto md:justify-end md:gap-6">
          <ExamSaveStatus status={saveStatus} />
          {timer}
          {submit}
        </div>
      </div>

      {/* The identity strip. A test-centre screen states, continuously and
          without being asked, who is sitting this paper and which sitting it
          is — so a candidate can verify at a glance that they are in their own
          examination, and can quote the reference if they need to report a
          problem. It is informational only: nothing here is a control. */}
      <div className="flex items-center gap-3 border-t border-exam-line bg-exam-subtle px-4 py-1.5 md:px-6 lg:px-8">
        <span
          aria-hidden="true"
          className="exam-tabular flex size-7 shrink-0 items-center justify-center rounded-full bg-exam-primary text-[11px] font-semibold text-white"
        >
          {initialsOf(candidateName)}
        </span>

        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[13px] font-medium text-exam-ink" title={candidateName}>
            {candidateName}
          </span>
          <span className="truncate text-[13px] text-exam-muted max-sm:hidden" title={candidateEmail}>
            {candidateEmail}
          </span>
        </div>

        <span className="ml-auto shrink-0 text-[11px] tracking-wide text-exam-muted uppercase">
          Attempt <span className="exam-tabular font-semibold text-exam-ink-secondary">{attemptRef}</span>
        </span>
      </div>
    </header>
  );
}
