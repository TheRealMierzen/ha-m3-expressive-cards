import { registerMockHaForm } from "./mock-ha-form";
import { registerMockHaIcon } from "./mock-ha-icon";
import "../src/smart-irrigation-card";
import type { SmartIrrigationCardConfig } from "../src/types";
import { buildMockHass } from "./mock-hass";
import { FixtureState, FixtureZone, buildFixtureEntities, localStamp } from "./fixtures";

registerMockHaForm();
registerMockHaIcon();

let config: SmartIrrigationCardConfig = {
  type: "custom:m3-smart-irrigation-card",
  title: "Irrigation",
  next_schedule: "schedule.irrigation_window",
};

const card = document.createElement("m3-smart-irrigation-card") as HTMLElement & {
  setConfig(config: SmartIrrigationCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
};
// The editor is the real one the card ships — every edit here goes through the
// same config-changed contract HA uses, and lands on the card beside it.
const editor = document.createElement("m3-smart-irrigation-card-editor") as HTMLElement & {
  setConfig(config: SmartIrrigationCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
};

function setConfig(next: SmartIrrigationCardConfig): void {
  config = next;
  card.setConfig(config);
  editor.setConfig(config);
  document.getElementById("config-dump")!.textContent = JSON.stringify(config, null, 2);
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function hoursAhead(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString();
}

/** Three zones covering the three shapes of the gauge: at capacity, dry, and
 * holding banked rain. */
const zones: FixtureZone[] = [
  {
    zoneId: 0,
    name: "Backyard",
    slug: "backyard",
    size: 85,
    throughput: 16.67,
    maximumBucket: 24,
    bucket: 0,
    mode: "automatic",
    multiplier: 1,
    leadTime: 0,
    maximumDuration: 3600,
    eto: 0.68,
    drainageRate: 50.8,
    currentDrainage: 0,
    wateringNow: false,
    problem: null,
    waterUsed: 406.7,
    lastIrrigationIso: hoursAgo(14),
    lastCalculated: localStamp(new Date(Date.now() - 19 * 3_600_000)),
    dataPoints: 18,
  },
  {
    zoneId: 1,
    name: "Front lawn",
    slug: "front_lawn",
    size: 120,
    throughput: 20,
    maximumBucket: 20,
    bucket: -3.4,
    mode: "automatic",
    multiplier: 1,
    leadTime: 15,
    maximumDuration: 3600,
    eto: 4.1,
    drainageRate: 45,
    currentDrainage: 0.2,
    wateringNow: false,
    problem: null,
    waterUsed: 1820.4,
    lastIrrigationIso: hoursAgo(38),
    lastCalculated: localStamp(new Date(Date.now() - 2 * 3_600_000)),
    dataPoints: 24,
  },
  {
    zoneId: 2,
    name: "Veg beds",
    slug: "veg_beds",
    size: 22,
    throughput: 8,
    maximumBucket: 16,
    bucket: 11.2,
    mode: "manual",
    multiplier: 1.2,
    leadTime: 0,
    maximumDuration: 1800,
    eto: 2.2,
    drainageRate: 30,
    currentDrainage: 1.4,
    wateringNow: false,
    problem: null,
    waterUsed: 233.1,
    lastIrrigationIso: hoursAgo(60),
    lastCalculated: localStamp(new Date(Date.now() - 2 * 3_600_000)),
    dataPoints: 24,
  },
];

const state: FixtureState = { zones, nextRunIso: hoursAhead(9) };

/** Only the first zone, so the single-zone case the integration most often
 * produces can be checked — and with it the rule that "Irrigate all zones"
 * isn't offered when there's only one zone to irrigate. */
let singleZone = false;
let darkMode = true;

function log(message: string): void {
  const panel = document.getElementById("log")!;
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  panel.prepend(line);
}

function refreshHass(): void {
  const visible: FixtureState = {
    ...state,
    zones: singleZone ? state.zones.slice(0, 1) : state.zones,
  };
  card.hass = editor.hass = buildMockHass(buildFixtureEntities(visible), darkMode, (domain, service, data) => {
    log(`callService ${domain}.${service} ${JSON.stringify(data ?? {})}`);

    const entityId = typeof data?.entity_id === "string" ? data.entity_id : "";
    if (domain === "button" && service === "press") {
      // Mirror the integration's own effects, so a press changes something
      // visible rather than only logging.
      const zone = state.zones.find((z) => entityId.includes(z.slug));
      if (entityId.endsWith("_reset_bucket") && zone) zone.bucket = 0;
      else if (entityId.endsWith("_reset_usage") && zone) zone.waterUsed = 0;
      else if (entityId.endsWith("_irrigate_now") && zone) zone.wateringNow = true;
      else if (entityId.endsWith("_irrigate_all")) for (const z of state.zones) z.wateringNow = true;
      else if (entityId.endsWith("_calculate") && zone) {
        zone.lastCalculated = localStamp(new Date());
      } else if (entityId.endsWith("_calculate_all")) {
        for (const z of state.zones) z.lastCalculated = localStamp(new Date());
      }
    } else if (domain === "number" && service === "set_value") {
      const zone = state.zones.find((z) => entityId.includes(z.slug));
      if (zone && typeof data?.value === "number") zone.multiplier = data.value;
    }
    refreshHass();
  });
}

function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  document.getElementById("dark-toggle")!.textContent = darkMode ? "☀ Light mode" : "🌙 Dark mode";
}

setConfig(config);
applyTheme();
refreshHass();
document.getElementById("app")!.appendChild(card);
document.getElementById("editor-host")!.appendChild(editor);

window.addEventListener("hass-more-info", (evt) => {
  const detail = (evt as CustomEvent<{ entityId: string }>).detail;
  log(`would open more-info dialog for ${detail.entityId}`);
});

document.getElementById("cycle-bucket")!.addEventListener("click", () => {
  // Walks the whole scale on the first zone: capacity, shallow deficit, past
  // the sump's floor, part-banked, brim-full.
  const steps = [0, -1.2, -9, 8, 24];
  const zone = state.zones[0];
  const next = steps[(steps.indexOf(zone.bucket) + 1) % steps.length];
  zone.bucket = next === undefined ? 0 : next;
  refreshHass();
});
document.getElementById("toggle-watering")!.addEventListener("click", () => {
  const zone = state.zones[0];
  zone.wateringNow = !zone.wateringNow;
  refreshHass();
});
document.getElementById("cycle-mode")!.addEventListener("click", () => {
  const order: Array<FixtureZone["mode"]> = ["automatic", "manual", "disabled"];
  const zone = state.zones[0];
  zone.mode = order[(order.indexOf(zone.mode) + 1) % order.length];
  refreshHass();
});
document.getElementById("toggle-problem")!.addEventListener("click", () => {
  const zone = state.zones[1];
  zone.problem = zone.problem ? null : "No weather data received in the last 24 hours";
  refreshHass();
});
document.getElementById("toggle-zone-count")!.addEventListener("click", () => {
  singleZone = !singleZone;
  document.getElementById("toggle-zone-count")!.textContent = singleZone ? "Show 3 zones" : "Show 1 zone";
  refreshHass();
});
document.getElementById("dark-toggle")!.addEventListener("click", () => {
  darkMode = !darkMode;
  applyTheme();
  refreshHass();
});

editor.addEventListener("config-changed", (event) => {
  setConfig((event as CustomEvent<{ config: SmartIrrigationCardConfig }>).detail.config);
  refreshHass();
});

document.getElementById("editor-toggle")!.addEventListener("click", () => {
  const panel = document.getElementById("editor-panel")!;
  const visible = panel.classList.toggle("visible");
  document.getElementById("editor-toggle")!.textContent = visible ? "Hide editor" : "Show editor";
});
