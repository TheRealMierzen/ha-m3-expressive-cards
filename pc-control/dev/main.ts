import { registerMockHaIcon } from "./mock-ha-icon";
import "../src/pc-overview-card";
import type { PcOverviewCardConfig } from "../src/types";
import { buildMockHass } from "./mock-hass";
import { buildFixtureEntities } from "./fixtures";

registerMockHaIcon();

const config: PcOverviewCardConfig = {
  type: "custom:pc-overview-card",
  title: "Desktop PC",
  tracker: "device_tracker.pc",
  power_state: "sensor.pc_power_state",
  switch_wol: "switch.pc_wol",
  btn_reboot: "button.pc_reboot",
  btn_suspend: "button.pc_suspend",
  btn_hibernate: "button.pc_hibernate",
  btn_poweroff: "button.pc_poweroff",
  cpu_total: "sensor.pc_cpu_total",
  load_1m: "sensor.pc_load_1m",
  package_temp: "sensor.pc_package_temp",
  mem_usage_pct: "sensor.pc_mem_usage_pct",
  disk_root_usage_pct: "sensor.pc_disk_root_usage_pct",
  disk_home_usage_pct: "sensor.pc_disk_home_usage_pct",
  disk_boot_usage_pct: "sensor.pc_disk_boot_usage_pct",
  lan_state: "sensor.pc_lan_state",
  lan_ip: "sensor.pc_lan_ip",
  rx_tp: "sensor.pc_rx_tp",
  tx_tp: "sensor.pc_tx_tp",
  power_profile: "sensor.pc_power_profile",
  microphone_in_use: "sensor.pc_microphone_in_use",
  switch_inhibit: "switch.pc_inhibit",
  show_inhibit_pill_only_when_on: true,

  core0_freq: "sensor.pc_core0_freq",
  nvme_read_rate: "sensor.pc_nvme_read_rate",
  nvme_write_rate: "sensor.pc_nvme_write_rate",
  ext_ip: "sensor.pc_ext_ip",
  distro_name: "sensor.pc_distro_name",
  distro_version: "sensor.pc_distro_version",
  kernel: "sensor.pc_kernel",
  uptime: "sensor.pc_uptime",
  last_reboot: "sensor.pc_last_reboot",
  go_hass_agent_version: "sensor.pc_agent_version",

  automation_sleep_schedule: "automation.pc_sleep_schedule",
  automation_idle_shutdown: "automation.pc_idle_shutdown",
  automation_sleep_schedule_time_sensor: "sensor.pc_time_of_day",

  firmware_security: "sensor.pc_firmware_security",
  cpu_vulnerabilities: "binary_sensor.pc_cpu_vulnerabilities",
  smart_nvme: "binary_sensor.pc_smart_nvme",
  smart_sda: "binary_sensor.pc_smart_sda",
  webcam_in_use: "sensor.pc_webcam_in_use",
  sensor_webcam_status: "sensor.pc_webcam_status",
  camera_webcam: "camera.pc_webcam",
  btn_webcam_start: "button.pc_webcam_start",
  btn_webcam_stop: "button.pc_webcam_stop",
};

const card = document.createElement("pc-overview-card") as HTMLElement & {
  setConfig(config: PcOverviewCardConfig): void;
  hass: ReturnType<typeof buildMockHass>;
};
card.setConfig(config);

let poweredOn = true;
let cpuPct = 34;
let memPct = 51;
let tempC = 52;
let micInUse = false;
let inhibitOn = false;
let sleepAutoOn = true;
let idleAutoOn = false;
let webcamActive = false;
let smartBad = false;
let darkMode = true;

function refreshHass(): void {
  card.hass = buildMockHass(
    buildFixtureEntities({
      poweredOn,
      cpuPct,
      memPct,
      tempC,
      micInUse,
      inhibitOn,
      sleepAutoOn,
      idleAutoOn,
      webcamActive,
      smartBad,
    }),
    darkMode,
    (domain, service, data) => {
      const log = document.getElementById("log")!;
      const line = document.createElement("div");
      line.className = "log-line";
      line.textContent = `[${new Date().toLocaleTimeString()}] callService ${domain}.${service} ${JSON.stringify(data ?? {})}`;
      log.prepend(line);

      if (domain === "homeassistant" && service === "toggle") {
        const id = typeof data?.entity_id === "string" ? data.entity_id : "";
        if (id === "automation.pc_sleep_schedule") sleepAutoOn = !sleepAutoOn;
        if (id === "automation.pc_idle_shutdown") idleAutoOn = !idleAutoOn;
        refreshHass();
      }

      if (domain === "switch" && service === "turn_on") {
        // Simulate the PC actually coming on a couple seconds after WoL.
        setTimeout(() => {
          poweredOn = true;
          refreshHass();
        }, 2000);
      }
    }
  );
}

function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
  const toggle = document.getElementById("dark-toggle")!;
  toggle.textContent = darkMode ? "☀ Light mode" : "🌙 Dark mode";
}

applyTheme();
refreshHass();
document.getElementById("app")!.appendChild(card);

window.addEventListener("hass-more-info", (evt) => {
  const detail = (evt as CustomEvent<{ entityId: string }>).detail;
  const log = document.getElementById("log")!;
  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = `[${new Date().toLocaleTimeString()}] would open more-info dialog for ${detail.entityId}`;
  log.prepend(line);
});

document.getElementById("toggle-power")!.addEventListener("click", () => {
  poweredOn = !poweredOn;
  refreshHass();
});
document.getElementById("bump-metrics")!.addEventListener("click", () => {
  cpuPct = Math.round(Math.random() * 100);
  memPct = Math.round(Math.random() * 100);
  tempC = 40 + Math.round(Math.random() * 50);
  refreshHass();
});
document.getElementById("toggle-inhibit")!.addEventListener("click", () => {
  inhibitOn = !inhibitOn;
  refreshHass();
});
document.getElementById("toggle-mic")!.addEventListener("click", () => {
  micInUse = !micInUse;
  refreshHass();
});
document.getElementById("toggle-webcam")!.addEventListener("click", () => {
  webcamActive = !webcamActive;
  refreshHass();
});
document.getElementById("toggle-smart")!.addEventListener("click", () => {
  smartBad = !smartBad;
  refreshHass();
});
document.getElementById("dark-toggle")!.addEventListener("click", () => {
  darkMode = !darkMode;
  applyTheme();
  refreshHass();
});
