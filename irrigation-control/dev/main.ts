import { registerMockHaIcon } from "./mock-ha-icon";
import "../src/irrigation-schedule-card";
import type { IrrigationScheduleCardConfig } from "../src/types";
import { buildMockHass } from "./mock-hass";
import { buildFixtureEntities, FixtureState } from "./fixtures";

registerMockHaIcon();

const config: IrrigationScheduleCardConfig = {
  type: "custom:irrigation-schedule-card",
  title: "Front Lawn Irrigation",
  automation: "automation.irrigation_ai",
  should_water: "input_boolean.should_water",
  start_time: "input_datetime.irrigation_start",
  stop_time: "input_datetime.irrigation_stop",
  duration: "input_number.irrigation_duration",
  timer: "timer.irrigation",
  valve: "switch.irrigation_valve",
};

const card = document.createElement("irrigation-schedule-card") as HTMLElement & {
  setConfig(config: IrrigationScheduleCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
};
card.setConfig(config);

function parseHms(hms: string): number {
  const match = /^(\d+):(\d{2}):(\d{2})$/.exec(hms.trim());
  if (!match) return 0;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

function formatHms(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

const state: FixtureState = {
  automationOn: true,
  shouldWater: true,
  valveOn: false,
  valveLastChanged: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  timerState: "idle",
  timerDuration: "0:15:00",
};

let darkMode = true;

function log(message: string): void {
  const panel = document.getElementById("log")!;
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  panel.prepend(line);
}

function refreshHass(): void {
  card.hass = buildMockHass(buildFixtureEntities(state), darkMode, (domain, service, data) => {
    log(`callService ${domain}.${service} ${JSON.stringify(data ?? {})}`);

    if (domain === "automation") {
      state.automationOn = service === "turn_on";
    } else if (domain === "switch") {
      state.valveOn = service === "turn_on";
      state.valveLastChanged = new Date().toISOString();
    } else if (domain === "timer") {
      if (service === "start") {
        const duration = typeof data?.duration === "string" ? data.duration : state.timerDuration;
        state.timerDuration = duration;
        state.timerState = "active";
        state.timerFinishesAt = new Date(Date.now() + parseHms(duration) * 1000).toISOString();
        state.timerRemaining = undefined;
      } else if (service === "cancel") {
        state.timerState = "idle";
        state.timerFinishesAt = undefined;
        state.timerRemaining = undefined;
      } else if (service === "pause") {
        if (state.timerState === "active" && state.timerFinishesAt) {
          const remaining = (new Date(state.timerFinishesAt).getTime() - Date.now()) / 1000;
          state.timerRemaining = formatHms(remaining);
          state.timerState = "paused";
          state.timerFinishesAt = undefined;
        }
      }
    }
    refreshHass();
  });
}

function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  const toggle = document.getElementById("dark-toggle")!;
  toggle.textContent = darkMode ? "☀ Light mode" : "🌙 Dark mode";
}

applyTheme();
refreshHass();
document.getElementById("app")!.appendChild(card);

document.getElementById("toggle-automation")!.addEventListener("click", () => {
  state.automationOn = !state.automationOn;
  refreshHass();
});
document.getElementById("toggle-should-water")!.addEventListener("click", () => {
  state.shouldWater = !state.shouldWater;
  refreshHass();
});
document.getElementById("toggle-valve")!.addEventListener("click", () => {
  // Simulates an external manual toggle (e.g. a physical switch) rather
  // than going through the card's own paired valve+timer control.
  state.valveOn = !state.valveOn;
  state.valveLastChanged = new Date().toISOString();
  refreshHass();
});
document.getElementById("pause-timer")!.addEventListener("click", () => {
  if (state.timerState === "active" && state.timerFinishesAt) {
    const remaining = (new Date(state.timerFinishesAt).getTime() - Date.now()) / 1000;
    state.timerRemaining = formatHms(remaining);
    state.timerState = "paused";
    state.timerFinishesAt = undefined;
  } else if (state.timerState === "paused" && state.timerRemaining) {
    state.timerFinishesAt = new Date(Date.now() + parseHms(state.timerRemaining) * 1000).toISOString();
    state.timerState = "active";
    state.timerRemaining = undefined;
  }
  refreshHass();
});
document.getElementById("dark-toggle")!.addEventListener("click", () => {
  darkMode = !darkMode;
  applyTheme();
  refreshHass();
});
