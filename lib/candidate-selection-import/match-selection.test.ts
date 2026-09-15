import { describe, expect, it } from "vitest";

import { matchSelectionRow } from "./match-selection";

const identity = { email: "a@example.com", mobile: "9812345670" };

describe("matchSelectionRow — email match", () => {
  it("finds the candidate when exactly one matches by email", () => {
    const result = matchSelectionRow({ byEmail: [{ id: "c1" }], byMobile: [] }, identity);
    expect(result).toEqual({ kind: "found", candidateId: "c1" });
  });

  it("prefers the email match when both email and mobile identify the same candidate", () => {
    const result = matchSelectionRow({ byEmail: [{ id: "c1" }], byMobile: [{ id: "c1" }] }, identity);
    expect(result).toEqual({ kind: "found", candidateId: "c1" });
  });
});

describe("matchSelectionRow — mobile fallback", () => {
  it("falls back to mobile when email matches nothing", () => {
    const result = matchSelectionRow({ byEmail: [], byMobile: [{ id: "c1" }] }, identity);
    expect(result).toEqual({ kind: "found", candidateId: "c1" });
  });

  it("falls back to mobile when the row had no email at all", () => {
    const result = matchSelectionRow(
      { byEmail: [], byMobile: [{ id: "c1" }] },
      { email: null, mobile: "9812345670" },
    );
    expect(result).toEqual({ kind: "found", candidateId: "c1" });
  });
});

describe("matchSelectionRow — not found", () => {
  it("reports not found when neither email nor mobile matches", () => {
    const result = matchSelectionRow({ byEmail: [], byMobile: [] }, identity);
    expect(result).toEqual({ kind: "notFound" });
  });
});

describe("matchSelectionRow — conflicts", () => {
  it("reports a conflict when email identifies one candidate and mobile identifies a different one", () => {
    const result = matchSelectionRow({ byEmail: [{ id: "c1" }], byMobile: [{ id: "c2" }] }, identity);
    expect(result.kind).toBe("conflict");
  });

  it("never returns a candidateId on an email/mobile conflict", () => {
    const result = matchSelectionRow({ byEmail: [{ id: "c1" }], byMobile: [{ id: "c2" }] }, identity);
    expect(result).not.toHaveProperty("candidateId");
  });

  it("reports a conflict when the email alone matches more than one existing candidate", () => {
    const result = matchSelectionRow({ byEmail: [{ id: "c1" }, { id: "c2" }], byMobile: [] }, identity);
    expect(result.kind).toBe("conflict");
  });

  it("reports a conflict when the mobile alone matches more than one existing candidate", () => {
    const result = matchSelectionRow({ byEmail: [], byMobile: [{ id: "c1" }, { id: "c2" }] }, identity);
    expect(result.kind).toBe("conflict");
  });
});
