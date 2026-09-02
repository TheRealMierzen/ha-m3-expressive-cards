import { HomeAssistant, IrrigationScheduleCardConfig } from "./types";

const UNKNOWN_STATES = new Set(["unknown", "unavailable"]);

function isUnknown(state: unknown): boolean {
  return state == null || UNKNOWN_STATES.has(String(state).toLowerCase());
}

function isBoolOn(state: unknown): boolean {
  const l = String(state ?? "").toLowerCase();
  return l === "on" || l === "true";
}

/** "HH:MM:SS" (input_datetime time-only state) -> "HH:MM". */
function formatTimeOfDay(state: unknown): string | null {
  if (isUnknown(state)) return null;
  const s = String(state);
  const match = /^(\d{1,2}):(\d{2})/.exec(s);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}` : s;
}

function formatDurationMinutes(state: unknown): string | null {
  if (isUnknown(state)) return null;
  const n = Number(state);
  if (!Number.isFinite(n)) return null;
  if (n >= 60) {
    const h = Math.floor(n / 60);
    const m = Math.round(n % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.round(n)} min`;
}

/** "H:MM:SS" or "HH:MM:SS" -> total seconds. */
function parseHms(hms: string): number | null {
  const match = /^(\d+):(\d{2}):(\d{2})$/.exec(hms.trim());
  if (!match) return null;
  const [, h, m, s] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

export function minutesToHms(minutes: number): string {
  const totalSeconds = Math.max(0, Math.round(minutes * 60));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  let d = Date.now() - t;
  if (d < 0) d = 0;
  const s = Math.floor(d / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const days = Math.floor(h / 24);
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (h > 0) return `${h} hour${h === 1 ? "" : "s"} ago`;
  if (m > 0) return `${m} min${m === 1 ? "" : "s"} ago`;
  return "just now";
}

export interface ComputedIrrigationVals {
  automationEnabled: boolean;
  shouldWater: boolean | null;
  startText: string | null;
  stopText: string | null;
  durationText: string | null;
  durationMinutes: number | null;

  timerActive: boolean;
  timerPaused: boolean;
  timerRemainingSeconds: number | null;
  timerTotalSeconds: number | null;
  timerProgressPercent: number;
  timerCountdownText: string | null;

  valveOn: boolean;
  lastWateredText: string;
}

/** Pure computation from (hass, config, now) -> display values. `now` is
 * passed in (rather than read via Date.now() internally) so the card's own
 * 1s countdown tick can drive re-renders without this needing its own
 * timer/side effects. */
export function computeVals(hass: HomeAssistant, c: IrrigationScheduleCardConfig, now: Date): ComputedIrrigationVals {
  const st = hass.states;
  const get = (id?: string) => (id ? st[id] : undefined);

  const automation = get(c.automation);
  const automationEnabled = !isUnknown(automation?.state) && isBoolOn(automation?.state);

  const shouldWaterEntity = get(c.should_water);
  const shouldWater = isUnknown(shouldWaterEntity?.state) ? null : isBoolOn(shouldWaterEntity?.state);

  const startText = formatTimeOfDay(get(c.start_time)?.state);
  const stopText = formatTimeOfDay(get(c.stop_time)?.state);
  const durationEntity = get(c.duration);
  const durationMinutes = durationEntity && !isUnknown(durationEntity.state) ? Number(durationEntity.state) : null;
  const durationText = formatDurationMinutes(durationEntity?.state);

  const timer = get(c.timer);
  const timerActive = timer?.state === "active";
  const timerPaused = timer?.state === "paused";
  const timerTotalSeconds = timer?.attributes.duration ? parseHms(timer.attributes.duration) : null;
  let timerRemainingSeconds: number | null = null;
  if (timerActive && timer?.attributes.finishes_at) {
    const finishesAt = new Date(timer.attributes.finishes_at).getTime();
    timerRemainingSeconds = Math.max(0, (finishesAt - now.getTime()) / 1000);
  } else if (timerPaused && timer?.attributes.remaining) {
    timerRemainingSeconds = parseHms(timer.attributes.remaining);
  }
  const timerProgressPercent =
    timerRemainingSeconds != null && timerTotalSeconds
      ? Math.min(100, Math.max(0, (timerRemainingSeconds / timerTotalSeconds) * 100))
      : 0;
  const timerCountdownText = timerRemainingSeconds != null ? formatCountdown(timerRemainingSeconds) : null;

  const valve = get(c.valve);
  const valveOn = isBoolOn(valve?.state);
  const lastWateredText = timeAgo(valve?.last_changed);

  return {
    automationEnabled,
    shouldWater,
    startText,
    stopText,
    durationText,
    durationMinutes,
    timerActive,
    timerPaused,
    timerRemainingSeconds,
    timerTotalSeconds,
    timerProgressPercent,
    timerCountdownText,
    valveOn,
    lastWateredText,
  };
}
