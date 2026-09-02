import { registerMockHaIcon } from "./mock-ha-icon";
import "../src/schedule-timeline-card";
import type { ScheduleTimelineCardConfig } from "../src/types";
import { buildMockHass } from "./mock-hass";
import { FIXTURE_ENTITIES, FIXTURE_SCHEDULE_BLOCKS } from "./fixtures";

registerMockHaIcon();

const config: ScheduleTimelineCardConfig = {
  type: "custom:schedule-timeline-card",
  title: "Daily Schedule",
};

const card = document.createElement("schedule-timeline-card") as HTMLElement & {
  setConfig(config: ScheduleTimelineCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
};
card.setConfig(config);

let darkMode = window.matchMedia("(prefers-color-scheme: dark)").matches;

function refreshHass(): void {
  card.hass = buildMockHass(FIXTURE_ENTITIES, FIXTURE_SCHEDULE_BLOCKS, darkMode);
}

function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  const toggle = document.getElementById("dark-toggle")!;
  toggle.textContent = darkMode ? "☀ Light mode" : "🌙 Dark mode";
}

applyTheme();
refreshHass();

document.getElementById("app")!.appendChild(card);

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
  card.setConfig(config);
  refreshHass();
});
