import { ActivityHeatmapCardConfig, WeekStart } from "./types";

/** `YYYY-MM-DD` in *local* time — the key every daily value is bucketed by. */
export type DayKey = string;

export const DAY_MS = 86400000;

/** Day-of-week index, matching `Date.prototype.getDay()`. */
const WEEK_START_INDEX: Record<Exclude<WeekStart, "auto">, number> = {
  sunday: 0,
  monday: 1,
  saturday: 6,
};

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Calendar-day arithmetic, not `+ n * 86400000`. Constructing through the
 * local-date constructor is DST-safe: adding one day across a spring-forward
 * boundary is 23 hours, and the ms version would land at 23:00 the previous
 * day and then bucket into the wrong column.
 */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function dayKey(d: Date): DayKey {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Accepts `YYYY-MM-DD` and anything with a leading `YYYY-MM-DD` (an ISO
 * timestamp, which is what a template sensor's attribute usually holds).
 * Parsed as a local date deliberately — `new Date("2026-08-01")` would parse
 * as UTC midnight and shift a day backwards west of Greenwich. */
export function parseDayKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** HA's `locale.first_weekday`, which may also be the pass-through "language". */
export function resolveWeekStart(setting: WeekStart | undefined, localeFirstWeekday?: string): number {
  if (setting && setting !== "auto") return WEEK_START_INDEX[setting];
  const fromLocale = localeFirstWeekday?.toLowerCase();
  if (fromLocale && fromLocale in WEEK_START_INDEX) {
    return WEEK_START_INDEX[fromLocale as Exclude<WeekStart, "auto">];
  }
  return 1;
}

export interface GridRange {
  /** Local midnight of the top-left cell — always a week boundary. */
  start: Date;
  /** Local midnight of the bottom-right cell — always a week boundary. */
  end: Date;
  /** First day the config actually asked for. */
  rangeStart: Date;
  /** Last day the config actually asked for (today, or yesterday). */
  rangeEnd: Date;
  today: Date;
  weekStart: number;
  columns: number;
}

const MAX_DAYS = 730;
const MIN_DAYS = 7;

/**
 * The grid is *always* laid out on whole-week boundaries, and cells outside
 * `[rangeStart, rangeEnd]` are flagged rather than omitted. That keeps the
 * DOM a clean 7-row grid whatever the range, and leaves `align_weeks` as a
 * purely cosmetic choice about whether those padding cells are drawn as
 * empty cells or as blanks.
 */
export function resolveRange(
  config: ActivityHeatmapCardConfig,
  now: Date,
  localeFirstWeekday?: string
): GridRange {
  const today = startOfDay(now);
  const rangeEnd = config.end === "yesterday" ? addDays(today, -1) : today;

  let rangeStart: Date;
  if (config.months !== undefined && config.months > 0) {
    const months = Math.min(Math.floor(config.months), 24);
    rangeStart = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth() - (months - 1), 1);
  } else if (config.weeks !== undefined && config.weeks > 0) {
    const weeks = Math.min(Math.floor(config.weeks), MAX_DAYS / 7);
    rangeStart = addDays(rangeEnd, -(weeks * 7 - 1));
  } else {
    const days = Math.min(Math.max(Math.floor(config.days ?? 365), MIN_DAYS), MAX_DAYS);
    rangeStart = addDays(rangeEnd, -(days - 1));
  }

  const weekStart = resolveWeekStart(config.start_day_of_week, localeFirstWeekday);
  const leading = (rangeStart.getDay() - weekStart + 7) % 7;
  const start = addDays(rangeStart, -leading);
  const trailing = 6 - ((rangeEnd.getDay() - weekStart + 7) % 7);
  const end = addDays(rangeEnd, trailing);

  // Counted by iteration rather than by dividing a ms difference — see addDays.
  let columns = 0;
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 7)) columns += 1;

  return { start, end, rangeStart, rangeEnd, today, weekStart, columns };
}

/* -------------------------------------------------------------- formatting */

function safeFormatter(locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat(locale, options);
  } catch {
    return new Intl.DateTimeFormat(undefined, options);
  }
}

export function monthFormatter(locale?: string): Intl.DateTimeFormat {
  return safeFormatter(locale, { month: "short" });
}

export function weekdayFormatter(locale?: string): Intl.DateTimeFormat {
  return safeFormatter(locale, { weekday: "short" });
}

export function fullDateFormatter(locale?: string): Intl.DateTimeFormat {
  return safeFormatter(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
