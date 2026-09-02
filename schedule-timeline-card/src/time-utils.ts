import { Weekday, WEEKDAYS } from "./types";

export const MINUTES_PER_DAY = 24 * 60;

/** Parses "HH:MM:SS" or "HH:MM" into minutes since midnight. */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * The visible timeline is a window of minutes measured relative to the
 * viewed day's midnight (0). windowStart/windowEnd can go negative or past
 * 1440 when the user has pulled in hours from the day before/after (see
 * the range-extend controls in schedule-timeline-card.ts) — this maps any
 * absolute minute to its position within that window.
 */
export function windowMinutesToPercent(
  minutes: number,
  windowStartMinutes: number,
  windowEndMinutes: number
): number {
  return ((minutes - windowStartMinutes) / (windowEndMinutes - windowStartMinutes)) * 100;
}

export function formatMinutes(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** A block's total duration, independent of how it's clipped/split across
 * the day boundary for display — handles midnight-crossing (to <= from). */
export function blockDurationMinutes(from: string, to: string): number {
  const fromMin = parseTimeToMinutes(from);
  const toMin = parseTimeToMinutes(to);
  return toMin > fromMin ? toMin - fromMin : MINUTES_PER_DAY - fromMin + toMin;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function weekdayFromDate(date: Date): Weekday {
  // JS getDay(): 0 = Sunday ... 6 = Saturday. WEEKDAYS is Monday-first.
  const jsDay = date.getDay();
  const index = (jsDay + 6) % 7;
  return WEEKDAYS[index];
}

/** Steps `offset` calendar days from `day` (negative goes backward), wrapping
 * through the week. offset 0 returns `day` unchanged. */
export function weekdayAtOffset(day: Weekday, offset: number): Weekday {
  const index = WEEKDAYS.indexOf(day);
  const wrapped = (((index + offset) % 7) + 7) % 7;
  return WEEKDAYS[wrapped];
}

export function weekdayLabel(day: Weekday): string {
  return day.charAt(0).toUpperCase() + day.slice(1);
}
