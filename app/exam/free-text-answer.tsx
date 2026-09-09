"use client";

/// The Section 8 response field.
///
/// Section 8 is unscored and answered in prose. The design says that once —
/// in the guidance line under the label — and then gets out of the way. It
/// deliberately does not repeat "0 marks" on every question: telling a
/// candidate five times that their answer is worth nothing invites them not to
/// bother, and these answers are read by a person.
///
/// Saving is the existing autosave hook's job: `onChange` calls the same
/// `onAnswer` every other question type uses, which debounces free text and
/// reports through the header's save status. There is no second save path and
/// no browser storage here.
export function FreeTextAnswer({
  questionId,
  value,
  onAnswer,
  disabled,
}: {
  questionId: string;
  value: string | undefined;
  onAnswer: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-6">
      <label htmlFor="free-text-answer" className="block text-sm font-medium text-exam-ink">
        Your response
      </label>

      <p id="free-text-guidance" className="mt-1 text-[13px] text-exam-muted">
        Answer in your own words. There is no right or wrong answer — write what you
        genuinely think.
      </p>

      <textarea
        id="free-text-answer"
        // Remounts per question so the textarea shows this question's answer.
        key={questionId}
        defaultValue={value ?? ""}
        onChange={(event) => onAnswer(event.target.value)}
        disabled={disabled}
        aria-describedby="free-text-guidance"
        // Tall enough that a considered paragraph does not scroll inside a
        // three-line box, and resizable for anyone who wants more room.
        rows={8}
        spellCheck
        className={[
          "mt-3 block w-full min-w-0 resize-y rounded-exam-md border border-exam-line-strong bg-exam-surface",
          "px-3.5 py-3 text-[15px] leading-[1.7] text-exam-ink",
          "transition-colors duration-[120ms] ease-out hover:border-exam-muted",
          "disabled:cursor-not-allowed disabled:bg-exam-inset disabled:text-exam-disabled disabled:hover:border-exam-line-strong",
        ].join(" ")}
      />
    </div>
  );
}
