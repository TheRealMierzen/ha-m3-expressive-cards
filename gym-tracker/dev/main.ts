import { registerMockHaForm } from "./mock-ha-form";
import { registerMockHaIcon } from "./mock-ha-icon";
import "../src/gym-tracker-card";
import type { GymTrackerCardConfig } from "../src/types";
import { buildMockHass } from "./mock-hass";
import { buildFixtureEntities, FixtureState } from "./fixtures";

registerMockHaForm();
registerMockHaIcon();

let config: GymTrackerCardConfig = {
  type: "custom:m3-gym-tracker-card",
  title: "Gym Tracker",
  actual_counter: "counter.gym_actual_counter",
  target_counter: "counter.gym_target_counter",
  adherence_sensor: "sensor.gym_adherence",
  monthly_cost_entity: "input_number.gym_monthly_cost",
  daily_cost_entity: "number.gym_daily_cost",
  money_wasted_entity: "number.gym_money_wasted",
  currency: "R",
};

const card = document.createElement("m3-gym-tracker-card") as HTMLElement & {
  setConfig(config: GymTrackerCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
};
// The editor is the real one the card ships — every edit here goes through the
// same config-changed contract HA uses, and lands on the card beside it.
const editor = document.createElement("m3-gym-tracker-card-editor") as HTMLElement & {
  setConfig(config: GymTrackerCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
};

function setConfig(next: GymTrackerCardConfig): void {
  config = next;
  card.setConfig(config);
  editor.setConfig(config);
  document.getElementById("config-dump")!.textContent = JSON.stringify(config, null, 2);
}

setConfig(config);

const COST_CYCLE = [500, 750, 1000, 1500];

// A mid-year snapshot: target is what an every-weekday-excluding-holidays
// automation would have ticked up to by early August, actual trails it a
// bit — a realistic "ok" adherence rather than a round demo number.
const state: FixtureState = {
  actual: 110,
  target: 150,
  monthlyCost: 750,
};

let darkMode = true;

function renderStatePanel(): void {
  const panel = document.getElementById("state-panel")!;
  panel.textContent = `actual=${state.actual} target=${state.target} monthlyCost=R${state.monthlyCost}`;
}

function refreshHass(): void {
  card.hass = editor.hass = buildMockHass(buildFixtureEntities(state), darkMode, (domain, service, data) => {
    const entityId = typeof data?.entity_id === "string" ? data.entity_id : undefined;
    if (domain === "counter" && entityId === "counter.gym_target_counter") {
      // Real HA counters only clamp at a configured minimum — assuming 0
      // here, since that's how most people would set this helper up.
      state.target = Math.max(0, state.target + (service === "increment" ? 1 : -1));
    } else if (domain === "input_number" && entityId === "input_number.gym_monthly_cost" && service === "set_value") {
      const value = Number(data?.value);
      if (Number.isFinite(value)) state.monthlyCost = value;
    }
    refreshHass();
  });
  renderStatePanel();
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

document.getElementById("log-visit")!.addEventListener("click", () => {
  state.actual += 1;
  refreshHass();
});
document.getElementById("undo-visit")!.addEventListener("click", () => {
  state.actual = Math.max(0, state.actual - 1);
  refreshHass();
});
document.getElementById("advance-target")!.addEventListener("click", () => {
  // Simulates the real automation: target ticks up by one on every
  // weekday that isn't a holiday, independent of whether a visit happens.
  state.target += 1;
  refreshHass();
});
document.getElementById("cycle-cost")!.addEventListener("click", () => {
  const next = COST_CYCLE[(COST_CYCLE.indexOf(state.monthlyCost) + 1) % COST_CYCLE.length];
  state.monthlyCost = next;
  refreshHass();
});
document.getElementById("reset-year")!.addEventListener("click", () => {
  // New year: both counters (actual visits and the daily-incrementing
  // target) start over from zero.
  state.actual = 0;
  state.target = 0;
  refreshHass();
});
document.getElementById("dark-toggle")!.addEventListener("click", () => {
  darkMode = !darkMode;
  applyTheme();
  refreshHass();
});

editor.addEventListener("config-changed", (event) => {
  setConfig((event as CustomEvent<{ config: GymTrackerCardConfig }>).detail.config);
  refreshHass();
});

document.getElementById("editor-toggle")!.addEventListener("click", () => {
  const panel = document.getElementById("editor-panel")!;
  const visible = panel.classList.toggle("visible");
  document.getElementById("editor-toggle")!.textContent = visible ? "Hide editor" : "Show editor";
});
