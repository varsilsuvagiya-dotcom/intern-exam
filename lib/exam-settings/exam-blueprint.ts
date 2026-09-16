import "server-only";

/// The fixed shape of the CloudUS exam: 22 questions worth 34 marks.
///
/// Domain rules, not admin settings, so deliberately not in the database —
/// scoring and paper generation are built on these counts, and the only value
/// that would pass validation is the one below. The admin UI shows them
/// read-only. If the exam specification changes, change it here.
///
/// `code` is canonical: it is what `Question.section` stores and what all
/// active logic compares against. `ordinal` exists only for two historical
/// structures keyed by section number — the `AttemptQuestion.section` snapshot
/// and the `section_1_score` … `section_8_score` columns. It is never a second
/// source of truth for what a section *is*.
///
/// Hence the ordinals 3, 5 and 7 rather than 1, 2, 3: renumbering would change
/// what `AttemptQuestion.section` means on every paper already sat and point
/// the score columns at the wrong sections. The gaps are correct.

/// The one array to edit — every other export here is derived from it. (The
/// database still needs the section's questions imported and activated before a
/// paper can draw from it; this array only says the section exists.)
const BLUEPRINT_SOURCE = [
  { code: "JS", ordinal: 3, name: "Programming Fundamentals", questionCount: 10, marksPerQuestion: 1 },
  { code: "BUG", ordinal: 5, name: "Debugging", questionCount: 6, marksPerQuestion: 1.5 },
  { code: "LRN", ordinal: 7, name: "Learn-and-Apply", questionCount: 6, marksPerQuestion: 2.5 },
  //   { code: "LOG", ordinal: 1, name: "Logic & Patterns", questionCount: 10, marksPerQuestion: 1 },
  //   { code: "NUM", ordinal: 2, name: "Number Reasoning", questionCount: 6, marksPerQuestion: 1 },
  //   { code: "OUT", ordinal: 4, name: "Output Prediction", questionCount: 8, marksPerQuestion: 1.5 },
  //   { code: "STP", ordinal: 6, name: "Steps Problem Solving", questionCount: 4, marksPerQuestion: 2 },
] as const satisfies readonly {
  code: string;
  ordinal: number;
  name: string;
  questionCount: number;
  marksPerQuestion: number;
}[];

export const SECTION_CODES = BLUEPRINT_SOURCE.map((entry) => entry.code) as [
  (typeof BLUEPRINT_SOURCE)[number]["code"],
  ...(typeof BLUEPRINT_SOURCE)[number]["code"][],
];

export type SectionCode = (typeof SECTION_CODES)[number];

export type SectionBlueprint = {
  code: SectionCode;
  /// The historical section number. See the note above: snapshots and score
  /// columns only.
  ordinal: number;
  name: string;
  questionCount: number;
  marksPerQuestion: number;
};

/// In the order a candidate meets them, which is also the order the paper is
/// assembled in.
export const SECTION_BLUEPRINT: readonly SectionBlueprint[] = BLUEPRINT_SOURCE;

/// Learn-and-Apply is drawn as whole lessons: 2 groups of 3 questions that stay
/// together and share their lesson text.
export const LESSON_SECTION: SectionCode = "LRN";
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

const BY_CODE = new Map<string, SectionBlueprint>(
  SECTION_BLUEPRINT.map((entry) => [entry.code, entry]),
);

const BY_ORDINAL = new Map<number, SectionBlueprint>(
  SECTION_BLUEPRINT.map((entry) => [entry.ordinal, entry]),
);

export function sectionBlueprint(code: string): SectionBlueprint | undefined {
  return BY_CODE.get(code);
}

/// Looks a section up by its historical number. Used when reading a drawn paper
/// or a stored result, never when deciding what an active section is.
export function sectionBlueprintByOrdinal(ordinal: number): SectionBlueprint | undefined {
  return BY_ORDINAL.get(ordinal);
}

export function isSectionCode(value: string): value is SectionCode {
  return BY_CODE.has(value);
}

/// Resolves a section value from a source file. Matching is case-insensitive
/// after trimming, so `bug`, `BUG` and ` Bug ` all resolve. Anything else
/// returns null and the caller reports it: an unknown section code is always an
/// error, never silently remapped to a default.
export function resolveSectionCode(raw: string): SectionBlueprint | null {
  return BY_CODE.get(raw.trim().toUpperCase()) ?? null;
}

/// The display name for a section code, or for a historical ordinal when
/// rendering a paper drawn under an older structure.
export function sectionName(code: string): string {
  return BY_CODE.get(code)?.name ?? code;
}

export function sectionNameByOrdinal(ordinal: number): string {
  return BY_ORDINAL.get(ordinal)?.name ?? `Section ${ordinal}`;
}

/// Every section code the active exam accepts.
export const VALID_SECTIONS: readonly SectionCode[] = SECTION_BLUEPRINT.map((entry) => entry.code);
