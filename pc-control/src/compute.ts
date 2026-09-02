import { HomeAssistant, PcOverviewCardConfig } from "./types";

const UNKNOWN_STATES = new Set(["unknown", "unavailable"]);

export function isUnk(state: unknown): boolean {
  return state == null || UNKNOWN_STATES.has(String(state).toLowerCase());
}

export function isBoolOn(state: unknown): boolean {
  const l = String(state).toLowerCase();
  return l === "on" || l === "true";
}

export function fmt(v: unknown, d = 0): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(d) : "—";
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

export function humanBytes(bytes: unknown): string {
  const n = Number(bytes);
  if (!Number.isFinite(n)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let u = 0;
  let v = Math.abs(n);
  while (v >= 1024 && u < 4) {
    v /= 1024;
    u++;
  }
  return `${n < 0 ? "-" : ""}${v >= 10 || u === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[u]}`;
}

export function humanBps(bps: unknown): string {
  const n = Number(bps);
  return Number.isFinite(n) ? `${humanBytes(n)}/s` : "—";
}

export function toGhz(raw: unknown, unit: string = "auto"): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return "—";
  const hz = unit === "hz" ? n : unit === "khz" ? n * 1e3 : n < 5e7 ? n * 1e3 : n;
  return `${(hz / 1e9).toFixed(2)} GHz`;
}

export function dtLocal(iso: unknown): string {
  if (!iso) return "—";
  const d = new Date(String(iso));
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
}

export function humanUptime(n: number, unit?: string): string {
  if (!Number.isFinite(n)) return "—";
  const secs = Math.round(n * (unit === "hours" ? 3600 : 86400));
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Returns one of the card's shared semantic classes (see card.css.ts) —
 * "good" / "warn" / "bad" — rather than a temperature-specific name, so the
 * temperature tile tints itself through the same three custom properties
 * every other health indicator on the card reads. */
export function tempCls(temp: unknown): string {
  const n = Number(temp);
  if (!Number.isFinite(n)) return "";
  if (n >= 80) return "bad";
  if (n >= 60) return "warn";
  return "good";
}

export function barPctText(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? `${clamp(n, 0, 100).toFixed(1)}%` : "—";
}

export function barPctNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? clamp(n, 0, 100) : 0;
}

export interface ComputedPcVals {
  isOn: boolean;
  powerState: string;
  powerProfile: string | null;
  lanState: string | null;
  latencyText: string | null;

  cpuText: string;
  cpuPct: number;
  loadText: string;
  tempText: string;
  tempCls: string;
  freqText: string;
  memText: string;
  memPct: number;
  rxText: string;
  txText: string;
  nvmeRdText: string;
  nvmeWrText: string;

  showSleep: boolean;
  showIdle: boolean;
  sleepOn: boolean;
  idleOn: boolean;

  rootPctText: string;
  rootPct: number;
  homePctText: string;
  homePct: number;
  bootPctText: string;
  bootPct: number;

  showWebcam: boolean;
  webcamStatus: unknown;
  webcamCamState: unknown;

  distroText: string;
  kernel: string | null;
  agentVersion: string | null;
  uptime: string;
  lastReboot: string | null;
  lanIp: string | null;
  extIp: string | null;
  showInhibit: boolean;

  fwState: unknown;
  fwBad: boolean;
  showFw: boolean;
  cpuVulnBad: boolean;
  showCpuVuln: boolean;
  showMic: boolean;
  showWcam: boolean;
  smartNvmeBad: boolean;
  showSmartNvme: boolean;
  smartSdaBad: boolean;
  showSmartSda: boolean;
}

/** Pure computation from (hass, config) -> display values. No side effects —
 * the WoL-waiting state is tracked as reactive state on the card itself
 * (see pc-overview-card.ts), since that's a stateful UI concern, not a
 * value derived from hass. */
