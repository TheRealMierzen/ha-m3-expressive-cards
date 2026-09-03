import { registerMockHaForm } from "./mock-ha-form";
import { registerMockHaIcon } from "./mock-ha-icon";
import "../src/schedule-timeline-card";
import type { ScheduleTimelineCardConfig } from "../src/types";
import { buildMockHass } from "./mock-hass";
import { FIXTURE_ENTITIES, FIXTURE_SCHEDULE_BLOCKS } from "./fixtures";

registerMockHaForm();
registerMockHaIcon();

let config: ScheduleTimelineCardConfig = {
  type: "custom:schedule-timeline-card",
  title: "Daily Schedule",
};

const card = document.createElement("schedule-timeline-card") as HTMLElement & {
  setConfig(config: ScheduleTimelineCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
};
// The editor is the real one the card ships — every edit here goes through the
// same config-changed contract HA uses, and lands on the card beside it.
const editor = document.createElement("schedule-timeline-card-editor") as HTMLElement & {
  setConfig(config: ScheduleTimelineCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
};

function setConfig(next: ScheduleTimelineCardConfig): void {
  config = next;
  card.setConfig(config);
  editor.setConfig(config);
  document.getElementById("config-dump")!.textContent = JSON.stringify(config, null, 2);
}

setConfig(config);

let darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;

function refreshHass(): void {
  card.hass = editor.hass = buildMockHass(FIXTURE_ENTITIES, FIXTURE_SCHEDULE_BLOCKS, darkMode);
}

function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  const toggle = document.getElementById("dark-toggle")!;
  toggle.textContent = darkMode ? "☀ Light mode" : "🌙 Dark mode";
}

applyTheme();
refreshHass();

document.getElementById("app")!.appendChild(card);
document.getElementById("editor-host")!.appendChild(editor);

const log = document.getElementById("log")!;
window.addEventListener("hass-more-info", (evt) => {
  const detail = (evt as CustomEvent<{ entityId: string }>).detail;
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = `[${new Date().toLocaleTimeString()}] would open more-info dialog for ${detail.entityId}`;
  log.prepend(line);
});

document.getElementById("dark-toggle")!.addEventListener("click", () => {
  darkMode = !darkMode;
  applyTheme();
  refreshHass();
});

document.getElementById("reset-filters")!.addEventListener("click", () => {
  localStorage.removeItem(`schedule-timeline-card:hidden:${config.title}`);
  setConfig(config);
  refreshHass();
});

editor.addEventListener("config-changed", (event) => {
  setConfig((event as CustomEvent<{ config: ScheduleTimelineCardConfig }>).detail.config);
  refreshHass();
});

document.getElementById("editor-toggle")!.addEventListener("click", () => {
  const panel = document.getElementById("editor-panel")!;
  const visible = panel.classList.toggle("visible");
  document.getElementById("editor-toggle")!.textContent = visible ? "Hide editor" : "Show editor";
});
