import { describe, expect, it } from "vitest";

import { CANONICAL_EMAIL_HEADER, IGNORED_EMAIL_HEADER } from "./csv-contract";
import { parseCandidateSheet } from "./parse-candidates";
import type { RawSheet } from "./read-csv-file";

/// The live-sheet header row (27 columns, including the two email columns —
/// "Email address" (ignored) and "Email Address2" (canonical) — and the two
/// always-empty trailing columns). Note: the repo's own copy of the sheet
/// (`untill tow 101.xlsx`, audited in Phase 12) actually has "Email Address"
/// with no "2"; "Email Address2" here reflects the explicit business
/// confirmation that overrode that audit — see the comment on
/// CANONICAL_EMAIL_HEADER in csv-contract.ts.
const REAL_HEADERS = [
  "Timestamp",
  IGNORED_EMAIL_HEADER,
  "Full Name",
  "Mobile Number (WhatsApp)",
  CANONICAL_EMAIL_HEADER,
  "Current City",
  "Are you willing to work full-time from our Surat office?",
  "Date of Birth",
  "Highest Qualification",
  "College / Institute Name",
  "Year of Passing / Expected Passing",
  "CGPA or Percentage",
  "Which technologies have you worked with?",
  "Have you built any project?",
  "Describe your best project in your own words.",
  "GitHub profile link",
  "LinkedIn profile link",
  "Any live project link",
  "Tell us about one thing you learned on your own, outside college. How did you learn it?",
  "Which AI tools have you used?",
  "Why do you want to join this training program?",
  "Paste a link to your resume (Google Drive / PDF link)",
  "I have read and understood all the above terms, and I agree to them.",
  "I confirm that all information provided in this form is true and correct.",
  "Where did you hear about this training program?",
  "Column 24",
  "Column 25",
];

/// One fully-populated row, values positioned to match REAL_HEADERS exactly.
function fullRow(overrides: Record<number, string> = {}): string[] {
  const base = [
    "9/3/2026 18:46:13", // Timestamp
    "old-email@example.com", // Email address (ignored)
    "Nij Bhavsar", // Full Name
    "9313234412", // Mobile Number (WhatsApp)
    "correct-email@example.com", // Email Address2 (canonical)
    "Surat", // Current City
    "Yes", // Willing full-time
    "5/23/05", // Date of Birth
    "B.E. / B.Tech", // Highest Qualification
    "SNPIT, Bardoli", // College
    "2026", // Year of Passing
    "8.73", // CGPA
    "JavaScript, React", // Technologies
    "Yes — both", // Have you built any project?
    "Mess Management System", // Project description
    "https://github.com/nij", // GitHub
    "https://linkedin.com/in/nij", // LinkedIn
    "https://nij.dev", // Live project
    "Learned JS on my own", // Self-learning
    "ChatGPT, Claude", // AI tools
    "Interested in full stack dev", // Reason for joining
    "https://drive.google.com/resume", // Resume
    "I agree", // Terms agreement
    "I confirm", // Information confirmation
    "Friends or family", // Hear about program
    "", // Column 24
    "", // Column 25
  ];

  for (const [index, value] of Object.entries(overrides)) {
    base[Number(index)] = value;
  }

  return base;
}

function sheet(rows: string[][], headers: string[] = REAL_HEADERS): RawSheet {
  return { headers, rows };
}

describe("parseCandidateSheet — header validation", () => {
  it("accepts the real live-sheet header row", () => {
    const result = parseCandidateSheet(sheet([fullRow()]));
    expect(result.ok).toBe(true);
  });

  it("rejects a file missing the canonical email column", () => {
    const headers = REAL_HEADERS.filter((h) => h !== CANONICAL_EMAIL_HEADER);
    const result = parseCandidateSheet(sheet([fullRow().slice(0, -1)], headers));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.message.includes(CANONICAL_EMAIL_HEADER))).toBe(true);
    }
  });

  it("rejects a file missing Full Name", () => {
    const headers = REAL_HEADERS.filter((h) => h !== "Full Name");
    const rows = [fullRow().filter((_, i) => REAL_HEADERS[i] !== "Full Name")];
    const result = parseCandidateSheet(sheet(rows, headers));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.field === "full_name")).toBe(true);
    }
  });

  it("rejects an unrecognised, non-ignored column instead of silently dropping it", () => {
    const headers = [...REAL_HEADERS, "Some New Column"];
    const rows = [[...fullRow(), "some value"]];
    const result = parseCandidateSheet(sheet(rows, headers));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.message.includes("Some New Column"))).toBe(true);
    }
  });
});

describe("parseCandidateSheet — the two email columns", () => {
  it("stores 'Email Address2' (canonical) as the candidate email, and ignores 'Email address'", () => {
    const result = parseCandidateSheet(
      sheet([fullRow({ 1: "old-email@example.com", 4: "correct-email@example.com" })]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].email).toBe("correct-email@example.com");
    }
  });

  it("never stores the ignored 'Email address' value under any field", () => {
    const result = parseCandidateSheet(
      sheet([fullRow({ 1: "should-never-appear@example.com", 4: "correct-email@example.com" })]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const row = result.rows[0];
      const values = Object.values(row);
      expect(values).not.toContain("should-never-appear@example.com");
    }
  });

  /// Regression test requested explicitly after Phase 13 review: proves the
  /// importer resolves Candidate.email from "Email Address2", never from
  /// "Email address", using the exact values named in that review.
  it("REGRESSION: 'Email address'=old@example.com + 'Email Address2'=correct@example.com -> Candidate.email is correct@example.com", () => {
    const result = parseCandidateSheet(
      sheet([fullRow({ 1: "old@example.com", 4: "correct@example.com" })]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].email).toBe("correct@example.com");
      expect(result.rows[0].email).not.toBe("old@example.com");

      // "Email address" (old@example.com) must not appear anywhere on the row.
      const values = Object.values(result.rows[0]);
      expect(values).not.toContain("old@example.com");
    }
  });
});

