import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/echoverse/",
  build: {
    outDir: "../../../tmp/generated/web",
    emptyOutDir: true
  }
});
