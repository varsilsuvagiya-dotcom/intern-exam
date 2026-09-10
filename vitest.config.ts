import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/// Unit tests for the pure domain logic: the import contract, header mapping
/// and the candidate-facing serialization boundary. Nothing here touches the
/// database — every module under test is deliberately free of Prisma so the
/// rules can be exercised directly.
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // `server-only` throws when imported outside a React Server Component.
      // This is the very file Next resolves it to under the `react-server`
      // condition, so the guard still does its real job in the application and
      // only stops being a hard error inside the test runner.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