describe("parseCandidateSheet — ignored columns", () => {
  it("does not store Column 24 or Column 25 anywhere on the row", () => {
    const result = parseCandidateSheet(
      sheet([fullRow({ 25: "junk-24", 26: "junk-25" })]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const values = Object.values(result.rows[0]);
      expect(values).not.toContain("junk-24");
      expect(values).not.toContain("junk-25");
    }
  });
});

describe("parseCandidateSheet — row validation", () => {
  it("imports a valid row", () => {
    const result = parseCandidateSheet(sheet([fullRow()]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1);
      expect(result.rowErrors).toHaveLength(0);
    }
  });

  it("reports an invalid email but still imports other valid rows", () => {
    const rows = [fullRow({ 2: "Mule Harshada Mukeshbhai", 4: "Harsh" }), fullRow()];
    const result = parseCandidateSheet(sheet(rows));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1);
      expect(result.rowErrors).toHaveLength(1);
      expect(result.rowErrors[0]).toMatchObject({
        row: 2,
        field: "email",
        name: "Mule Harshada Mukeshbhai",
        email: "Harsh",
      });
    }
  });

  it("reports an invalid timestamp as a failed row rather than storing a guessed date", () => {
    const result = parseCandidateSheet(sheet([fullRow({ 0: "not-a-date" })]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(0);
      expect(result.rowErrors[0].field).toBe("timestamp");
    }
  });

  it("leaves optional empty fields as null rather than empty string", () => {
    const result = parseCandidateSheet(sheet([fullRow({ 5: "", 15: "", 16: "" })]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].currentCity).toBeNull();
      expect(result.rows[0].githubUrl).toBeNull();
      expect(result.rows[0].linkedinUrl).toBeNull();
    }
  });

  it("preserves a long free-text field in full", () => {
    const long = "A".repeat(5000);
    const result = parseCandidateSheet(sheet([fullRow({ 14: long })]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].projectInfo).toContain(long);
    }
  });

  it("preserves URL fields exactly", () => {
    const result = parseCandidateSheet(
      sheet([fullRow({ 15: "https://github.com/example?query=1&x=2" })]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].githubUrl).toBe("https://github.com/example?query=1&x=2");
    }
  });

  it("treats mobile as a string and preserves it exactly once normalized", () => {
    const result = parseCandidateSheet(sheet([fullRow({ 3: "9313234412" })]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.rows[0].mobile).toBe("string");
      expect(result.rows[0].mobile).toBe("9313234412");
    }
  });

  it("stores sourceTimestamp separately from any createdAt concept", () => {
    const result = parseCandidateSheet(sheet([fullRow({ 0: "7/30/2026 17:53:40" })]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].sourceTimestamp).toBeInstanceOf(Date);
      expect(result.rows[0].sourceTimestamp?.getFullYear()).toBe(2026);
    }
  });
});

describe("parseCandidateSheet — CSV edge cases (handled by the reader, exercised via the sheet grid)", () => {
  it("handles a comma inside a candidate response field", () => {
    // Papa Parse (the actual CSV reader) turns a quoted `"a, b"` into the
    // single string `a, b` before this function ever sees it — this test
    // exercises that same shape at the RawSheet boundary.
    const result = parseCandidateSheet(
      sheet([fullRow({ 12: "JavaScript, React / Next.js, Python, Django / Flask" })]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].technologies).toBe("JavaScript, React / Next.js, Python, Django / Flask");
    }
  });

  it("handles a line break inside a field", () => {
    const result = parseCandidateSheet(sheet([fullRow({ 14: "Line one\nLine two" })]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].projectInfo).toContain("\n");
    }
  });
});

describe("parseCandidateSheet — full-fixture round trip", () => {
  it("maps every non-ignored column to the correct Candidate field, and stores none of the ignored ones", () => {
    const result = parseCandidateSheet(sheet([fullRow()]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const row = result.rows[0];
    expect(row).toMatchObject({
      name: "Nij Bhavsar",
      email: "correct-email@example.com",
      mobile: "9313234412",
      currentCity: "Surat",
      willingFullTimeSurat: "Yes",
      highestQualification: "B.E. / B.Tech",
      collegeName: "SNPIT, Bardoli",
      yearOfPassing: "2026",
      cgpaOrPercentage: "8.73",
      technologies: "JavaScript, React",
      githubUrl: "https://github.com/nij",
      linkedinUrl: "https://linkedin.com/in/nij",
      liveProjectUrl: "https://nij.dev",
      selfLearningInfo: "Learned JS on my own",
      aiToolsInfo: "ChatGPT, Claude",
      reasonForJoining: "Interested in full stack dev",
      resumeUrl: "https://drive.google.com/resume",
      termsAgreement: "I agree",
      informationConfirmation: "I confirm",
      hearAboutProgram: "Friends or family",
    });
    expect(row.projectInfo).toContain("Mess Management System");
    expect(row.sourceTimestamp).toBeInstanceOf(Date);
    expect(row.dateOfBirth).toBeInstanceOf(Date);

    // Nothing from the ignored columns leaked into any field.
    const values = Object.values(row);
    expect(values).not.toContain("old-email@example.com");
  });
});
