import { registerMockHaIcon } from "./mock-ha-icon";
import "../src/body-stats-card";
import type { BodyStatsCardConfig } from "../src/types";
import { buildMockHass } from "./mock-hass";
import { buildFixtureEntities, FixtureState, PRESETS } from "./fixtures";

registerMockHaIcon();

const FULL_CONFIG: BodyStatsCardConfig = {
  type: "custom:body-stats-card",
  title: "Body Stats",
  sleep_efficiency_entity: "sensor.sleep_efficiency",
  eyesight_left_entity: "sensor.eyesight_left",
  eyesight_right_entity: "sensor.eyesight_right",
  resting_hr_entity: "sensor.resting_heart_rate",
  body_fat_entity: "sensor.body_fat",
  visceral_fat_entity: "sensor.visceral_fat",
  muscle_mass_entity: "sensor.muscle_mass",
  bone_mass_entity: "sensor.bone_mass",
  weight_entity: "sensor.body_weight",
  bmi_entity: "sensor.bmi",
  water_entity: "sensor.body_water",
  protein_entity: "sensor.body_protein",
};

// Drops a few entities entirely from config (distinct from an entity being
// configured but unavailable) — exercises the "never configured" gray
// region/badge path.
const PARTIAL_CONFIG: BodyStatsCardConfig = {
  ...FULL_CONFIG,
  eyesight_left_entity: undefined,
  eyesight_right_entity: undefined,
  muscle_mass_entity: undefined,
  bone_mass_entity: undefined,
  protein_entity: undefined,
  water_entity: undefined,
};

const card = document.createElement("body-stats-card") as HTMLElement & {
  setConfig(config: BodyStatsCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
  addEventListener(type: "hass-more-info", listener: (e: CustomEvent<{ entityId: string }>) => void): void;
};
card.setConfig(FULL_CONFIG);
card.addEventListener("hass-more-info", (e) => {
  logMoreInfo(e.detail.entityId);
});

let state: FixtureState = { ...PRESETS.ok };
let presetName = "ok";
let partial = false;
let darkMode = true;

// Cycles through the sex/age combinations that change which researched
// band a metric is judged against — see compute.ts.
const SEX_AGE_CYCLE: Array<Pick<BodyStatsCardConfig, "sex" | "age">> = [
  {},
  { sex: "male" },
  { sex: "male", age: 35 },
  { sex: "male", age: 65 },
  { sex: "female" },
  { sex: "female", age: 35 },
];
let sexAgeIndex = 0;

function logMoreInfo(entityId: string): void {
  const panel = document.getElementById("more-info-panel")!;
  panel.textContent = `hass-more-info -> ${entityId}`;
}

function renderStatePanel(): void {
  const panel = document.getElementById("state-panel")!;
  const sexAge = SEX_AGE_CYCLE[sexAgeIndex];
  panel.textContent = `preset=${presetName} partialConfig=${partial} restingHrUnavailable=${state.restingHrUnavailable} sex=${sexAge.sex ?? "(unset)"} age=${sexAge.age ?? "(unset)"}`;
}

function refreshHass(): void {
  card.hass = buildMockHass(buildFixtureEntities(state), darkMode);
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

function setPreset(name: keyof typeof PRESETS): void {
  presetName = name;
  state = { ...PRESETS[name], restingHrUnavailable: state.restingHrUnavailable };
  refreshHass();
}

document.getElementById("preset-good")!.addEventListener("click", () => setPreset("good"));
document.getElementById("preset-ok")!.addEventListener("click", () => setPreset("ok"));
document.getElementById("preset-bad")!.addEventListener("click", () => setPreset("bad"));
document.getElementById("preset-mixed")!.addEventListener("click", () => setPreset("mixed"));
document.getElementById("preset-typical")!.addEventListener("click", () => setPreset("typical"));

document.getElementById("cycle-sex-age")!.addEventListener("click", () => {
  sexAgeIndex = (sexAgeIndex + 1) % SEX_AGE_CYCLE.length;
  const base = partial ? PARTIAL_CONFIG : FULL_CONFIG;
  card.setConfig({ ...base, ...SEX_AGE_CYCLE[sexAgeIndex] });
  refreshHass();
});

document.getElementById("toggle-unavailable")!.addEventListener("click", () => {
  state = { ...state, restingHrUnavailable: !state.restingHrUnavailable };
  refreshHass();
});

document.getElementById("toggle-partial")!.addEventListener("click", () => {
  partial = !partial;
  const base = partial ? PARTIAL_CONFIG : FULL_CONFIG;
  card.setConfig({ ...base, ...SEX_AGE_CYCLE[sexAgeIndex] });
  refreshHass();
});

document.getElementById("dark-toggle")!.addEventListener("click", () => {
  darkMode = !darkMode;
  applyTheme();
  refreshHass();
});
