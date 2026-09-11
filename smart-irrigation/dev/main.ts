import { registerMockHaForm } from "./mock-ha-form";
import { registerMockHaIcon } from "./mock-ha-icon";
import "../src/smart-irrigation-card";
import type { SmartIrrigationCardConfig } from "../src/types";
import { buildMockHass } from "./mock-hass";
import { FixtureState, FixtureZone, buildFixtureEntities, durationFor, localStamp } from "./fixtures";

registerMockHaForm();
registerMockHaIcon();

let config: SmartIrrigationCardConfig = {
  type: "custom:m3-smart-irrigation-card",
  title: "Irrigation",
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

/**
 * Three zones covering the states the gauge and the verdict have to tell
 * apart — which, since the verdict stopped being "is the bucket negative",
 * means covering both sides of the watering point and both sources it can
 * come from.
 *
 * - **Backyard** is drying down with an allowed depletion set in the
 *   integration: a real deficit, well short of it, and so no run at all. This
 *   is the state a healthy zone is in nearly all of the time, and the one the
 *   card used to report as "Needs water" within an hour of watering.
 * - **Front lawn** has the integration's default threshold of zero, so the
 *   card estimates a watering point and marks it as an estimate — and the
 *   integration has a run queued, because with no threshold any deficit at
 *   all produces one.
 * - **Veg beds** is holding banked rain above capacity.
 */
const zones: FixtureZone[] = [
  {
    zoneId: 0,
    name: "Backyard",
    slug: "backyard",
    size: 85,
    throughput: 16.67,
    maximumBucket: 24,
    bucket: -1.4,
    irrigationThreshold: 6,
    mode: "automatic",
    multiplier: 1,
    leadTime: 0,
    maximumDuration: 3600,
    eto: 0.68,
    precipitation: 0,
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
    bucket: -6.2,
    irrigationThreshold: 0,
    mode: "automatic",
    multiplier: 1,
    leadTime: 15,
    maximumDuration: 3600,
    eto: 4.1,
    precipitation: 0,
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
    irrigationThreshold: 4,
    mode: "manual",
    multiplier: 1.2,
    leadTime: 0,
    maximumDuration: 1800,
    eto: 2.2,
    precipitation: 3.6,
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
/** False imitates an integration too old to serve smart_irrigation/info, so
 * the card's fallback to no next run can be seen. */
let infoAvailable = !(window as unknown as { __DROP_INFO_WS__?: boolean }).__DROP_INFO_WS__;
let darkMode = true;

function log(message: string): void {
  const panel = document.getElementById("log")!;
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  panel.prepend(line);
}

/** Stands in for the integration's `smart_irrigation/info` websocket command.
 * Its reply is derived from the same fixture zones the entities are built
 * from, so the total duration the card prints beside the next start agrees
 * with the per-zone durations beside the gauges. `infoAvailable` false
 * simulates an install whose integration doesn't serve the command, which is
 * the path where the card must fall back to showing no next run. */
function irrigationInfoReply(visible: FixtureState): Record<string, unknown> {
  const running = visible.zones.filter((z) => durationFor(z) > 0);
  return {
    next_irrigation_start: state.nextRunIso,
    next_irrigation_duration: visible.zones.reduce((total, z) => total + durationFor(z), 0),
    next_irrigation_zones: running.map((z) => z.name),
    irrigation_reason: running.length
      ? running.map((z) => `Soil moisture deficit in ${z.name}`).join("; ")
      : "Scheduled irrigation maintenance",
    sunrise_time: state.nextRunIso,
    total_irrigation_duration: visible.zones.reduce((total, z) => total + durationFor(z), 0),
    irrigation_explanation: "Irrigation scheduled based on soil moisture calculations and weather data.",
  };
}

/** Stands in for `smart_irrigation/zones`. The card reads exactly two fields
 * of it — the zone id and the allowed depletion — but the command publishes
 * the whole stored zone, so the reply carries more than that: a card that
 * only works against a reply trimmed to what it wants isn't being tested. */
function zonesReply(visible: FixtureState): Array<Record<string, unknown>> {
  return visible.zones.map((zone) => ({
    id: zone.zoneId,
    name: zone.name,
    size: zone.size,
    throughput: zone.throughput,
    state: zone.mode,
    bucket: zone.bucket,
    maximum_bucket: zone.maximumBucket,
    irrigation_threshold: zone.irrigationThreshold,
    lead_time: zone.leadTime,
    maximum_duration: zone.maximumDuration,
    multiplier: zone.multiplier,
    duration: durationFor(zone),
  }));
}

function refreshHass(): void {
  const visible: FixtureState = {
    ...state,
    zones: singleZone ? state.zones.slice(0, 1) : state.zones,
  };
  const onCallWS = infoAvailable
    ? async (message: Record<string, unknown>): Promise<unknown> => {
        log(`callWS ${String(message.type)}`);
        if (message.type === "smart_irrigation/info") return irrigationInfoReply(visible);
        if (message.type === "smart_irrigation/zones") return zonesReply(visible);
        return {};
      }
    : undefined;

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
  }, onCallWS);
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
  // Walks the first zone past every landmark of its own scale. Backyard's
  // allowed depletion is 6mm, so the middle four steps are what the gauge and
  // the verdict have to tell apart: drying, nearly due, exactly due (the
  // marked line is covered from here on), overdue, and past the bottom of the
  // drawn band.
  const steps = [0, -1.4, -5.5, -6, -7, -9, 8, 24];
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
document.getElementById("toggle-info-ws")!.addEventListener("click", () => {
  infoAvailable = !infoAvailable;
  document.getElementById("toggle-info-ws")!.textContent = infoAvailable
    ? "Drop smart_irrigation/info"
    : "Restore smart_irrigation/info";
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
