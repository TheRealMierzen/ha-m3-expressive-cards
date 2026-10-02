import {
  HomeAssistant,
  PcBuiltinTile,
  PcEntityTileConfig,
  PcOverviewCardConfig,
  PcTileConfig,
  PcTileOptions,
} from "./types";

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

/* ------------------------------------------------------------------- tiles */

export interface BuiltinTileInfo {
  label: string;
  icon: string;
  /** The config key holding the entity this tile reads. */
  key: keyof PcOverviewCardConfig;
  /** Options this tile has unless its config says otherwise. */
  defaults: PcTileOptions;
  /** NVMe shows two readings at once, so a single bar or threshold has
   * nothing to measure; its graph draws both. */
  dual?: { key: keyof PcOverviewCardConfig };
}

export const BUILTIN_TILES: Record<PcBuiltinTile, BuiltinTileInfo> = {
  cpu: { label: "CPU", icon: "mdi:cpu-64-bit", key: "cpu_total", defaults: { bar: true } },
  load: { label: "Load 1m", icon: "mdi:chart-line", key: "load_1m", defaults: {} },
  temp: { label: "Temp", icon: "mdi:thermometer", key: "package_temp", defaults: { warn_at: 60, bad_at: 80 } },
  freq: { label: "Core 0", icon: "mdi:sine-wave", key: "core0_freq", defaults: {} },
  ram: { label: "RAM", icon: "mdi:memory", key: "mem_usage_pct", defaults: { bar: true } },
  download: { label: "Download", icon: "mdi:download", key: "rx_tp", defaults: {} },
  upload: { label: "Upload", icon: "mdi:upload", key: "tx_tp", defaults: {} },
  nvme: {
    label: "NVMe I/O",
    icon: "mdi:harddisk",
    key: "nvme_read_rate",
    defaults: {},
    dual: { key: "nvme_write_rate" },
  },
};

/** The grid as it was before it was configurable, and still is by default. */
export const DEFAULT_TILES: PcBuiltinTile[] = ["cpu", "load", "temp", "freq", "ram", "download", "upload", "nvme"];

/** Defaults shared by every tile. */
export const TILE_DEFAULTS = { min: 0, max: 100, hours: 24, span: 1 } as const;
export const DEFAULT_COLUMNS = 4;
export const MAX_COLUMNS = 6;
export const MAX_SPAN = 4;

export function isBuiltinTile(tile: unknown): tile is PcBuiltinTile {
  return typeof tile === "string" && tile in BUILTIN_TILES;
}

/** One shape for every way a tile can be written. */
export type NormalTile =
  | { kind: "builtin"; tile: PcBuiltinTile; opts: PcTileOptions }
  | { kind: "entity"; opts: PcEntityTileConfig };

export function normaliseTile(t: PcTileConfig): NormalTile | null {
  if (isBuiltinTile(t)) return { kind: "builtin", tile: t, opts: {} };
  if (typeof t !== "object" || t === null) return null;
  if ("tile" in t) {
    if (!isBuiltinTile(t.tile)) return null;
    const { tile, ...opts } = t;
    return { kind: "builtin", tile, opts };
  }
  if ("entity" in t && typeof t.entity === "string") return { kind: "entity", opts: t };
  return null;
}

/** The tiles to draw, in order. An entity tile still waiting for its entity
 * (the editor adds them blank) is skipped rather than drawn as a dash. */
export function resolveTiles(c: PcOverviewCardConfig): NormalTile[] {
  return (c.tiles ?? DEFAULT_TILES)
    .map(normaliseTile)
    .filter((t): t is NormalTile => t !== null && (t.kind === "builtin" || Boolean(t.opts.entity)));
}

/** A tile's options with its own defaults filled in. */
export function effectiveOptions(t: NormalTile): PcTileOptions {
  return t.kind === "builtin" ? { ...BUILTIN_TILES[t.tile].defaults, ...t.opts } : t.opts;
}

/** The entities a tile reads, first one being the one it opens on tap. */
export function tileEntities(c: PcOverviewCardConfig, t: NormalTile): string[] {
  if (t.kind === "entity") return [t.opts.entity];
  const info = BUILTIN_TILES[t.tile];
  return [info.key, info.dual?.key]
    .map((key) => (key ? c[key] : undefined))
    .filter((id): id is string => typeof id === "string" && id !== "");
}

/** Throws on a tile the card can't draw, so a typo in YAML shows HA's error
 * card instead of a tile silently going missing. */
