import { describe, expect, it } from "vitest";

import { canonicalViolationType, shouldReport } from "./dedup";

describe("canonicalViolationType", () => {
  it("groups WINDOW_BLUR under TAB_SWITCH", () => {
    expect(canonicalViolationType("WINDOW_BLUR")).toBe("TAB_SWITCH");
  });

  it("leaves every other type as itself", () => {
    expect(canonicalViolationType("TAB_SWITCH")).toBe("TAB_SWITCH");
    expect(canonicalViolationType("COPY")).toBe("COPY");
    expect(canonicalViolationType("DEVTOOLS")).toBe("DEVTOOLS");
  });
});

describe("shouldReport", () => {
  it("reports the first event of a session", () => {
    expect(shouldReport("COPY", 1000, null)).toBe(true);
  });

  it("suppresses a blur that follows a tab switch inside the window", () => {
    const last = { type: "TAB_SWITCH" as const, at: 1000 };
    expect(shouldReport("WINDOW_BLUR", 1200, last)).toBe(false);
  });

  it("suppresses a repeat of the same type inside the window", () => {
    const last = { type: "COPY" as const, at: 1000 };
    expect(shouldReport("COPY", 1000 + 1499, last)).toBe(false);
  });

  it("reports again once the window has elapsed", () => {
    const last = { type: "COPY" as const, at: 1000 };
    expect(shouldReport("COPY", 1000 + 1500, last)).toBe(true);
  });

  it("does not suppress an unrelated type once the burst window has passed", () => {
    const last = { type: "TAB_SWITCH" as const, at: 1000 };
    expect(shouldReport("COPY", 1000 + 800, last)).toBe(true);
  });

  it("suppresses a different type that lands inside the burst window", () => {
    // Regression: switching tabs can fire TAB_SWITCH and, moments later in
    // the same physical action, trip the DevTools dimension heuristic. Before
    // the burst window existed these were two different canonical types and
    // both counted, so one real action could cost two violations.
    const last = { type: "TAB_SWITCH" as const, at: 1000 };
    expect(shouldReport("DEVTOOLS", 1000 + 200, last)).toBe(false);
  });

  it("reports a different type once the burst window has elapsed, even inside the longer dedup window", () => {
    const last = { type: "TAB_SWITCH" as const, at: 1000 };
    expect(shouldReport("COPY", 1000 + 801, last)).toBe(true);
  });

  it("respects a custom window", () => {
    const last = { type: "PASTE" as const, at: 1000 };
    expect(shouldReport("PASTE", 1050, last, 100, 0)).toBe(false);
    expect(shouldReport("PASTE", 1100, last, 100, 0)).toBe(true);
  });

  it("respects a custom burst window", () => {
    const last = { type: "TAB_SWITCH" as const, at: 1000 };
    expect(shouldReport("COPY", 1000 + 40, last, 1500, 50)).toBe(false);
    expect(shouldReport("COPY", 1000 + 60, last, 1500, 50)).toBe(true);
  });
});
