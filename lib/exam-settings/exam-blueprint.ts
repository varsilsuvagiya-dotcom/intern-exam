import "server-only";

/// The fixed shape of the CloudUS exam, taken from the requirements: 55
/// questions worth 70 marks across 8 sections.
///
/// These are domain rules rather than admin settings, and are deliberately not
/// stored in the database. Question counts and marks are what scoring and paper
/// generation are built on: a paper with 9 questions in section 4 is not a
/// differently-configured exam, it is a broken one. Since the only value that
/// would ever pass validation is the value below, an editable field would be a
/// control with exactly one legal setting. The admin UI shows them read-only.
///
/// If the exam specification itself ever changes, this is the single place to
/// change it.

export type SectionBlueprint = {
  section: number;
  name: string;
  questionCount: number;
  marksPerQuestion: number;
  scored: boolean;
};

export const SECTION_BLUEPRINT: readonly SectionBlueprint[] = [
  { section: 1, name: "Logic & Patterns", questionCount: 10, marksPerQuestion: 1, scored: true },
  { section: 2, name: "Number Reasoning", questionCount: 6, marksPerQuestion: 1, scored: true },
  { section: 3, name: "Programming Fundamentals", questionCount: 10, marksPerQuestion: 1, scored: true },
  { section: 4, name: "Output Prediction", questionCount: 8, marksPerQuestion: 1.5, scored: true },
  { section: 5, name: "Debugging", questionCount: 6, marksPerQuestion: 1.5, scored: true },
  { section: 6, name: "Steps Problem Solving", questionCount: 4, marksPerQuestion: 2, scored: true },
  { section: 7, name: "Learn-and-Apply", questionCount: 6, marksPerQuestion: 2.5, scored: true },
  { section: 8, name: "Attitude", questionCount: 5, marksPerQuestion: 0, scored: false },
] as const;

/// Section 7 is drawn as whole lessons: 2 groups of 3 questions that stay
/// together and share their lesson text. Paper generation (a later phase) is
/// what acts on this; it lives here so there is one definition of it.
export const LESSON_GROUPS_PER_PAPER = 2;
export const QUESTIONS_PER_LESSON_GROUP = 3;

export const TOTAL_QUESTIONS = SECTION_BLUEPRINT.reduce(
  (total, section) => total + section.questionCount,
  0,
);

export const TOTAL_MARKS = SECTION_BLUEPRINT.reduce(
  (total, section) => total + section.questionCount * section.marksPerQuestion,
  0,
);

export function sectionBlueprint(section: number): SectionBlueprint | undefined {
  return SECTION_BLUEPRINT.find((entry) => entry.section === section);
}
