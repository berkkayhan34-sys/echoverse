/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "preload.cjs"),
      formats: ["cjs"],
      fileName: () => "preload.bundle.cjs"
    },
    outDir: resolve(import.meta.dirname, "../../../../tmp/generated/desktop-electron"),
    emptyOutDir: true,
    rollupOptions: {
      external: ["electron"]
    }
  }
});
