import { registerMockHaIcon } from "./mock-ha-icon";
import { registerMockHaForm } from "./mock-ha-form";
import "../src/quick-toggles-card";
import type { QuickTogglesCardConfig } from "../src/types";
import { buildMockHass } from "./mock-hass";
import { buildFixtureEntities, DEV_CONFIG, FixtureState, VacuumState } from "./fixtures";

registerMockHaIcon();
registerMockHaForm();

const VACUUM_STATES: VacuumState[] = ["docked", "cleaning", "returning", "error"];

const state: FixtureState = {
  gymDay: true,
  onLeave: false,
  roombaSchedule: true,
  guestMode: false,
  vacuum: "cleaning",
  vacuumBattery: 78,
  scriptRunning: false,
  houseMode: "home",
};

let config: QuickTogglesCardConfig = structuredClone(DEV_CONFIG);
let darkMode = true;

interface CardElement extends HTMLElement {
  setConfig(config: QuickTogglesCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
}

const card = document.createElement("quick-toggles-card") as CardElement;
card.setConfig(config);
document.getElementById("app")!.appendChild(card);

const editor = document.createElement("quick-toggles-card-editor") as CardElement;
editor.setConfig(config);
document.getElementById("editor-host")!.appendChild(editor);

function log(message: string): void {
  const panel = document.getElementById("log")!;
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  panel.prepend(line);
}

/** Mirrors what HA does with a service call: mutate the entity the call
 * targets, then push a fresh hass down. */
function applyService(domain: string, service: string, data?: Record<string, unknown>): void {
  const entityId = String(data?.entity_id ?? "");
  const setBool = (key: keyof FixtureState, value: boolean) => {
    (state[key] as boolean) = value;
  };
  const current: Record<string, keyof FixtureState> = {
    "input_boolean.gym_day": "gymDay",
    "input_boolean.on_leave": "onLeave",
    "input_boolean.roomba_schedule": "roombaSchedule",
    "input_boolean.guest_mode": "guestMode",
  };

  if (domain === "homeassistant" && service === "toggle" && current[entityId]) {
    const key = current[entityId];
    setBool(key, !(state[key] as boolean));
  } else if (domain === "script" && service === "turn_on") {
    state.scriptRunning = true;
    window.setTimeout(() => {
      state.scriptRunning = false;
      refreshHass();
    }, 2500);
  }
}

function refreshHass(): void {
  const hass = buildMockHass(buildFixtureEntities(state), darkMode, (domain, service, data) => {
    log(`callService ${domain}.${service} ${JSON.stringify(data ?? {})}`);
    applyService(domain, service, data);
    refreshHass();
  });
  card.hass = hass;
  editor.hass = hass;
  syncToolbar();
}

function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  document.getElementById("dark-toggle")!.textContent = darkMode ? "☀ Light mode" : "🌙 Dark mode";
}

function dumpConfig(): void {
  document.getElementById("config-dump")!.textContent = JSON.stringify(config, null, 2);
}

function syncToolbar(): void {
  const mark = (id: string, on: boolean) => {
    document.getElementById(id)!.classList.toggle("on", on);
  };
  mark("t-gym", state.gymDay);
  mark("t-leave", state.onLeave);
  mark("t-roomba", state.roombaSchedule);
  mark("t-guest", state.guestMode);
  document.getElementById("vacuum-cycle")!.textContent = `Vacuum: ${state.vacuum}`;
  document.getElementById("battery")!.textContent = `Battery: ${state.vacuumBattery}%`;
  document.getElementById("house-mode")!.textContent = `House: ${state.houseMode}`;
}

function bindToggle(id: string, key: keyof FixtureState): void {
  document.getElementById(id)!.addEventListener("click", () => {
    (state[key] as boolean) = !(state[key] as boolean);
    refreshHass();
  });
}

bindToggle("t-gym", "gymDay");
bindToggle("t-leave", "onLeave");
bindToggle("t-roomba", "roombaSchedule");
bindToggle("t-guest", "guestMode");

document.getElementById("vacuum-cycle")!.addEventListener("click", () => {
  const next = (VACUUM_STATES.indexOf(state.vacuum) + 1) % VACUUM_STATES.length;
  state.vacuum = VACUUM_STATES[next];
  refreshHass();
});

document.getElementById("battery")!.addEventListener("click", () => {
  state.vacuumBattery = state.vacuumBattery > 20 ? 12 : 78;
  refreshHass();
});

document.getElementById("house-mode")!.addEventListener("click", () => {
  state.houseMode = state.houseMode === "home" ? "away" : "home";
  refreshHass();
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
  darkMode = !darkMode;
  applyTheme();
  refreshHass();
});

// The editor is the real one the card ships — every edit here goes through
// the same config-changed contract HA uses.
editor.addEventListener("config-changed", (evt) => {
  config = (evt as CustomEvent<{ config: QuickTogglesCardConfig }>).detail.config;
  card.setConfig(config);
  dumpConfig();
  refreshHass();
  log("config-changed from editor");
});

window.addEventListener("hass-more-info", (evt) => {
  const detail = (evt as CustomEvent<{ entityId: string }>).detail;
  log(`would open more-info dialog for ${detail.entityId}`);
});

applyTheme();
refreshHass();
dumpConfig();
