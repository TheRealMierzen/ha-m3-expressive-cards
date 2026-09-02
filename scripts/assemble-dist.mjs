/* Collects every card's single-file build, plus the combined bundle, into
 * one top-level dist/ — the shape HACS downloads (it takes every .js file it
 * finds in dist/, provided one matches the repository name).
 *
 * Runs after the workspace builds, so it only ever copies; it never builds.
 * A missing input is a hard error rather than a silent partial release.
 */
import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "dist");

/** workspace directory -> the file its build emits into <workspace>/dist/ */
const OUTPUTS = {
  bundle: "m3-cards.js",
  "activity-heatmap": "activity-heatmap-card.js",
  "body-stats": "body-stats-card.js",
  "garage-control": "garage-auto-open-card.js",
  "geyser-control": "geyser-status-card.js",
  "gym-tracker": "gym-tracker-card.js",
  "irrigation-control": "irrigation-schedule-card.js",
  "pc-control": "pc-overview-card.js",
  "quick-toggles": "quick-toggles-card.js",
  "schedule-timeline-card": "schedule-timeline-card.js",
};

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const missing = [];
for (const [workspace, file] of Object.entries(OUTPUTS)) {
  const src = join(root, workspace, "dist", file);
  if (!existsSync(src)) {
    missing.push(`${workspace}/dist/${file}`);
    continue;
  }
  await copyFile(src, join(outDir, file));
}

if (missing.length) {
  console.error("assemble-dist: missing build output:\n  " + missing.join("\n  "));
  console.error("Run `npm run build` from the repository root.");
  process.exit(1);
}

const written = (await readdir(outDir)).sort();
console.log(`assemble-dist: ${written.length} files -> dist/`);
for (const f of written) console.log(`  ${f}`);
