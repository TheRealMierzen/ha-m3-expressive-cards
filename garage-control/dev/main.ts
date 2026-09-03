import { registerMockHaForm } from "./mock-ha-form";
import { registerMockHaIcon } from "./mock-ha-icon";
import "../src/garage-auto-open-card";
import type { GarageAutoOpenCardConfig } from "../src/types";
import { buildMockHass } from "./mock-hass";
import { buildFixtureEntities, DoorFixture } from "./fixtures";

registerMockHaForm();
registerMockHaIcon();

let config: GarageAutoOpenCardConfig = {
  type: "custom:garage-auto-open-card",
  title: "Auto Garage",
  automation: "automation.garage_auto_open",
  left_entity: "device_tracker.my_phone",
  right_entity: "device_tracker.partner_phone",
  left_cover: "cover.garage_left",
  right_cover: "cover.garage_right",
  left_label: "Me",
  right_label: "Partner",
};

const card = document.createElement("garage-auto-open-card") as HTMLElement & {
  setConfig(config: GarageAutoOpenCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
};
// The editor is the real one the card ships — every edit here goes through the
// same config-changed contract HA uses, and lands on the card beside it.
const editor = document.createElement("garage-auto-open-card-editor") as HTMLElement & {
  setConfig(config: GarageAutoOpenCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
};

function setConfig(next: GarageAutoOpenCardConfig): void {
  config = next;
  card.setConfig(config);
  editor.setConfig(config);
  document.getElementById("config-dump")!.textContent = JSON.stringify(config, null, 2);
}

setConfig(config);

let autoOn = true;
let leftHome = false;
let rightHome = true;
let darkMode = true;
let rightDoorOffline = false;

const doors: Record<string, DoorFixture> = {
  "cover.garage_left": { state: "closed", position: 0 },
  "cover.garage_right": { state: "open", position: 100 },
};
/** Real openers take ~15s end to end; 150ms a step keeps the harness brisk. */
const TRAVEL_STEP_MS = 150;
const travelTimers: Record<string, number | undefined> = {};

function log(message: string): void {
  const el = document.getElementById("log");
  if (!el) return;
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = `${new Date().toLocaleTimeString()}  ${message}`;
  el.prepend(line);
}

function stopTravel(entityId: string): void {
  const timer = travelTimers[entityId];
  if (timer !== undefined) {
    clearInterval(timer);
    travelTimers[entityId] = undefined;
  }
}

/** Steps a door's position until it hits an end stop, mimicking the
 * opening -> open / closing -> closed transitions a real cover reports. */
function startTravel(entityId: string, direction: "open" | "close"): void {
  const door = doors[entityId];
  if (!door) return;
  stopTravel(entityId);
  door.state = direction === "open" ? "opening" : "closing";
  refreshHass();
  travelTimers[entityId] = window.setInterval(() => {
    door.position = Math.max(0, Math.min(100, door.position + (direction === "open" ? 10 : -10)));
    if (door.position >= 100) {
      door.state = "open";
      stopTravel(entityId);
    } else if (door.position <= 0) {
      door.state = "closed";
      stopTravel(entityId);
    }
    refreshHass();
  }, TRAVEL_STEP_MS);
}

function handleCoverService(service: string, entityId: string): void {
  const door = doors[entityId];
  if (!door) return;
  if (service === "open_cover") startTravel(entityId, "open");
  else if (service === "close_cover") startTravel(entityId, "close");
  else if (service === "stop_cover") {
    stopTravel(entityId);
    // A cover halted between the end stops reports "open", not a third
    // "partially open" state — that distinction lives in current_position.
    door.state = door.position <= 0 ? "closed" : "open";
    refreshHass();
  }
}

function refreshHass(): void {
  card.hass = editor.hass = buildMockHass(
    buildFixtureEntities({
      autoOn,
      leftHome,
      rightHome,
      leftDoor: doors["cover.garage_left"],
      rightDoor: doors["cover.garage_right"],
      rightDoorOffline,
    }),
    darkMode,
    (domain, service, data) => {
      console.info(`[callService] ${domain}.${service}`, data);
      log(`${domain}.${service} ${String(data?.entity_id ?? "")}`);
      if (domain === "automation" && service === "turn_on") autoOn = true;
      if (domain === "automation" && service === "turn_off") autoOn = false;
      if (domain === "cover") {
        handleCoverService(service, String(data?.entity_id ?? ""));
        return;
      }
      refreshHass();
    }
  );
}

// Real HA fires a `haptic` event on the companion app; log it here so the
// hold gesture's feedback points are visible in the harness.
card.addEventListener("haptic", (e) => log(`haptic: ${(e as CustomEvent).detail}`));

function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  const toggle = document.getElementById("dark-toggle")!;
  toggle.textContent = darkMode ? "☀ Light mode" : "🌙 Dark mode";
}

applyTheme();
refreshHass();
document.getElementById("app")!.appendChild(card);
document.getElementById("editor-host")!.appendChild(editor);

document.getElementById("toggle-left")!.addEventListener("click", () => {
  leftHome = !leftHome;
  refreshHass();
});
document.getElementById("toggle-right")!.addEventListener("click", () => {
  rightHome = !rightHome;
  refreshHass();
});
document.getElementById("toggle-auto")!.addEventListener("click", () => {
  autoOn = !autoOn;
  refreshHass();
});
document.getElementById("toggle-offline")!.addEventListener("click", () => {
  rightDoorOffline = !rightDoorOffline;
  log(`right door ${rightDoorOffline ? "unavailable" : "back online"}`);
  refreshHass();
});
document.getElementById("dark-toggle")!.addEventListener("click", () => {
  darkMode = !darkMode;
  applyTheme();
  refreshHass();
});

editor.addEventListener("config-changed", (event) => {
  setConfig((event as CustomEvent<{ config: GarageAutoOpenCardConfig }>).detail.config);
  refreshHass();
});

document.getElementById("editor-toggle")!.addEventListener("click", () => {
  const panel = document.getElementById("editor-panel")!;
  const visible = panel.classList.toggle("visible");
  document.getElementById("editor-toggle")!.textContent = visible ? "Hide editor" : "Show editor";
});
