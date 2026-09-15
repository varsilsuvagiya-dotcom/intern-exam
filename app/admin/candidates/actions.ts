"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import {
  validateManualCandidate,
  type CandidateFieldError,
} from "@/lib/integrations/candidate-payload";

export type AddCandidateState =
  | { status: "idle" }
  | { status: "added"; name: string }
  | { status: "error"; errors: CandidateFieldError[] };

export type EditCandidateState =
  | { status: "idle" }
  | { status: "saved"; name: string }
  | { status: "error"; errors: CandidateFieldError[] };

/// Reads the three required candidate fields out of a submitted form.
function readCandidateFields(formData: FormData): {
  name: string;
  email: string;
  mobile: string;
} {
  const read = (key: string): string => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  return { name: read("name"), email: read("email"), mobile: read("mobile") };
}

/// The Phase 12 profile fields, all optional free text on the live sheet —
/// same reasoning as the import pipeline: an inconsistent answer here must
/// not block a save, so nothing beyond trimming and an empty-string-to-null
/// conversion happens. Kept in one list so the read side (this function) and
/// the write side (readProfileFields' callers) cannot drift on which fields
/// exist.
const PROFILE_TEXT_FIELDS = [
  "currentCity",
  "willingFullTimeSurat",
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
] as const;

function readProfileFields(formData: FormData): Prisma.CandidateUpdateInput {
  const data: Prisma.CandidateUpdateInput = {};

  for (const key of PROFILE_TEXT_FIELDS) {
    const raw = formData.get(key);
    const value = typeof raw === "string" ? raw.trim() : "";
    (data as Record<string, string | null>)[key] = value || null;
  }

  const dobRaw = formData.get("dateOfBirth");
  data.dateOfBirth = typeof dobRaw === "string" && dobRaw ? new Date(dobRaw) : null;

  return data;
}

/// Whether some *other* candidate already holds this email or mobile.
///
/// The schema indexes email and mobile but does not make either unique, so this
/// is a check rather than a constraint: two people genuinely can share a
/// household number, and the sync has always been allowed to write such a pair.
/// What it catches is the actual mistake — adding somebody the form already
/// registered, or editing one candidate onto another's details — which would
/// otherwise produce two records and a confusing attempts list.
///
/// `exceptId` is the row being edited, which must not collide with itself:
/// without it, saving a candidate with their own email unchanged would be
/// rejected as a duplicate of themselves.
async function findConflict(
  email: string,
  mobile: string,
  exceptId?: string,
): Promise<CandidateFieldError | null> {
  const existing = await prisma.candidate.findFirst({
    where: {
      OR: [{ email }, { mobile }],
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { email: true, mobile: true },
  });

  if (!existing) {
    return null;
  }

  return existing.email === email
    ? { field: "email", message: "A candidate with this email already exists." }
    : { field: "mobile", message: "A candidate with this mobile number already exists." };
}

/// Adds a candidate by hand.
///
/// The path that exists for a registration the Google Form never carried — a
/// walk-in, a correction, a candidate whose response failed to sync. It writes
/// exactly the same shape the sync writes, minus the response id, so a manual
/// candidate behaves identically everywhere downstream: they can be searched
/// for, they can sit the paper, and their attempts list the same way.
///
/// Nothing about attempts, papers or scoring happens here. Creating a candidate
/// is only creating a candidate; an attempt is still started by the candidate
/// at `/exam/start`, on the same terms as anyone else.
export async function addCandidate(
  _prev: AddCandidateState,
  formData: FormData,
): Promise<AddCandidateState> {
  await requireAdmin();

  const validation = validateManualCandidate(readCandidateFields(formData));

  if (!validation.ok) {
    return { status: "error", errors: validation.errors };
  }

  const { name, email, mobile } = validation.value;

  try {
    const conflict = await findConflict(email, mobile);

    if (conflict) {
      return { status: "error", errors: [conflict] };
    }

    await prisma.candidate.create({
      // `googleFormResponseId` is left null: see `validateManualCandidate`.
      data: { name, email, mobile },
      select: { id: true },
    });
  } catch (error) {
    // A stable message only — the error may carry the connection string.
    console.error("Manual candidate creation failed.", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      status: "error",
      errors: [{ field: "form", message: "The candidate could not be saved." }],
    };
  }

  revalidatePath("/admin/candidates");
  return { status: "added", name };
}

/// Corrects a candidate's details.
///
/// The same three fields under the same rules as adding one — a misspelt name,
/// a mistyped digit, an address that changed. Synchronized candidates are
/// editable too: the point of a correction is that the source was wrong.
///
/// What it does *not* touch is deliberate. `googleFormResponseId` is left
/// exactly as it is, so a synchronized candidate stays keyed to their form
/// response and a later re-sync still updates this row rather than inserting a
/// second one — the sync remains the authority for anyone it owns, and will
/// overwrite these fields if the form is resubmitted. `registeredAt` is left
/// alone because it records when they registered, not when the record was last
/// touched; `updatedAt` moves by itself.
///
/// Attempts, papers and scores are untouched. Editing identity does not reopen,
/// rescore or invalidate an attempt already sat — the attempt references the
/// candidate by id, and the id does not change here.
export async function updateCandidate(
  _prev: EditCandidateState,
  formData: FormData,
): Promise<EditCandidateState> {
  await requireAdmin();

  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return {
      status: "error",
      errors: [{ field: "form", message: "This candidate could not be identified." }],
    };
  }

  const validation = validateManualCandidate(readCandidateFields(formData));

  if (!validation.ok) {
    return { status: "error", errors: validation.errors };
  }

  const { name, email, mobile } = validation.value;

  try {
    const conflict = await findConflict(email, mobile, id);

    if (conflict) {
      return { status: "error", errors: [conflict] };
    }

    await prisma.candidate.update({
      where: { id },
      data: { name, email, mobile, ...readProfileFields(formData) },
      select: { id: true },
    });
  } catch (error) {
    // P2025 is "record not found": the candidate was deleted between the page
    // rendering and this submission. Worth its own message, because "could not
    // be saved" would send the administrator looking for a fault that is not
    // there.
    const missing =
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "P2025";

    if (!missing) {
      // A stable message only — the error may carry the connection string.
      console.error("Candidate update failed.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
    }

    return {
      status: "error",
      errors: [
        {
          field: "form",
          message: missing
            ? "This candidate no longer exists. Reload the page."
            : "The changes could not be saved.",
        },
      ],
    };
  }

  revalidatePath("/admin/candidates");
  return { status: "saved", name };
}
