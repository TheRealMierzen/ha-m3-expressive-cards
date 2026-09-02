import { GeyserStatusCardConfig, HomeAssistant } from "./types";

const UNKNOWN_STATES = new Set(["unknown", "unavailable"]);

function isUnknown(state: unknown): boolean {
  return state == null || UNKNOWN_STATES.has(String(state).toLowerCase());
}

function isBoolOn(state: unknown): boolean {
  const l = String(state ?? "").toLowerCase();
  return l === "on" || l === "true";
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

function formatTemp(state: unknown): string | null {
  if (isUnknown(state)) return null;
  const n = Number(state);
  return Number.isFinite(n) ? `${n.toFixed(1)}°` : null;
}

function formatMinutes(totalMinutes: number): string {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
  }
  return `${m} min`;
}

/** "H:MM:SS" -> total minutes. */
function parseHmsToMinutes(hms: string): number | null {
  const match = /^(\d+):(\d{2}):(\d{2})$/.exec(hms.trim());
  if (!match) return null;
  const [, h, m, s] = match;
  return Number(h) * 60 + Number(m) + Number(s) / 60;
}

/** Accepts either a plain number (minutes) or an "H:MM:SS" duration —
 * whichever a time-to-heat sensor happens to report. */
function parseTimeToHeatMinutes(state: unknown): number | null {
  if (isUnknown(state)) return null;
  const raw = String(state).trim();
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber)) return asNumber;
  return parseHmsToMinutes(raw);
}

function formatTimeToHeat(state: unknown): string | null {
  const minutes = parseTimeToHeatMinutes(state);
  return minutes != null ? formatMinutes(minutes) : null;
}

/** Clock time the heater is expected to reach target, derived from the
 * time-to-heat sensor's remaining-minutes value + now. Only meaningful
 * while there's actually time left to go. */
function formatReadyBy(state: unknown, now: Date): string | null {
  const minutes = parseTimeToHeatMinutes(state);
  if (minutes == null || minutes <= 0) return null;
  const readyAt = new Date(now.getTime() + minutes * 60_000);
  return readyAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Accepts a full ISO datetime (formats relative to today/tomorrow/weekday)
 * or a bare "HH:MM:SS" time-of-day (formats as "HH:MM"), whichever a
 * next-shower entity happens to report. */
function formatNextShower(state: unknown, now: Date): string | null {
  if (isUnknown(state)) return null;
  const raw = String(state).trim();

  if (/\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayDiff = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000);
      const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (dayDiff === 0) return `Today, ${timeStr}`;
      if (dayDiff === 1) return `Tomorrow, ${timeStr}`;
      return `${d.toLocaleDateString([], { weekday: "short" })}, ${timeStr}`;
    }
  }

  const match = /^(\d{1,2}):(\d{2})/.exec(raw);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : raw;
}

/** Minutes since midnight for a shower-time value, accepting either a full
 * ISO datetime or a bare "HH:MM[:SS]" — the two shapes these entities come
 * in (a datetime sensor vs. a time-only input_datetime). Null when the state
 * isn't a usable time at all.
 *
 * Deliberately time-of-day only: the default shower time is a daily
 * schedule, so "tomorrow 18:00" and "18:00" are the same schedule and must
 * compare equal. Comparing raw states or formatted strings would not work —
 * the two entities routinely disagree on format even when they agree on
 * the time. */
export function timeOfDayMinutes(state: unknown): number | null {
  if (isUnknown(state)) return null;
  const raw = String(state).trim();

  if (/\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.getHours() * 60 + d.getMinutes();
  }

  const match = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatEfficiency(state: unknown): string | null {
  if (isUnknown(state)) return null;
  const n = Number(state);
  return Number.isFinite(n) ? `${Math.round(n)}%` : null;
}

export type HeaterMode = "heating" | "cooling" | null;

export interface ComputedGeyserVals {
  isOn: boolean;

  currentTempText: string | null;
  currentTemp: number | null;
  targetTempText: string | null;
  targetTemp: number | null;
  progressPercent: number;

  timeToHeatText: string | null;
  readyByText: string | null;
  nextShowerText: string | null;
  defaultShowerTimeText: string | null;

  mode: HeaterMode;
  modeLabel: string | null;
  efficiencyText: string | null;

  overrideOn: boolean;
  /** Whether next_shower's time-of-day matches default_shower_time's.
   * Null when either side isn't configured or isn't a readable time, so
   * callers can tell "they differ" apart from "can't tell". */
  nextShowerIsDefault: boolean | null;

  targetStep: number;
}

export function computeVals(hass: HomeAssistant, c: GeyserStatusCardConfig, now: Date): ComputedGeyserVals {
  const st = hass.states;
  const get = (id?: string) => (id ? st[id] : undefined);

  const switchEntity = get(c.switch);
  const isOn = isBoolOn(switchEntity?.state);

  const currentTempState = get(c.current_temp)?.state;
  const targetTempEntity = get(c.target_temp);
  const currentTemp = !isUnknown(currentTempState) ? Number(currentTempState) : null;
  const targetTemp = !isUnknown(targetTempEntity?.state) ? Number(targetTempEntity?.state) : null;
  const progressPercent =
    currentTemp != null && targetTemp != null && targetTemp > 0
      ? clamp((currentTemp / targetTemp) * 100, 0, 100)
      : 0;

  // A single automation drives both states: enabled means heating,
  // disabled means cooling — no separate cooling automation to check.
  const mode: HeaterMode = c.heating_automation ? (isBoolOn(get(c.heating_automation)?.state) ? "heating" : "cooling") : null;
  const modeLabel = mode === "heating" ? "Heating" : mode === "cooling" ? "Cooling" : null;

  const overrideOn = isBoolOn(get(c.shower_override_switch)?.state);

  const nextShowerMinutes = timeOfDayMinutes(get(c.next_shower)?.state);
  const defaultShowerMinutes = timeOfDayMinutes(get(c.default_shower_time)?.state);
  const nextShowerIsDefault =
    nextShowerMinutes != null && defaultShowerMinutes != null ? nextShowerMinutes === defaultShowerMinutes : null;

  const targetStepAttr = targetTempEntity?.attributes.step;
  const targetStep = typeof targetStepAttr === "number" && targetStepAttr > 0 ? targetStepAttr : 1;

  return {
    isOn,
    currentTempText: formatTemp(currentTempState),
    currentTemp,
    targetTempText: formatTemp(targetTempEntity?.state),
    targetTemp,
    progressPercent,
    timeToHeatText: formatTimeToHeat(get(c.time_to_heat)?.state),
    readyByText: formatReadyBy(get(c.time_to_heat)?.state, now),
    nextShowerText: formatNextShower(get(c.next_shower)?.state, now),
    defaultShowerTimeText: formatNextShower(get(c.default_shower_time)?.state, now),
    mode,
    modeLabel,
    efficiencyText: formatEfficiency(get(c.efficiency)?.state),
    overrideOn,
    nextShowerIsDefault,
    targetStep,
  };
}