export function computeVals(hass: HomeAssistant, c: PcOverviewCardConfig): ComputedPcVals {
  const st = hass.states;
  const g = (id?: string): string | undefined => (id ? st[id]?.state : undefined);

  const powerState = g(c.power_state);
  const ps = (powerState || "").toLowerCase();
  const isOn = ps === "powered on";

  const powerProfile = g(c.power_profile);
  const latency = g(c.latency);
  const cpu = g(c.cpu_total);
  const load1 = g(c.load_1m);
  const memPct = g(c.mem_usage_pct);
  const rootPct = g(c.disk_root_usage_pct);
  const homePct = g(c.disk_home_usage_pct);
  const bootPct = g(c.disk_boot_usage_pct);
  const rx = g(c.rx_tp);
  const tx = g(c.tx_tp);
  const lanState = g(c.lan_state);
  const lanIp = g(c.lan_ip);
  const extIp = g(c.ext_ip);
  const core0freq = g(c.core0_freq);
  const pkgTemp = g(c.package_temp);
  const distroName = g(c.distro_name);
  const distroVer = g(c.distro_version);
  const kernel = g(c.kernel);
  const lastReboot = g(c.last_reboot);
  const uptimeRaw = g(c.uptime);
  const nvmeRd = g(c.nvme_read_rate);
  const nvmeWr = g(c.nvme_write_rate);
  const smartNvme = g(c.smart_nvme);
  const smartSda = g(c.smart_sda);
  const firmwareSecurity = g(c.firmware_security);
  const cpuVuln = g(c.cpu_vulnerabilities);
  const agentVersion = g(c.go_hass_agent_version);
  const micInUse = g(c.microphone_in_use);
  const webcamInUse = g(c.webcam_in_use);
  const inhibit = g(c.switch_inhibit);
  const webcamStatus = g(c.sensor_webcam_status);
  const webcamCamState = g(c.camera_webcam);

  const timeSensorId =
    typeof c.automation_sleep_schedule_time_sensor === "string" && c.automation_sleep_schedule_time_sensor.trim() !== ""
      ? c.automation_sleep_schedule_time_sensor
      : null;
  const timeAfter = Number(c.automation_sleep_schedule_time_after);
  const timeThreshold = Number.isFinite(timeAfter) ? timeAfter : 19;
  let currentTimeDecimal = NaN;
  if (timeSensorId) {
    const raw = String(g(timeSensorId) ?? "").trim();
    if (raw !== "") {
      const n = Number(raw);
      if (Number.isFinite(n)) {
        currentTimeDecimal = n;
      } else if (/^\d{1,2}[.:]\d{2}$/.test(raw)) {
        const [h, m] = raw.split(/[.:]/).map(Number);
        if (Number.isFinite(h) && Number.isFinite(m)) currentTimeDecimal = h + m / 60;
      }
    }
  }
  const timeOk = !timeSensorId || (Number.isFinite(currentTimeDecimal) && currentTimeDecimal >= timeThreshold);

  const sleepShowIfId =
    typeof c.automation_sleep_schedule_show_if === "string" && c.automation_sleep_schedule_show_if.trim() !== ""
      ? c.automation_sleep_schedule_show_if
      : null;
  const sleepShowIfState = sleepShowIfId ? g(sleepShowIfId) : undefined;
  const sleepShowIfOk = !sleepShowIfId || isBoolOn(sleepShowIfState || "");
  const showSleep = Boolean(c.automation_sleep_schedule && timeOk && sleepShowIfOk);

  const idleShowIfId =
    typeof c.automation_idle_shutdown_show_if === "string" && c.automation_idle_shutdown_show_if.trim() !== ""
      ? c.automation_idle_shutdown_show_if
      : null;
  const idleShowIfState = idleShowIfId ? g(idleShowIfId) : undefined;
  const idleShowIfOk = !idleShowIfId || isBoolOn(idleShowIfState || "");
  const rxNum = Number(rx);
  const txNum = Number(tx);
  const busyThreshold = Number(c.idle_shutdown_network_busy_threshold) || 1048576;
  const netBusy =
    c.show_idle_shutdown_when_network_busy !== false &&
    ((Number.isFinite(rxNum) && rxNum >= busyThreshold) || (Number.isFinite(txNum) && txNum >= busyThreshold));
  const showIdle = Boolean(c.automation_idle_shutdown && (idleShowIfOk || netBusy));

  const automationSleepOn = String(g(c.automation_sleep_schedule) || "").toLowerCase() === "on";
  const automationIdleOn = String(g(c.automation_idle_shutdown) || "").toLowerCase() === "on";

  const showInhibit =
    Boolean(c.switch_inhibit && st[c.switch_inhibit]) &&
    (!c.show_inhibit_pill_only_when_on || String(inhibit).toLowerCase() === "on");

  const webcamAutoShow =
    (!isUnk(webcamStatus) && String(webcamStatus).toLowerCase() !== "none") ||
    (!isUnk(webcamCamState) && String(webcamCamState).toLowerCase() !== "idle");
  const showWebcam = c.show_webcam_section === "auto" ? webcamAutoShow : Boolean(c.show_webcam_section);

  const smartBad = (state: unknown): boolean => {
    if (isUnk(state)) return false;
    const on = isBoolOn(state);
    return c.smart_on_is_bad !== false ? on : !on;
  };

  const fwStr = isUnk(firmwareSecurity) ? "" : String(firmwareSecurity).trim();
  const fwBad = fwStr !== "" && /HSI:0|!/.test(fwStr) && !/HSI:1\b/.test(fwStr);

  return {
    isOn,
    powerState: powerState ?? "—",
    powerProfile: !isUnk(powerProfile) ? powerProfile! : null,
    lanState: isOn && !isUnk(lanState) ? lanState! : null,
    latencyText: isOn && !isUnk(latency) ? `${fmt(latency, 0)} ms` : null,

    cpuText: isUnk(cpu) ? "—" : `${fmt(cpu, 0)}%`,
    cpuPct: Number(cpu) || 0,
    loadText: isUnk(load1) ? "—" : fmt(load1, 2),
    tempText: isUnk(pkgTemp) ? "—" : `${fmt(pkgTemp, 0)}°C`,
    tempCls: tempCls(pkgTemp),
    freqText: isUnk(core0freq) ? "—" : toGhz(core0freq, c.core_freq_unit),
    memText: isUnk(memPct) ? "—" : `${fmt(memPct, 0)}%`,
    memPct: Number(memPct) || 0,
    rxText: isUnk(rx) ? "—" : humanBps(rx),
    txText: isUnk(tx) ? "—" : humanBps(tx),
    nvmeRdText: isUnk(nvmeRd) ? "—" : humanBps(nvmeRd),
    nvmeWrText: isUnk(nvmeWr) ? "—" : humanBps(nvmeWr),

    showSleep,
    showIdle,
    sleepOn: automationSleepOn,
    idleOn: automationIdleOn,

    rootPctText: barPctText(rootPct),
    rootPct: barPctNum(rootPct),
    homePctText: barPctText(homePct),
    homePct: barPctNum(homePct),
    bootPctText: barPctText(bootPct),
    bootPct: barPctNum(bootPct),

    showWebcam,
    webcamStatus,
    webcamCamState,

    distroText: `${distroName || "—"} ${distroVer || ""}`.trim(),
    kernel: !isUnk(kernel) ? kernel! : null,
    agentVersion: !isUnk(agentVersion) ? agentVersion! : null,
    uptime: humanUptime(Number(uptimeRaw), c.uptime_unit || "days"),
    lastReboot: lastReboot ? dtLocal(lastReboot) : null,
    lanIp: !isUnk(lanIp) ? lanIp! : null,
    extIp: c.show_external_ip && !isUnk(extIp) ? extIp! : null,
    showInhibit,

    fwState: firmwareSecurity,
    fwBad,
    showFw: !isUnk(firmwareSecurity),
    cpuVulnBad: smartBad(cpuVuln),
    showCpuVuln: !isUnk(cpuVuln),
    showMic: !isUnk(micInUse) && isBoolOn(micInUse),
    showWcam: !isUnk(webcamInUse) && isBoolOn(webcamInUse),
    smartNvmeBad: smartBad(smartNvme),
    showSmartNvme: !isUnk(smartNvme),
    smartSdaBad: smartBad(smartSda),
    showSmartSda: !isUnk(smartSda),
  };
}
