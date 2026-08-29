import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative URLs keep the same build usable from GitHub Pages and the
  // verified per-user Electron UI cache.
  base: "./",
  build: {
    outDir: "../../../tmp/generated/web",
    emptyOutDir: true
  }
});
