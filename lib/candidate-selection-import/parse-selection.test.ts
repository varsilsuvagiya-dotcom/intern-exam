import { describe, expect, it } from "vitest";

import { parseSelectionSheet } from "./parse-selection";
import { CANONICAL_EMAIL_HEADER, IGNORED_EMAIL_HEADER, MOBILE_HEADER, NAME_HEADER } from "./selection-contract";
import type { RawSheet } from "./read-selection-file";

function sheet(headers: string[], rows: string[][]): RawSheet {
  return { headers, rows };
}

const FULL_HEADERS = [NAME_HEADER, IGNORED_EMAIL_HEADER, CANONICAL_EMAIL_HEADER, MOBILE_HEADER];

describe("parseSelectionSheet — header validation", () => {
  it("accepts a file with 'Email Address2' and 'Mobile Number (WhatsApp)'", () => {
    const result = parseSelectionSheet(sheet(FULL_HEADERS, [["A", "old@x.com", "a@example.com", "9812345670"]]));
    expect(result.ok).toBe(true);
  });

  it("rejects a file missing 'Email Address2'", () => {
    const result = parseSelectionSheet(sheet(["Name", MOBILE_HEADER], [["A", "9812345670"]]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.message.includes(CANONICAL_EMAIL_HEADER))).toBe(true);
    }
  });

  it("rejects a file missing 'Mobile Number (WhatsApp)'", () => {
    const result = parseSelectionSheet(sheet(["Name", CANONICAL_EMAIL_HEADER], [["A", "a@example.com"]]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.message.includes(MOBILE_HEADER))).toBe(true);
    }
  });

  it("does NOT accept 'Email Address' (no '2') as the canonical column", () => {
    const result = parseSelectionSheet(sheet(["Email Address", MOBILE_HEADER], [["a@example.com", "9812345670"]]));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.message.includes(CANONICAL_EMAIL_HEADER))).toBe(true);
    }
  });
});

describe("parseSelectionSheet — canonical email regression", () => {
  it("uses 'Email Address2', ignoring 'Email address' entirely", () => {
    const result = parseSelectionSheet(
      sheet(FULL_HEADERS, [["Nij", "wrong@example.com", "correct@example.com", "9812345670"]]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].email).toBe("correct@example.com");
      expect(result.rows[0].email).not.toBe("wrong@example.com");
    }
  });

  it("trims and lowercases 'Email Address2'", () => {
    const result = parseSelectionSheet(
      sheet(FULL_HEADERS, [["Nij", "", "  Test@Example.COM  ", "9812345670"]]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].email).toBe("test@example.com");
    }
  });
});

describe("parseSelectionSheet — mobile fallback parsing", () => {
  it("normalizes mobile via normalizeMobile (reused from Phase 13, not reinvented)", () => {
    const result = parseSelectionSheet(sheet(FULL_HEADERS, [["Nij", "", "a@example.com", "+91 98123 45670"]]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].mobile).toBe("9812345670");
    }
  });

  it("does not corrupt a 10-digit mobile that starts with 91 (Phase 13 regression, reused here)", () => {
    const result = parseSelectionSheet(sheet(FULL_HEADERS, [["Nij", "", "a@example.com", "9157571942"]]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].mobile).toBe("9157571942");
    }
  });

  it("keeps a row with only a mobile (no email) as valid", () => {
    const result = parseSelectionSheet(sheet(FULL_HEADERS, [["Nij", "", "", "9812345670"]]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].email).toBeNull();
      expect(result.rows[0].mobile).toBe("9812345670");
    }
  });

  it("keeps a row with only an email (no mobile) as valid", () => {
    const result = parseSelectionSheet(sheet(FULL_HEADERS, [["Nij", "", "a@example.com", ""]]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].email).toBe("a@example.com");
      expect(result.rows[0].mobile).toBeNull();
    }
  });
});

describe("parseSelectionSheet — row validation", () => {
  it("reports a row with neither a usable email nor a usable mobile", () => {
    const result = parseSelectionSheet(sheet(FULL_HEADERS, [["Nij", "", "", ""]]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(0);
      expect(result.rowErrors).toHaveLength(1);
    }
  });

  it("falls back to mobile when the email is present but invalid", () => {
    const result = parseSelectionSheet(sheet(FULL_HEADERS, [["Nij", "", "not-an-email", "9812345670"]]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].email).toBeNull();
      expect(result.rows[0].mobile).toBe("9812345670");
    }
  });

  it("rejects a file with zero data rows", () => {
    const result = parseSelectionSheet(sheet(FULL_HEADERS, []));
    expect(result.ok).toBe(false);
  });

  it("carries the optional name for reporting only", () => {
    const result = parseSelectionSheet(sheet(FULL_HEADERS, [["Nij Bhavsar", "", "a@example.com", "9812345670"]]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].name).toBe("Nij Bhavsar");
    }
  });

  it("treats a missing Full Name column as fine — name stays optional", () => {
    const result = parseSelectionSheet(
      sheet([IGNORED_EMAIL_HEADER, CANONICAL_EMAIL_HEADER, MOBILE_HEADER], [["", "a@example.com", "9812345670"]]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows[0].name).toBeNull();
    }
  });
});
