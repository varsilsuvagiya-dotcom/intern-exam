import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// Testing Library's `render`/`act` helpers check this flag before wrapping
// updates; without it every state update outside an explicit `act()` call
// warns even though Testing Library already handles the wrapping correctly.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Testing Library's auto-cleanup only registers itself when it detects Jest's
// globals; this project doesn't enable Vitest's `globals` option, so without
// this the DOM from one test's `render` is still mounted when the next test
// renders another instance of the same component, producing "found multiple
// elements" failures that only reproduce when the whole file runs together.
afterEach(() => {
  cleanup();
});
