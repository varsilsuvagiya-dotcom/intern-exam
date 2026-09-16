import { describe, expect, it } from "vitest";

import { checkActivationReadiness } from "./activation-readiness";

/// The rule import now applies when deciding whether a new question is created
/// active. `activatableIds` itself reads the database, so what is exercised
/// here is the decision it is built from: the per-row readiness gate, plus the
/// lesson-group size rule that a single row cannot answer.
///
/// The point of the gate is that importing must never activate a question that
/// an explicit admin activation would have refused.

const valid = {
  id: "BUG-0001",
  section: "BUG",
  difficulty: "easy",
  question: "Which line contains the bug?",
  optionA: "Line 1",
  optionB: "Line 2",
  optionC: "Line 3",
  optionD: "Line 4",
  correct: "b",
  lessonText: null,
  lessonGroup: null,
  marks: "1.5",
};

describe("import activation gate", () => {
  it("accepts a well-formed question", () => {
    expect(checkActivationReadiness(valid).ready).toBe(true);
  });

  it("refuses a blank option", () => {
    const verdict = checkActivationReadiness({ ...valid, optionC: "  " });
    expect(verdict).toEqual({ ready: false, reasons: ["MISSING_OPTION"] });
  });

  it("refuses a retired section", () => {
    const verdict = checkActivationReadiness({ ...valid, section: "ATTITUDE_REMOVED" });
    expect(verdict).toEqual({ ready: false, reasons: ["INVALID_SECTION"] });
  });

  it("refuses an LRN question with no lesson group", () => {
    const verdict = checkActivationReadiness({
      ...valid,
      id: "LRN-0001",
      section: "LRN",
      marks: "2.5",
      lessonText: "A lesson.",
      lessonGroup: null,
    });
    expect(verdict).toEqual({ ready: false, reasons: ["INVALID_LESSON_GROUP"] });
  });

  it("reports every failing reason, not just the first", () => {
    const verdict = checkActivationReadiness({
      ...valid,
      question: "",
      correct: "e",
      marks: "abc",
    });
    expect(verdict.ready).toBe(false);
    expect(verdict.ready === false && verdict.reasons).toEqual([
      "MISSING_QUESTION_TEXT",
      "INVALID_CORRECT_ANSWER",
      "INVALID_MARKS",
    ]);
  });
});
