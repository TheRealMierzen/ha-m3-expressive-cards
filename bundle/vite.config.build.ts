import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "ha-m3-expressive-cards.js",
    },
    rollupOptions: {
      // Same contract as the per-card builds: everything (Lit included)
      // inlined, so the published file has no runtime dependencies. Lit is
      // shared across all nine cards here rather than duplicated nine times,
      // which is why the bundle is far smaller than the sum of its parts.
      external: [],
      output: { inlineDynamicImports: true },
    },
    minify: "esbuild",
  },
});
