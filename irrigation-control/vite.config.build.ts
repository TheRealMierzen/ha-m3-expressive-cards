import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/irrigation-schedule-card.ts"),
      formats: ["es"],
      fileName: () => "irrigation-schedule-card.js",
    },
    rollupOptions: {
      // Bundle everything (including lit) into one file so it can be
      // dropped straight into HA's www/ folder with no other dependencies.
      external: [],
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: "esbuild",
  },
});
