import { describe, expect, it } from "vitest";

import { normalizeMobile } from "./candidate-payload";

describe("normalizeMobile", () => {
  it("accepts a clean 10-digit number", () => {
    expect(normalizeMobile("9313234412")).toBe("9313234412");
  });

  it("does not corrupt a 10-digit number that happens to start with 91", () => {
    // Phase 13 real-data regression: "9157571942" is a genuine 10-digit
    // number whose first two digits are 91 — not a +91 country-code prefix.
    expect(normalizeMobile("9157571942")).toBe("9157571942");
    expect(normalizeMobile("9106899715")).toBe("9106899715");
    expect(normalizeMobile("9104462568")).toBe("9104462568");
  });

  it("strips a genuine +91 country-code prefix", () => {
    expect(normalizeMobile("+919313234412")).toBe("9313234412");
  });

  it("strips a genuine bare 91 prefix on a 12-digit value", () => {
    expect(normalizeMobile("919313234412")).toBe("9313234412");
  });

  it("strips a leading 0 on an 11-digit value", () => {
    expect(normalizeMobile("09313234412")).toBe("9313234412");
  });

  it("removes spaces, hyphens, brackets and dots", () => {
    expect(normalizeMobile("+91 93132 34412")).toBe("9313234412");
    expect(normalizeMobile("(931) 323-4412")).toBe("9313234412");
  });

  it("rejects a number that is not 10 digits after normalization", () => {
    expect(normalizeMobile("99240901")).toBeNull();
  });

  it("rejects a number that does not start 6-9", () => {
    expect(normalizeMobile("1234567890")).toBeNull();
  });
});
