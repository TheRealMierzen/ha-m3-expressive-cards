import { registerMockHaForm } from "./mock-ha-form";
import "../src/activity-heatmap-card";
import type { ActivityHeatmapCardConfig } from "../src/types";
import { buildMockHass, StatsMode } from "./mock-hass";
import { buildFixture, DEMOS } from "./fixtures";
import { PALETTE_NAMES } from "../src/palette";

registerMockHaForm();

const fixture = buildFixture(new Date());

// Dev-only escape hatch so a Playwright run can check the card's numbers
// against the source data rather than against itself. Never bundled: nothing
// under dev/ reaches dist/.
(window as unknown as Record<string, unknown>).__fixture = fixture;

interface CardElement extends HTMLElement {
  setConfig(config: ActivityHeatmapCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
}

const SHAPES: Array<{ label: string; radius?: number }> = [
  { label: "square", radius: 2 },
  { label: "rounded", radius: 5 },
  { label: "dot", radius: 20 },
];

const STATS_MODES: StatsMode[] = ["full", "measurement", "legacy", "none"];

const state = {
  demo: 0,
  statsMode: 0,
  paletteIndex: 0,
  levels: 0,
  shape: 0,
  darkMode: true,
  failWS: false,
  emptyData: false,
  slow: false,
  /** Toolbar overrides only apply once touched, so a demo's own palette and
   * level count are what you see until you deliberately change them. */
  paletteTouched: false,
  levelsTouched: false,
  shapeTouched: false,
};

let config: ActivityHeatmapCardConfig = structuredClone(DEMOS[0].config);

const card = document.createElement("activity-heatmap-card") as CardElement;
document.getElementById("app")!.appendChild(card);

const editor = document.createElement("activity-heatmap-card-editor") as CardElement;
document.getElementById("editor-host")!.appendChild(editor);

function log(message: string): void {
  const panel = document.getElementById("log")!;
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  panel.prepend(line);
}

function buildHass(): ReturnType<typeof buildMockHass> {
  return buildMockHass({
    fixture,
    statsMode: STATS_MODES[state.statsMode],
    darkMode: state.darkMode,
    failWS: state.failWS,
    emptyData: state.emptyData,
    latencyMs: state.slow ? 1200 : 250,
    onCallService: (domain, service, data) =>
      log(`callService ${domain}.${service} ${JSON.stringify(data ?? {})}`),
    onWs: (_message, summary) => log(summary),
  });
}

function effectiveConfig(): ActivityHeatmapCardConfig {
  const next = structuredClone(config);
  if (state.paletteTouched) next.palette = PALETTE_NAMES[state.paletteIndex];
  if (state.levelsTouched) next.levels = state.levels + 1;
  if (state.shapeTouched) next.cell_radius = SHAPES[state.shape].radius;
  return next;
}

/** setConfig then hass, the same order HA uses — and the same order that
 * makes the card's first fetch fire exactly once. */
function apply(): void {
  const active = effectiveConfig();
  card.setConfig(active);
  editor.setConfig(active);
  const hass = buildHass();
  card.hass = hass;
  editor.hass = hass;
  syncToolbar();
  dumpConfig();
}

function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", state.darkMode ? "dark" : "light");
  document.getElementById("dark-toggle")!.textContent = state.darkMode
    ? "☀ Light mode"
    : "🌙 Dark mode";
}

function dumpConfig(): void {
  document.getElementById("config-dump")!.textContent = JSON.stringify(effectiveConfig(), null, 2);
}

function syncToolbar(): void {
  const active = effectiveConfig();
  document.getElementById("palette-cycle")!.textContent = `Palette: ${
    Array.isArray(active.palette) ? "custom" : (active.palette ?? "—")
  }`;
  document.getElementById("levels-cycle")!.textContent = `Levels: ${active.levels ?? 4}`;
  document.getElementById("shape-cycle")!.textContent = `Shape: ${SHAPES[state.shape].label}`;
  document.getElementById("stats-mode")!.textContent = `Backend: ${STATS_MODES[state.statsMode]}`;
  document.getElementById("stats-mode")!.classList.toggle("on", state.statsMode !== 0);
  for (const [id, on] of [
    ["fail-ws", state.failWS],
    ["empty-data", state.emptyData],
    ["slow-ws", state.slow],
  ] as Array<[string, boolean]>) {
    document.getElementById(id)!.classList.toggle("on", on);
  }
  for (const button of document.querySelectorAll("#demos button")) {
    button.classList.toggle("on", Number((button as HTMLElement).dataset.index) === state.demo);
  }
}

const demoHost = document.getElementById("demos")!;
DEMOS.forEach((demo, index) => {
  const button = document.createElement("button");
  button.textContent = demo.label;
  button.dataset.index = String(index);
  button.style.marginRight = "8px";
  button.addEventListener("click", () => {
    state.demo = index;
    state.paletteTouched = false;
    state.levelsTouched = false;
    state.shapeTouched = false;
    config = structuredClone(demo.config);
    apply();
  });
  demoHost.appendChild(button);
});

document.getElementById("palette-cycle")!.addEventListener("click", () => {
  state.paletteTouched = true;
  state.paletteIndex = (state.paletteIndex + 1) % PALETTE_NAMES.length;
  apply();
});

document.getElementById("levels-cycle")!.addEventListener("click", () => {
  state.levelsTouched = true;
  state.levels = (state.levels + 1) % 9;
  apply();
});

document.getElementById("shape-cycle")!.addEventListener("click", () => {
  state.shapeTouched = true;
  state.shape = (state.shape + 1) % SHAPES.length;
  apply();
});

document.getElementById("stats-mode")!.addEventListener("click", () => {
  state.statsMode = (state.statsMode + 1) % STATS_MODES.length;
  apply();
});

document.getElementById("fail-ws")!.addEventListener("click", () => {
  state.failWS = !state.failWS;
  apply();
});

document.getElementById("empty-data")!.addEventListener("click", () => {
  state.emptyData = !state.emptyData;
  apply();
});

document.getElementById("slow-ws")!.addEventListener("click", () => {
  state.slow = !state.slow;
  apply();
});

document.getElementById("narrow-toggle")!.addEventListener("click", () => {
  document.body.classList.toggle("narrow");
});

document.getElementById("editor-toggle")!.addEventListener("click", () => {
  const panel = document.getElementById("editor-panel")!;
  const visible = panel.classList.toggle("visible");
  document.getElementById("editor-toggle")!.textContent = visible ? "Hide editor" : "Show editor";
});

document.getElementById("dark-toggle")!.addEventListener("click", () => {
  state.darkMode = !state.darkMode;
  applyTheme();
  apply();
});

// The editor is the real one the card ships — every edit here goes through
// the same config-changed contract HA uses.
editor.addEventListener("config-changed", (event) => {
  config = (event as CustomEvent<{ config: ActivityHeatmapCardConfig }>).detail.config;
  state.paletteTouched = false;
  state.levelsTouched = false;
  state.shapeTouched = false;
  apply();
  log("config-changed from editor");
});

window.addEventListener("hass-more-info", (event) => {
  const detail = (event as CustomEvent<{ entityId: string }>).detail;
  log(`would open more-info dialog for ${detail.entityId}`);
});

applyTheme();
apply();