export function validateTiles(tiles: unknown): void {
  if (tiles === undefined) return;
  if (!Array.isArray(tiles)) throw new Error("tiles must be a list");
  const names = DEFAULT_TILES.join(", ");
  for (const t of tiles) {
    if (typeof t === "string" && !isBuiltinTile(t)) {
      throw new Error(`Unknown tile "${t}". Built-in tiles are: ${names}.`);
    }
    if (typeof t === "object" && t !== null && "tile" in t && !isBuiltinTile((t as { tile: unknown }).tile)) {
      throw new Error(`Unknown tile "${String((t as { tile: unknown }).tile)}". Built-in tiles are: ${names}.`);
    }
    if (normaliseTile(t as PcTileConfig) === null) {
      throw new Error("Each tile is a built-in name, an object with a tile, or an object with an entity.");
    }
  }
}

export interface TileGraph {
  /** One series per entity; NVMe has two. */
  ids: string[];
  hours: number;
  /** Fixed scale, when the tile has one; otherwise the graph fits its data. */
  min?: number;
  max?: number;
}

export interface TileView {
  label: string;
  icon: string;
  /** Opened on tap; undefined leaves the tile inert. */
  entityId?: string;
  value: string;
  /** NVMe's read and write, in place of a single value. */
  rows?: Array<[string, string]>;
  /** Bar fill, 0–100, or null when the tile has no bar. */
  pct: number | null;
  semCls: string;
  graph: TileGraph | null;
  span: number;
}

/** A unit glued to its number ("43%", "61°C") or spaced from it ("3.2 GB"),
 * the way the built-in tiles already write them. */
function withUnit(num: string, unit: string): string {
  if (!unit) return num;
  return unit === "%" || unit.startsWith("°") ? `${num}${unit}` : `${num} ${unit}`;
}

function autoDecimals(n: number): number {
  return Number.isInteger(n) || Math.abs(n) >= 100 ? 0 : 1;
}

function finite(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** The grid's column cap, from config, within the range the CSS knows. */
export function gridColumns(c: PcOverviewCardConfig): number | null {
  const n = Math.round(Number(c.tile_columns));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_COLUMNS) : null;
}

const BUILTIN_TEXT: Record<Exclude<PcBuiltinTile, "nvme">, keyof ComputedPcVals> = {
  cpu: "cpuText",
  load: "loadText",
  temp: "tempText",
  freq: "freqText",
  ram: "memText",
  download: "rxText",
  upload: "txText",
};

/** HA's own default icons for the sensor device classes a PC is likely to
 * report — what the entity would show elsewhere in HA without an icon set. */
const DEVICE_CLASS_ICONS: Record<string, string> = {
  temperature: "mdi:thermometer",
  humidity: "mdi:water-percent",
  power: "mdi:flash",
  energy: "mdi:lightning-bolt",
  voltage: "mdi:sine-wave",
  current: "mdi:current-ac",
  frequency: "mdi:sine-wave",
  power_factor: "mdi:angle-acute",
  battery: "mdi:battery",
  data_rate: "mdi:transmission-tower",
  data_size: "mdi:database",
  duration: "mdi:progress-clock",
  timestamp: "mdi:clock-outline",
  pressure: "mdi:gauge",
  speed: "mdi:speedometer",
  signal_strength: "mdi:wifi",
  illuminance: "mdi:brightness-5",
  sound_pressure: "mdi:ear-hearing",
  carbon_dioxide: "mdi:molecule-co2",
  pm25: "mdi:blur",
};

/** For sensors with no device class, where the unit alone says enough. */
const UNIT_ICONS: Record<string, string> = {
  "%": "mdi:percent-outline",
  rpm: "mdi:fan",
  W: "mdi:flash",
  "°C": "mdi:thermometer",
  "°F": "mdi:thermometer",
};

/** Bytes per one of each unit HA's data_rate and data_size classes use. */
const BYTE_UNITS: Record<string, number> = {
  B: 1,
  kB: 1e3,
  KB: 1e3,
  MB: 1e6,
  GB: 1e9,
  TB: 1e12,
  KiB: 1024,
  MiB: 1024 ** 2,
  GiB: 1024 ** 3,
  TiB: 1024 ** 4,
};
const BIT_UNITS: Record<string, number> = { bit: 1, kbit: 1e3, Mbit: 1e6, Gbit: 1e9 };

function humanBits(bps: number): string {
  const units = ["bit/s", "kbit/s", "Mbit/s", "Gbit/s"];
  let u = 0;
  let v = Math.abs(bps);
  while (v >= 1000 && u < units.length - 1) {
    v /= 1000;
    u++;
  }
  return `${v >= 10 || u === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[u]}`;
}

/** A size or rate in whatever unit the sensor picked, rescaled to whatever
 * reads best — 0.0123 GB/s is 12 MB/s — the way the built-in network tiles
 * already do it. Null for any other unit. */
function scaledBytes(n: number, unit: string): string | null {
  const rate = unit.endsWith("/s");
  const base = rate ? unit.slice(0, -2) : unit;
  if (base in BYTE_UNITS) return (rate ? humanBps : humanBytes)(n * BYTE_UNITS[base]);
  if (rate && base in BIT_UNITS) return humanBits(n * BIT_UNITS[base]);
  return null;
}

