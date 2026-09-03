import { registerMockHaForm } from "./mock-ha-form";
import { registerMockHaIcon } from "./mock-ha-icon";
import "../src/geyser-status-card";
import type { GeyserStatusCardConfig } from "../src/types";
import { buildMockHass } from "./mock-hass";
import { buildFixtureEntities, FixtureState } from "./fixtures";

registerMockHaForm();
registerMockHaIcon();

let config: GeyserStatusCardConfig = {
  type: "custom:m3-geyser-status-card",
  title: "Geyser",
  switch: "switch.geyser_power",
  current_temp: "sensor.geyser_current_temp",
  target_temp: "input_number.geyser_target_temp",
  time_to_heat: "sensor.geyser_time_to_heat",
  next_shower: "sensor.geyser_next_shower",
  heating_automation: "automation.geyser_heating",
  efficiency: "sensor.geyser_efficiency",
  shower_override_switch: "input_boolean.geyser_shower_override",
  default_shower_time: "input_datetime.geyser_default_shower_time",
};

const card = document.createElement("m3-geyser-status-card") as HTMLElement & {
  setConfig(config: GeyserStatusCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
};
// The editor is the real one the card ships — every edit here goes through the
// same config-changed contract HA uses, and lands on the card beside it.
const editor = document.createElement("m3-geyser-status-card-editor") as HTMLElement & {
  setConfig(config: GeyserStatusCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
};

function setConfig(next: GeyserStatusCardConfig): void {
  config = next;
  card.setConfig(config);
  editor.setConfig(config);
  document.getElementById("config-dump")!.textContent = JSON.stringify(config, null, 2);
}

setConfig(config);

/** next_shower reports a full datetime; default_shower_time reports a bare
 * time-of-day. Deriving the former from the latter keeps them genuinely
 * consistent — the card compares the two by time-of-day, so a fixture whose
 * "default" next_shower didn't actually match default_shower_time would make
 * the card look like it was misbehaving when it wasn't. */
function isoAtTimeOfDay(tod: string, dayOffset = 0): string {
  const [h, m] = tod.split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const DEFAULT_SHOWER_TIME_TOD = "18:00:00";
const DEFAULT_SHOWER_TIME_ISO = isoAtTimeOfDay(DEFAULT_SHOWER_TIME_TOD);
const OVERRIDE_SHOWER_TIME_ISO = isoAtTimeOfDay("11:00:00");

const state: FixtureState = {
  powerOn: true,
  currentTemp: 42,
  targetTemp: 60,
  timeToHeatMin: 24,
  nextShowerIso: DEFAULT_SHOWER_TIME_ISO,
  mode: "heating",
  efficiency: 92,
  overrideOn: false,
  defaultShowerTimeTod: DEFAULT_SHOWER_TIME_TOD,
};

/** Mirrors the real automation this card was built around: turning the
 * override off resets next_shower back to the default time. There's no
 * separate override-time entity — next_shower IS the override time while
 * the override is on. */
function setOverride(on: boolean): void {
  state.overrideOn = on;
  state.nextShowerIso = on ? OVERRIDE_SHOWER_TIME_ISO : DEFAULT_SHOWER_TIME_ISO;
}

let darkMode = true;

function log(message: string): void {
  const panel = document.getElementById("log")!;
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  panel.prepend(line);
}

function refreshHass(): void {
  card.hass = editor.hass = buildMockHass(buildFixtureEntities(state), darkMode, (domain, service, data) => {
    log(`callService ${domain}.${service} ${JSON.stringify(data ?? {})}`);

    if (domain === "switch" && data?.entity_id === config.switch) {
      state.powerOn = service === "turn_on";
    } else if (domain === "homeassistant" && data?.entity_id === config.shower_override_switch) {
      // Mirrors real HA, where the two directions are not symmetric:
      // turning the override ON changes nothing but the switch — no
      // automation rewrites next_shower — while turning it OFF is what
      // triggers the reset back to the default schedule.
      const turningOn = service === "turn_on" || (service === "toggle" && !state.overrideOn);
      if (turningOn) state.overrideOn = true;
      else setOverride(false);
    } else if (domain === "input_number") {
      state.targetTemp = clamp(state.targetTemp + (service === "increment" ? 1 : -1), 40, 70);
    }
    refreshHass();
  });
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
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

window.addEventListener("hass-more-info", (evt) => {
  const detail = (evt as CustomEvent<{ entityId: string }>).detail;
  log(`would open more-info dialog for ${detail.entityId}`);
});

document.getElementById("toggle-power")!.addEventListener("click", () => {
  state.powerOn = !state.powerOn;
  refreshHass();
});
document.getElementById("toggle-mode")!.addEventListener("click", () => {
  state.mode = state.mode === "heating" ? "cooling" : "heating";
  refreshHass();
});
document.getElementById("bump-temp")!.addEventListener("click", () => {
  state.currentTemp = Math.round((Math.random() * 30 + 30) * 10) / 10;
  refreshHass();
});
document.getElementById("toggle-override")!.addEventListener("click", () => {
  setOverride(!state.overrideOn);
  refreshHass();
});

/** Moves next_shower without touching the override switch, so the card's own
 * "shower time left the default -> flag it as an override" behaviour can be
 * exercised. Deliberately does NOT call setOverride: the whole point is to
 * see whether the card turns the switch on by itself. */
function setShowerTime(iso: string): void {
  state.nextShowerIso = iso;
  refreshHass();
}

document.getElementById("set-shower-custom")!.addEventListener("click", () => {
  const d = new Date();
  d.setHours(6, 30, 0, 0);
  setShowerTime(d.toISOString());
});
document.getElementById("set-shower-default")!.addEventListener("click", () => {
  setShowerTime(isoAtTimeOfDay(DEFAULT_SHOWER_TIME_TOD));
});
// Same time-of-day, different day: the card compares by time-of-day only, so
// this is still "the default schedule" and must NOT flag an override.
document.getElementById("set-shower-tomorrow")!.addEventListener("click", () => {
  setShowerTime(isoAtTimeOfDay(DEFAULT_SHOWER_TIME_TOD, 1));
});
document.getElementById("dark-toggle")!.addEventListener("click", () => {
  darkMode = !darkMode;
  applyTheme();
  refreshHass();
});

editor.addEventListener("config-changed", (event) => {
  setConfig((event as CustomEvent<{ config: GeyserStatusCardConfig }>).detail.config);
  refreshHass();
});

document.getElementById("editor-toggle")!.addEventListener("click", () => {
  const panel = document.getElementById("editor-panel")!;
  const visible = panel.classList.toggle("visible");
  document.getElementById("editor-toggle")!.textContent = visible ? "Hide editor" : "Show editor";
});
