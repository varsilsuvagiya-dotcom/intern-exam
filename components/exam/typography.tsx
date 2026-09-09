import type { ReactNode } from "react";

/// Candidate-side type scale and layout measures.
///
/// These exist as components rather than as a table in the design document so
/// that "question text" has exactly one definition. The examination screen has
/// few distinct text roles and each is used many times, which is the case
/// where centralising actually pays.
///
/// The scale, largest to smallest:
///
///   ExamTimerText     28px semibold tabular   the countdown
///   PageTitle         24px semibold           exam name on the start screen
///   QuestionText      18px normal             the question itself
///   OptionText        16px normal             an answer choice
///   ExamName          15px semibold           exam name in the header
///   SectionLabel      13px medium uppercase   section context
///   MetaText          13px normal             marks, counts, hints
///
/// The timer sits at the top on purpose. The design plan recorded it rendering
/// at the same size and weight as the candidate's name, and called that the
/// clearest hierarchy failure in the build: on an examination screen the
/// countdown is a primary control, not a caption.

export function ExamPageTitle({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={[
        "text-2xl font-semibold tracking-tight text-exam-ink",
        className,
      ].join(" ")}
    >
      {children}
    </h1>
  );
}

/// The exam's name as it appears in the examination header — identity, not a
/// page title. The heading level is the caller's to decide, since it depends
/// on what else is on the screen.
export function ExamName({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={["text-[15px] font-semibold text-exam-ink", className].join(" ")}
    >
      {children}
    </span>
  );
}

/// Section context — "Section 3 · Programming Fundamentals". Uppercase and
/// tracked so it reads as a label rather than as content.
export function ExamSectionLabel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "text-[13px] font-medium uppercase tracking-wide text-exam-muted",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/// Question text. 18px with generous leading: this is read carefully, once,
/// and often contains a sentence a candidate has to parse precisely.
/// `whitespace-pre-wrap` is not optional — question text is candidate-authored
/// content whose line breaks carry meaning.
export function ExamQuestionText({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={[
        "whitespace-pre-wrap text-lg leading-relaxed text-exam-ink",
        className,
      ].join(" ")}
    >
      {children}
    </p>
  );
}

export function ExamOptionText({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "whitespace-pre-wrap text-base leading-relaxed text-exam-ink",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/// Marks, counts, hints, timestamps.
export function ExamMetaText({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={["text-[13px] text-exam-muted", className].join(" ")}>
      {children}
    </span>
  );
}

/// The countdown's type treatment, without any of its behaviour.
///
/// Phase 1 establishes how the timer *looks*; `ExamTimerDisplay` keeps every
/// bit of how it works — the clock-skew measurement, the 30-second resync, the
/// expiry callback. `tabular-nums` is the substantive part: without it the
/// digits reflow every second and the countdown visibly jitters.
export function ExamTimerText({
  urgent = false,
  children,
  className = "",
}: {
  /// Under the low-time threshold. Carries a color change, but the caller is
  /// expected to pair it with a text or icon cue — color alone is never a
  /// state on the candidate side.
  urgent?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "exam-tabular text-[28px] font-semibold leading-none tracking-tight",
        urgent ? "text-exam-danger" : "text-exam-ink",
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

/// Code inside a question. Scrolls inside its own box rather than pushing the
/// page sideways — the one piece of responsive behaviour the current build
/// already gets right, preserved here as the default.
export function ExamCodeBlock({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <pre
      className={[
        "overflow-x-auto rounded-exam-md border border-exam-line bg-exam-subtle p-4",
        "font-mono text-sm leading-relaxed text-exam-ink",
        className,
      ].join(" ")}
    >
      <code>{children}</code>
    </pre>
  );
}

/// The reading column. Caps the measure at ~68 characters: question text set
/// across a 1920px viewport is a genuine readability problem, and this is the
/// one layout constraint every question surface needs.
export function ExamReadingColumn({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["max-w-exam-measure", className].join(" ")}>{children}</div>
  );
}
