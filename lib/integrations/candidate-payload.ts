import "server-only";

export type CandidateSyncInput = {
  googleFormResponseId: string;
  name: string;
  email: string;
  mobile: string;
};

export type ValidationResult =
  | { ok: true; value: CandidateSyncInput }
  | { ok: false; errors: string[] };

const MAX_RESPONSE_ID = 128;
const MAX_NAME = 200;
const MAX_EMAIL = 320;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/// Candidates are hired locally and the application form collects Indian
/// mobile numbers, so a valid number is 10 digits starting 6-9. Normalization
/// only removes formatting a spreadsheet may introduce — spaces, hyphens,
/// brackets, dots — plus an optional +91/91/0 national prefix. Anything that
/// does not then look like a real 10-digit number is rejected rather than
/// guessed at, so a candidate's actual number is never silently rewritten into
/// a different one.
export function normalizeMobile(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  const withoutPrefix = cleaned.replace(/^(?:\+91|91|0)/, "");

  return /^[6-9]\d{9}$/.test(withoutPrefix) ? withoutPrefix : null;
}

/// A candidate entered by an administrator rather than synchronized.
///
/// The same name, email and mobile rules as the Google Form sync — deliberately
/// the same function, so a number the sync would reject cannot be let in by
/// hand. There is no `googleFormResponseId`: the column is nullable precisely
/// because a candidate can arrive without a form response, and inventing an id
/// here would make a manual entry indistinguishable from a synchronized one and
/// silently occupy a response id the form may later send.
///
/// Errors are keyed by field so the form can put each one beside its input;
/// the sync's flat string list is right for an API response and wrong for a
/// form.
export type ManualCandidateInput = {
  name: string;
  email: string;
  mobile: string;
};

export type CandidateFieldError = {
  field: "name" | "email" | "mobile" | "form";
  message: string;
};

export type ManualValidationResult =
  | { ok: true; value: ManualCandidateInput }
  | { ok: false; errors: CandidateFieldError[] };

export function validateManualCandidate(input: {
  name: string;
  email: string;
  mobile: string;
}): ManualValidationResult {
  const errors: CandidateFieldError[] = [];

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const mobileRaw = input.mobile.trim();

  if (!name) {
    errors.push({ field: "name", message: "Enter the candidate's full name." });
  } else if (name.length > MAX_NAME) {
    errors.push({ field: "name", message: `Use at most ${MAX_NAME} characters.` });
  }

  if (!email) {
    errors.push({ field: "email", message: "Enter an email address." });
  } else if (email.length > MAX_EMAIL || !EMAIL_PATTERN.test(email)) {
    errors.push({ field: "email", message: "Enter a valid email address." });
  }

  const mobile = mobileRaw ? normalizeMobile(mobileRaw) : null;

  if (!mobileRaw) {
    errors.push({ field: "mobile", message: "Enter a mobile number." });
  } else if (!mobile) {
    errors.push({
      field: "mobile",
      message: "Enter a valid 10-digit Indian mobile number.",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: { name, email, mobile: mobile as string } };
}

export function validateCandidatePayload(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, errors: ["Request body must be a JSON object."] };
  }

  const record = body as Record<string, unknown>;
  const readString = (key: string): string =>
    typeof record[key] === "string" ? (record[key] as string).trim() : "";

  const googleFormResponseId = readString("google_form_response_id");
  const name = readString("name");
  const email = readString("email").toLowerCase();
  const mobileRaw = readString("mobile");

  if (!googleFormResponseId) {
    errors.push("google_form_response_id is required.");
  } else if (googleFormResponseId.length > MAX_RESPONSE_ID) {
    errors.push("google_form_response_id is too long.");
  }

  if (!name) {
    errors.push("name is required.");
  } else if (name.length > MAX_NAME) {
    errors.push("name is too long.");
  }

  if (!email) {
    errors.push("email is required.");
  } else if (email.length > MAX_EMAIL || !EMAIL_PATTERN.test(email)) {
    errors.push("email is not valid.");
  }

  const mobile = mobileRaw ? normalizeMobile(mobileRaw) : null;

  if (!mobileRaw) {
    errors.push("mobile is required.");
  } else if (!mobile) {
    errors.push("mobile is not a valid 10-digit mobile number.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: { googleFormResponseId, name, email, mobile: mobile as string },
  };
}