export interface InferredOptions {
  icon?: string;
  /** A percentage already has a 0–100 scale, so it gets a bar unless told
   * otherwise. */
  bar?: boolean;
}

/** What an entity tile takes from its entity when its config doesn't say. */
export function inferOptions(hass: HomeAssistant | undefined, t: NormalTile): InferredOptions {
  if (t.kind !== "entity" || !t.opts.entity) return {};
  const entity = hass?.states[t.opts.entity];
  const attrs = entity?.attributes ?? {};
  const unit = t.opts.unit ?? (attrs.unit_of_measurement as string | undefined) ?? "";
  const deviceClass = attrs.device_class as string | undefined;
  return {
    icon:
      (attrs.icon as string | undefined) ||
      (deviceClass ? DEVICE_CLASS_ICONS[deviceClass] : undefined) ||
      UNIT_ICONS[unit],
    bar: unit === "%" && toFiniteNumber(entity?.state) !== null ? true : undefined,
  };
}

function toFiniteNumber(state: unknown): number | null {
  if (isUnk(state) || state === "") return null;
  const n = Number(state);
  return Number.isFinite(n) ? n : null;
}

/** Everything the card needs to draw one tile. */
export function tileView(hass: HomeAssistant, c: PcOverviewCardConfig, v: ComputedPcVals, t: NormalTile): TileView {
  const inferred = inferOptions(hass, t);
  const o = { ...(inferred.bar ? { bar: true } : {}), ...effectiveOptions(t) };
  const ids = tileEntities(c, t);
  const entity = ids[0] ? hass.states[ids[0]] : undefined;
  const state = entity?.state;
  const n = Number(state);
  const numeric = !isUnk(state) && state !== "" && Number.isFinite(n);
  const dual = t.kind === "builtin" && Boolean(BUILTIN_TILES[t.tile].dual);

  let label: string;
  let icon: string;
  let value: string;
  let rows: Array<[string, string]> | undefined;
  if (t.kind === "builtin") {
    const info = BUILTIN_TILES[t.tile];
    label = o.name || info.label;
    icon = o.icon || info.icon;
    if (t.tile === "nvme") {
      value = `read ${v.nvmeRdText}, write ${v.nvmeWrText}`;
      rows = [
        ["R", v.nvmeRdText],
        ["W", v.nvmeWrText],
      ];
    } else {
      value = String(v[BUILTIN_TEXT[t.tile]]);
    }
  } else {
    const tile = t.opts;
    label = tile.name || entity?.attributes.friendly_name || tile.entity;
    icon = tile.icon || inferred.icon || "mdi:gauge";
    const unit = tile.unit ?? (entity?.attributes.unit_of_measurement as string | undefined) ?? "";
    // Explicit decimals mean "print the number as the sensor reports it".
    const scaled = numeric && tile.decimals === undefined ? scaledBytes(n, unit) : null;
    if (isUnk(state)) value = "—";
    else if (!numeric) value = state!;
    else if (scaled !== null) value = scaled;
    else value = withUnit(n.toFixed(tile.decimals ?? autoDecimals(n)), unit);
  }

  const min = finite(o.min) ? o.min : TILE_DEFAULTS.min;
  const max = finite(o.max) ? o.max : TILE_DEFAULTS.max;
  let pct: number | null = null;
  if (o.bar && !dual) pct = numeric && max > min ? clamp(((n - min) / (max - min)) * 100, 0, 100) : 0;

  let semCls = "";
  if (!dual && numeric && (finite(o.warn_at) || finite(o.bad_at))) {
    if (finite(o.bad_at) && n >= o.bad_at) semCls = "bad";
    else if (finite(o.warn_at) && n >= o.warn_at) semCls = "warn";
    else semCls = "good";
  }

  let graph: TileGraph | null = null;
  if (o.graph && ids.length > 0) {
    const hours = finite(o.hours) && o.hours > 0 ? o.hours : TILE_DEFAULTS.hours;
    // A tile with a bar already has a scale, and the graph should agree with
    // it: 30% CPU is a low line, not one stretched to fill the box.
    const scaled = o.bar && !dual;
    graph = {
      ids,
      hours,
      min: finite(o.min) ? o.min : scaled ? min : undefined,
      max: finite(o.max) ? o.max : scaled ? max : undefined,
    };
  }

  const columns = gridColumns(c) ?? MAX_SPAN;
  const span = clamp(Math.round(finite(o.span) ? o.span : 1), 1, Math.min(MAX_SPAN, columns));

  return { label, icon, entityId: ids[0], value, rows, pct, semCls, graph, span };
}
