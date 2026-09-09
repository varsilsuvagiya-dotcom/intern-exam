/// The candidate question-state vocabulary.
///
/// These four are the complete set, and match what the application actually
/// tracks today: an answer exists or it does not, the question has been opened
/// or it has not, and one question is current. **There is no "marked for
/// review" state** — it is not in the CloudUS requirements, not in the data
/// model, and is explicitly excluded from this design track.
///
/// The meanings of the three base states are fixed by the product
/// requirements (grey = not visited, blue = answered, outline = seen but not
/// answered), so this file restyles them into the examination token system
/// rather than reassigning them.
///
/// Every state differs by **fill, border weight and text weight**, not by hue
/// alone: the palette has to stay readable for a colourblind candidate, and
/// `ariaLabel` carries the state in words for everyone else. Phase 6 builds
/// the palette itself; this is the vocabulary it will use.

export type QuestionState = "answered" | "seen" | "unseen";

type StateStyle = {
  /// Applied to a palette cell.
  cell: string;
  /// The same treatment at swatch size, for the legend.
  swatch: string;
  /// Spoken form, appended to "Question 12, …".
  label: string;
};

export const QUESTION_STATE: Record<QuestionState, StateStyle> = {
  answered: {
    cell: "border border-exam-primary bg-exam-primary font-semibold text-white",
    swatch: "border border-exam-primary bg-exam-primary",
    label: "answered",
  },
  seen: {
    cell: "border-2 border-exam-line-strong bg-exam-surface font-medium text-exam-ink",
    swatch: "border-2 border-exam-line-strong bg-exam-surface",
    label: "seen, not answered",
  },
  unseen: {
    cell: "border border-exam-line bg-exam-inset font-normal text-exam-muted",
    swatch: "border border-exam-line bg-exam-inset",
    label: "not seen",
  },
};

/// The current question, layered on top of whichever state it is in. A ring
/// rather than a different fill, so "where I am" and "what I have answered"
/// stay independently readable — a candidate needs both at once.
export const QUESTION_CURRENT_RING =
  "ring-2 ring-exam-focus ring-offset-2 ring-offset-exam-surface";

/// A palette cell's size. 44px square: the design plan's minimum target, and
/// the current build's 36px is below it.
export const QUESTION_CELL = "size-11 rounded-exam-sm text-sm";

/// The save-state vocabulary, kept beside the question states because they
/// share a screen and must not read as the same kind of thing.
///
/// Deliberately not a toast. A save state that appears and disappears is
/// wrong for someone concentrating on a question — they will miss it, and the
/// one they miss may be the failure.
export type SaveState = "idle" | "saving" | "saved" | "failed" | "expired";

/// Tone per save state, for `ExamStatus`. `idle` renders nothing at all
/// rather than a neutral chip: before the first save there is genuinely
/// nothing to report, and a permanent "—" is noise on an exam screen.
export const SAVE_STATE_TONE: Record<
  Exclude<SaveState, "idle">,
  "info" | "success" | "danger" | "warning"
> = {
  saving: "info",
  saved: "success",
  failed: "danger",
  expired: "warning",
};
