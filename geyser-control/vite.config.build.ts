import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/geyser-status-card.ts"),
      formats: ["es"],
      fileName: () => "geyser-status-card.js",
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
