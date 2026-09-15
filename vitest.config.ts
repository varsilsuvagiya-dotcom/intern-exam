import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const serverOnlyStub = fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url));
const rootAlias = fileURLToPath(new URL(".", import.meta.url));

/// Two projects sharing one config:
///
/// - "domain": pure domain logic (the import contract, header mapping, the
///   candidate-facing serialization boundary). Nothing here touches the
///   database — every module under test is deliberately free of Prisma so the
///   rules can be exercised directly. `environment: "node"`, no DOM.
/// - "ui": React component tests (app/**/*.test.tsx) that render with
///   Testing Library under jsdom. Added for Phase 14's ImportCandidatesDialog
///   — server actions are mocked at the module boundary, so these never touch
///   the database either.
export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            "server-only": serverOnlyStub,
            "@": rootAlias,
          },
        },
        test: {
          name: "domain",
          environment: "node",
          include: ["lib/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            "server-only": serverOnlyStub,
            "@": rootAlias,
          },
        },
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["app/**/*.test.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
