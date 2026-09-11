/// The candidate question-state vocabulary.
///
/// Three base states plus "current", which is the complete set of what the
/// application tracks: an answer exists or it does not, the question has been
/// opened or it has not, and one question is current. **There is no "marked
/// for review" state** — it is not in the CloudUS requirements, not in the
/// data model, and is explicitly excluded from this design track.
///
/// The colours are green = answered, red = opened without an answer, grey =
/// not yet reached. An earlier build used blue for answered and a plain
/// outline for opened-but-unanswered; green and red were chosen deliberately
/// so the palette reads as progress and outstanding work at a glance.
///
/// Every state differs by **fill, border weight and text weight**, not by hue
/// alone: the palette has to stay readable for a colourblind candidate, and
/// the spoken `label` carries the state in words for everyone else.

export type QuestionState = "answered" | "skipped" | "unseen";

type StateStyle = {
  /// Applied to a palette cell.
  cell: string;
  /// The same treatment at swatch size, for the legend.
  swatch: string;
  /// Spoken form, appended to "Question 12, …".
  label: string;
};

/// Green for done, red for opened and left unanswered, grey for not yet
/// reached.
///
/// `unseen` is the state every question starts in, so it stays grey: red on a
/// question the candidate has not had a chance to look at would open the paper
/// as a wall of alarm colour for an entirely normal situation. Red means the
/// candidate has seen the question and has no answer down for it, which is a
/// real warning they can act on.
export const QUESTION_STATE: Record<QuestionState, StateStyle> = {
  answered: {
    cell: "border border-exam-success bg-exam-success font-semibold text-white",
    swatch: "border border-exam-success bg-exam-success",
    label: "answered",
  },
  skipped: {
    cell: "border-2 border-exam-danger bg-exam-danger-bg font-semibold text-exam-danger",
    swatch: "border-2 border-exam-danger bg-exam-danger-bg",
    label: "not answered",
  },
  unseen: {
    cell: "border border-exam-line bg-exam-inset font-normal text-exam-muted",
    swatch: "border border-exam-line bg-exam-inset",
    label: "not seen",
  },
};

/// The current question, layered on top of whichever state it is in.
///
/// Size and elevation rather than another colour or border. Two earlier
/// builds added an outline — first amber, then near-black — and both fought
/// the red and green fills underneath: inside 34px a second border reads as a
/// defect rather than as emphasis. The cell simply grows and lifts instead, so
/// "where I am" is carried by weight while the fill still says answered or
/// not.
export const QUESTION_CURRENT = "scale-125 z-10 shadow-exam-md";

/// A palette cell's size.
///
/// 44px square below `lg`, where the palette is a stacked disclosure and the
/// cell is a touch target: the design plan's minimum applies in full.
///
/// From `lg` up the palette is a mouse-driven sidebar and the whole paper has
/// to fit in it without scrolling — a full-length paper is around fifty
/// questions — so the cell drops to 34px, which is ample for a pointer.
export const QUESTION_CELL = "size-11 rounded-exam-sm text-sm lg:size-[34px] lg:text-[13px]";

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
