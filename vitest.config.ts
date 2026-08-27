/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["project/packages/**/*.test.ts", "project/apps/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      reportsDirectory: "./tmp/coverage"
    }
  }
});
