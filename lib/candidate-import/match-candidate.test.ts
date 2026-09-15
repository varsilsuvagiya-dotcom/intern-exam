import { describe, expect, it } from "vitest";

import { matchCandidate } from "./match-candidate";

const base = { rowNumber: 2, name: "Nij Bhavsar", email: "nij@example.com", mobile: "9313234412" };

describe("matchCandidate", () => {
  it("creates a new candidate when nothing matches", () => {
    const result = matchCandidate({ ...base, byEmail: [], byMobile: [] });
    expect(result).toEqual({ kind: "create" });
  });

  it("updates the existing candidate found by email", () => {
    const result = matchCandidate({ ...base, byEmail: [{ id: "c1" }], byMobile: [] });
    expect(result).toEqual({ kind: "update", candidateId: "c1" });
  });

  it("updates the existing candidate found by mobile when email did not match", () => {
    const result = matchCandidate({ ...base, byEmail: [], byMobile: [{ id: "c1" }] });
    expect(result).toEqual({ kind: "update", candidateId: "c1" });
  });

  it("updates the same candidate found by both email and mobile (idempotent re-import)", () => {
    const result = matchCandidate({ ...base, byEmail: [{ id: "c1" }], byMobile: [{ id: "c1" }] });
    expect(result).toEqual({ kind: "update", candidateId: "c1" });
  });

  it("reports a conflict when email and mobile match two different candidates", () => {
    const result = matchCandidate({ ...base, byEmail: [{ id: "c1" }], byMobile: [{ id: "c2" }] });
    expect(result.kind).toBe("conflict");
  });

  it("reports a conflict when email matches more than one existing candidate", () => {
    const result = matchCandidate({ ...base, byEmail: [{ id: "c1" }, { id: "c2" }], byMobile: [] });
    expect(result.kind).toBe("conflict");
  });

  it("reports a conflict when mobile matches more than one existing candidate", () => {
    const result = matchCandidate({ ...base, byEmail: [], byMobile: [{ id: "c1" }, { id: "c2" }] });
    expect(result.kind).toBe("conflict");
  });

  it("does not overwrite either candidate on conflict — no candidateId is returned", () => {
    const result = matchCandidate({ ...base, byEmail: [{ id: "c1" }], byMobile: [{ id: "c2" }] });
    expect(result).not.toHaveProperty("candidateId");
  });
});
