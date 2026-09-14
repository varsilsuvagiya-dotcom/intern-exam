import "server-only";

import { isSectionCode } from "@/lib/exam-settings/exam-blueprint";

import {
  DIFFICULTY_VALUES,
  MAX_ID_LENGTH,
  MAX_TOPIC_LENGTH,
  OPTION_VALUES,
} from "./csv-contract";
import type { QuestionRow } from "./csv-import";
import { validateMarks, validateQuestionRules } from "./question-rules";

/// Re-checks rows that made a round trip through the browser.
///
/// The preview step hands the validated batch to the client so the confirm step
/// does not have to re-upload and re-parse the files. What comes back is
/// therefore untrusted input, exactly like the original upload: this rebuilds
/// every row from scratch and accepts only values that pass the same rules the
/// parser applied, so a tampered payload cannot write a field the importer
/// would never have produced.
///
/// It returns null rather than a field-by-field error list. A failure here is
/// not an authoring mistake an admin can correct — the batch was already valid
/// when it left the server — so the caller simply asks for the files again.
export function verifyRows(value: unknown): QuestionRow[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const rows: QuestionRow[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      return null;
    }

    const record = entry as Record<string, unknown>;

    const text = (key: string): string | null => {
      const raw = record[key];
      return typeof raw === "string" ? raw : null;
    };

    const optional = (key: string): string | null | undefined => {
      const raw = record[key];
      if (raw === null) return null;
      return typeof raw === "string" ? raw : undefined;
    };

    const id = text("id");
    const topic = text("topic");
    const question = text("question");
    const optionA = text("optionA");
    const optionB = text("optionB");
    const optionC = text("optionC");
    const optionD = text("optionD");
    const marks = text("marks");

    if (
      id === null ||
      topic === null ||
      question === null ||
      optionA === null ||
      optionB === null ||
      optionC === null ||
      optionD === null ||
      marks === null
    ) {
      return null;
    }

    if (id === "" || id.length > MAX_ID_LENGTH || topic.length > MAX_TOPIC_LENGTH) {
      return null;
    }

    // Ids stay unique across the batch, as they were when first validated.
    if (seen.has(id)) {
      return null;
    }
    seen.add(id);

    // `section` is the stored representation: a canonical code, re-checked
    // against the active blueprint rather than trusted.
    const sectionRaw = record["section"];
    const section = typeof sectionRaw === "string" && isSectionCode(sectionRaw) ? sectionRaw : null;
    const difficulty = DIFFICULTY_VALUES[(text("difficulty") ?? "").toLowerCase()];
    const correct = OPTION_VALUES[(text("correct") ?? "").toLowerCase()];

    if (section === null || !difficulty || !correct || validateMarks(marks)) {
      return null;
    }

    const codeBlock = optional("codeBlock");
    const verifyCode = optional("verifyCode");
    const explanation = optional("explanation");
    const lessonText = optional("lessonText");
    const lessonGroup = optional("lessonGroup");

    if (
      codeBlock === undefined ||
      verifyCode === undefined ||
      explanation === undefined ||
      lessonText === undefined ||
      lessonGroup === undefined
    ) {
      return null;
    }

    if (validateQuestionRules({ section, marks, lessonText }).length > 0) {
      return null;
    }

    // Rebuilt field by field rather than spread, so nothing the client added to
    // the object can reach the database.
    rows.push({
      id,
      section,
      topic,
      difficulty,
      question,
      codeBlock,
      verifyCode,
      optionA,
      optionB,
      optionC,
      optionD,
      correct,
      explanation,
      lessonText,
      lessonGroup,
      marks,
    });
  }

  return rows;
}
