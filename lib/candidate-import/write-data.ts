import "server-only";

import type { Prisma } from "@/lib/generated/prisma/client";

import type { CandidateImportRow } from "./parse-candidates";

/// Fields the CSV can write. `email` and `mobile` are the matching keys and
/// are always present on a validated row (never null), so they are always
/// written; every other field follows the "blank cell preserves the existing
/// value" rule below.
const OPTIONAL_FIELD_KEYS = [
  "sourceTimestamp",
  "currentCity",
  "willingFullTimeSurat",
  "dateOfBirth",
  "highestQualification",
  "collegeName",
  "yearOfPassing",
  "cgpaOrPercentage",
  "technologies",
  "projectInfo",
  "githubUrl",
  "linkedinUrl",
  "liveProjectUrl",
  "selfLearningInfo",
  "aiToolsInfo",
  "reasonForJoining",
  "resumeUrl",
  "termsAgreement",
  "informationConfirmation",
  "hearAboutProgram",
] as const satisfies readonly (keyof CandidateImportRow)[];

/// Builds the Prisma `data` object for a row, dropping any field whose CSV
/// cell was blank (`null` in a validated row) so an incomplete live export can
/// never erase a value already on file (brief §14). `email`/`mobile`/`name`
/// are always included: they are required columns, so a validated row always
/// carries real values for them, and on create there is nothing to "preserve"
/// yet.
export function toWriteData(row: CandidateImportRow): Prisma.CandidateUncheckedCreateInput {
  const data: Record<string, unknown> = {
    name: row.name,
    email: row.email,
    mobile: row.mobile,
  };

  for (const key of OPTIONAL_FIELD_KEYS) {
    const value = row[key];
    if (value !== null) {
      data[key] = value;
    }
  }

  return data as Prisma.CandidateUncheckedCreateInput;
}
