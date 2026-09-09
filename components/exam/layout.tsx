import type { ReactNode } from "react";

/// Candidate-side responsive layout primitives.
///
/// The examination screen has one layout problem, and it is the only reason
/// this file exists: a question column beside a 55-cell palette, at widths
/// from 1920 down to 375. The current build solves it with an unguarded
/// `flex` row and a fixed 256px aside, which is why the design plan records it
/// as broken at 768 and unusable at 375.
///
/// The strategy, one system adapting rather than two designs:
///
///   >= 1024   palette beside the question, question column takes the rest
///   <  1024   palette below the question, in normal document flow
///
/// 1024 is the breakpoint because that is where a 272px palette stops leaving
/// a readable question column. Tailwind's `lg` is already 1024 in this project
/// (the admin `@theme` sets it), so this uses `lg:` rather than inventing a
/// candidate-specific breakpoint name for the same number.
///
/// Phase 1 provides these; the exam screen adopts them in a later phase.

/// Horizontal bounds and gutters, shared by the header, the body and the
/// action bar so they line up with each other at every width.
export function ExamContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "mx-auto w-full max-w-[1400px] px-4 md:px-6 lg:px-8",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/// The question-and-palette split.
///
/// Below `lg` this is a plain column, so the palette follows the question
/// instead of competing with it for width — on a narrow screen the question is
/// what matters, and the palette is still one scroll away rather than gone.
export function ExamWorkArea({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "flex flex-1 flex-col gap-6 lg:flex-row lg:items-start lg:gap-8",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/// The question column. `min-w-0` is load-bearing: without it a wide code
/// block inside a flex child refuses to shrink and pushes the whole page into
/// horizontal overflow, which is exactly the failure mode being designed out.
export function ExamQuestionColumn({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["min-w-0 flex-1", className].join(" ")}>{children}</div>
  );
}

/// The palette column. Fixed to its token width once it sits beside the
/// question; full width when it sits below.
export function ExamPaletteColumn({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "w-full lg:w-exam-palette lg:shrink-0",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/// The examination header. Sticky so the timer and the section never scroll
/// out of reach — the design plan's first principle is that the candidate can
/// always see where they are and how long is left.
export function ExamHeaderBar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={[
        "sticky top-0 z-30 border-b border-exam-line bg-exam-surface",
        className,
      ].join(" ")}
    >
      {children}
    </header>
  );
}

/// A group of header items that must stay on one line together — the timer
/// beside the submit button, say.
///
/// `min-w-0` is the substantive part. A header row of intrinsically-sized
/// items (a 28px countdown, a button) cannot shrink below its content, so at
/// 375px it pushes the page into horizontal overflow. This lets the group
/// shrink and its text truncate instead. Building it in means a later phase
/// composing the real header cannot reintroduce that overflow by accident.
export function ExamHeaderGroup({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["flex min-w-0 items-center gap-3", className].join(" ")}>
      {children}
    </div>
  );
}

/// The bottom action bar — Previous, Next, Save & Next. Sticky to the bottom
/// so navigation is in the same place whether the question is two lines or two
/// screens long.
export function ExamActionBar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "sticky bottom-0 z-20 border-t border-exam-line bg-exam-surface",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/// Skip link. First focusable element on the page, visible only when focused,
/// so a keyboard user is not tabbing through 55 palette cells to reach the
/// question. The target id is the caller's responsibility.
export function ExamSkipLink({
  href = "#exam-question",
  children = "Skip to question",
}: {
  href?: string;
  children?: ReactNode;
}) {
  return (
    <a
      href={href}
      className={[
        "sr-only focus:not-sr-only",
        "focus:absolute focus:left-4 focus:top-4 focus:z-50",
        "focus:inline-flex focus:h-11 focus:items-center focus:rounded-exam-md",
        "focus:border focus:border-exam-line-strong focus:bg-exam-surface focus:px-4",
        "focus:text-sm focus:font-medium focus:text-exam-ink",
      ].join(" ")}
    >
      {children}
    </a>
  );
}
