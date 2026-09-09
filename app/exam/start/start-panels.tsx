import { CalendarClock, Info, ListChecks, Save, TimerOff, MonitorX } from "lucide-react";

import { ExamPanel } from "@/components/exam/surface";

/// Formats the configured duration for a candidate rather than for a machine.
/// A 75-minute exam reads as "1 hour 15 minutes", which is how someone
/// estimates whether they have time to sit it now.
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (rest > 0) parts.push(`${rest} ${rest === 1 ? "minute" : "minutes"}`);

  return parts.length > 0 ? parts.join(" ") : `${minutes} minutes`;
}

/// Marks come from the blueprint as a number and may be fractional in
/// principle; 70 should not render as "70.0".
function formatMarks(marks: number): string {
  return Number.isInteger(marks) ? String(marks) : marks.toFixed(1);
}

/// The examination briefing, required by the product requirements.
///
/// Every value is passed in from the configured exam — nothing about the
/// paper's shape or the duration is written down here. If an admin changes the
/// duration, this panel changes with it.
export function BeforeYouBegin({
  totalQuestions,
  totalMarks,
  durationMinutes,
  className = "",
}: {
  totalQuestions: number;
  totalMarks: number;
  durationMinutes: number;
  className?: string;
}) {
  const facts = [
    {
      icon: ListChecks,
      text: `${totalQuestions} questions · ${formatMarks(totalMarks)} marks`,
    },
    { icon: CalendarClock, text: formatDuration(durationMinutes) },
    { icon: ListChecks, text: "You may move between questions and change your answers." },
    { icon: Save, text: "Your answers are saved automatically as you work." },
    {
      icon: TimerOff,
      text: "The examination submits automatically when the timer reaches zero.",
    },
    {
      icon: MonitorX,
      text: "Do not close this browser window during the examination.",
    },
  ];

  return (
    <ExamPanel as="section" aria-labelledby="before-you-begin" className={className}>
      <h2
        id="before-you-begin"
        className="flex items-center gap-2 border-b border-exam-line px-5 py-3 text-sm font-semibold text-exam-ink"
      >
        <Info aria-hidden="true" className="size-4 text-exam-muted" />
        Before you begin
      </h2>

      {/* A list, not a paragraph: a candidate scans this once, standing at a
          desk with a supervisor waiting. */}
      <ul className="flex flex-col gap-2.5 px-5 py-4">
        {facts.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2.5 text-sm text-exam-ink-secondary">
            <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-exam-muted" />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </ExamPanel>
  );
}

/// Shown when the exam is closed. Deliberately renders no form at all rather
/// than a disabled one: a form that looks operable but cannot be submitted is
/// worse than none, and the server would refuse the submission anyway.
export function ExamClosedNotice({ className = "" }: { className?: string }) {
  return (
    <ExamPanel as="section" className={className}>
      <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <TimerOff aria-hidden="true" className="size-6 text-exam-muted" />
        <p className="text-base font-semibold text-exam-ink">
          This examination is currently closed
        </p>
        <p className="max-w-sm text-sm text-exam-muted">
          You cannot begin at the moment. Please speak to your examination supervisor.
        </p>
      </div>
    </ExamPanel>
  );
}
