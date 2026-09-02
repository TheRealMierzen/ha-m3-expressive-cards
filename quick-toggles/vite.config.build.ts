import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/quick-toggles-card.ts"),
      formats: ["es"],
      fileName: () => "quick-toggles-card.js",
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
