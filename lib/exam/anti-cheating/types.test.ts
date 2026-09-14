import { describe, expect, it } from "vitest";

import { reachesLimit } from "./types";

describe("reachesLimit", () => {
  it("is false below the limit", () => {
    expect(reachesLimit(1, 3)).toBe(false);
    expect(reachesLimit(2, 3)).toBe(false);
  });

  it("is true once the count reaches the limit", () => {
    expect(reachesLimit(3, 3)).toBe(true);
  });

  it("is true past the limit, in case a count is ever read after the fact", () => {
    expect(reachesLimit(4, 3)).toBe(true);
  });

  it("terminates on the first violation when the limit is configured to 1", () => {
    expect(reachesLimit(1, 1)).toBe(true);
  });
});
