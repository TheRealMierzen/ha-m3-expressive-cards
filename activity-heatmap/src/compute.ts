import {
  addDays,
  DayKey,
  dayKey,
  fullDateFormatter,
  parseDayKey,
  GridRange,
  monthFormatter,
  resolveRange,
  weekdayFormatter,
} from "./dates";
import { clampLevels, levelColors, stateColor } from "./palette";
import { ActivityHeatmapCardConfig, ScaleKind, StateSlice, StatKind } from "./types";

export const ROWS = 7;

export interface HeatCell {
  key: DayKey;
  date: Date;
  column: number;
  row: number;
  /** null means the recorder had nothing for that day, which is not the same
   * fact as a recorded zero — the tooltip says so, the colour can't. */
  value: number | null;
  level: number;
  /** False for the week-alignment padding at either end of the grid. */
  inRange: boolean;
  future: boolean;
  today: boolean;
}

export interface MonthLabel {
  column: number;
  label: string;
}

export interface HeatStat {
  kind: StatKind;
  label: string;
  value: string;
  /** Second line, e.g. the date the best day fell on. */
  detail?: string;
}

export interface HeatGrid {
  range: GridRange;
  columns: number;
  /** Row-major, `ROWS * columns` long: index = row * columns + column. */
  cells: HeatCell[];
  monthLabels: MonthLabel[];
  /** Seven entries; null where the label is suppressed. */
  weekdayLabels: (string | null)[];
  levels: number;
  colors: string[];
  thresholds: number[];
  /** Top of the colour scale actually used. */
  scaleMax: number;
  stats: HeatStat[];
  /** Suffix used in tooltips and stats; resolved from config or the entity. */
  unit: string;
  total: number;
  activeDays: number;
  rangeDays: number;
  hasData: boolean;
}

const DEFAULT_STATS: StatKind[] = ["total", "streak", "longest"];

const STAT_LABELS: Record<StatKind, string> = {
  total: "Total",
  average: "Daily avg",
  active: "Active days",
  rate: "Consistency",
  streak: "Current streak",
  longest: "Longest streak",
  best: "Best day",
};

/* ------------------------------------------------------------- value format */

/** Units that read wrong with a space in front of them. */
const TIGHT_UNITS = new Set(["%", "°", "°c", "°f", "x", "×"]);

/**
 * "1 visits" is the kind of small wrongness that makes a card feel unfinished,
 * and a heatmap tooltip shows a value of exactly one more than any other. A
 * word-shaped unit ending in a single "s" loses it for that one value —
 * `visits` → `visit`, `days` → `day`, `lbs` → `lb`. Symbol units (%, °C, kWh,
 * ms) don't match the pattern and are left alone.
 */
function unitFor(value: number, unit: string): string {
  if (unit === "" || value !== 1) return unit;
  if (!/^[A-Za-z]{3,}$/.test(unit)) return unit;
  if (!unit.endsWith("s") || unit.endsWith("ss")) return unit;
  return unit.slice(0, -1);
}

export function formatValue(
  value: number | null,
  unit: string,
  decimals: number | undefined
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const places =
    decimals !== undefined
      ? Math.min(Math.max(Math.round(decimals), 0), 3)
      : Number.isInteger(value)
        ? 0
        : Math.abs(value) < 10
          ? 1
          : 0;
  const text = value.toLocaleString(undefined, {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  });
  if (!unit) return text;
  const suffix = unitFor(value, unit);
  return TIGHT_UNITS.has(unit.toLowerCase()) ? `${text}${suffix}` : `${text} ${suffix}`;
}

/* ----------------------------------------------------------------- levelling */

/** Shapes where the auto thresholds land between `min` and `max`. */
function shape(fraction: number, scale: ScaleKind): number {
  if (scale === "sqrt") return fraction * fraction;
  if (scale === "log") {
    const k = 3;
    return (Math.exp(k * fraction) - 1) / (Math.exp(k) - 1);
  }
  return fraction;
}

/**
 * Lower bound for each level, ascending, `levels` entries long.
 *
 * `low` is the smallest value actually present above the floor and `high` the
 * top of the scale, and the ramp is stretched between them: the quietest
 * active day gets level 1, the busiest gets the top level, and everything
 * else lands in between. Anchoring on the observed low matters more than it
 * looks — with visit counts of 1-3 and four shades, spacing the bounds evenly
 * from zero instead puts a one-visit day on the *second* shade and leaves the
 * first one permanently unused, so the palette silently loses a step.
 */
export function autoThresholds(
  low: number,
  high: number,
  levels: number,
  scale: ScaleKind
): number[] {
  if (levels <= 1) return [low];
  const span = Math.max(0, high - low);
  const out = [low];
  for (let i = 1; i < levels; i += 1) {
    // The last bound is pinned rather than computed: `low + span * 1` can land
    // an ulp above `high`, which would keep the busiest day off the top shade.
    out.push(i === levels - 1 ? high : low + span * shape(i / (levels - 1), scale));
  }
  return out;
}

export function levelFor(value: number | null, thresholds: number[]): number {
  if (value === null || !Number.isFinite(value)) return 0;
  let level = 0;
  for (let i = 0; i < thresholds.length; i += 1) {
    if (value >= thresholds[i]) level = i + 1;
    else break;
  }
  return level;
}

/* --------------------------------------------------------------- month/rows */

function buildMonthLabels(range: GridRange, locale: string | undefined): MonthLabel[] {
  const format = monthFormatter(locale);
  const groups: Array<{ start: number; length: number; label: string }> = [];
  for (let column = 0; column < range.columns; column += 1) {
    const first = addDays(range.start, column * 7);
    const label = format.format(first);
    const previous = groups[groups.length - 1];
    if (previous && previous.label === label) previous.length += 1;
    else groups.push({ start: column, length: 1, label });
  }
  // A single-column group has no room for a three-character label without
  // colliding with the next one, so it goes unlabelled — the same trade-off
  // GitHub's graph makes at the leading edge of the range.
  return groups.filter((g) => g.length >= 2).map((g) => ({ column: g.start, label: g.label }));
}

function buildWeekdayLabels(
  range: GridRange,
  mode: ActivityHeatmapCardConfig["weekday_labels"],
  locale: string | undefined
): (string | null)[] {
  if (mode === "none") return [null, null, null, null, null, null, null];
  const format = weekdayFormatter(locale);
  // Any date whose day-of-week matches the row; the week of `range.start` is
  // guaranteed to line up because the grid always starts on a week boundary.
  return Array.from({ length: ROWS }, (_, row) => {
    if (mode !== "all" && row % 2 === 0) return null;
    return format.format(addDays(range.start, row));
  });
}

/* -------------------------------------------------------------------- stats */

interface StreakInfo {
  current: number;
  longest: number;
}

/**
 * A day counts toward a streak when it has a value at or above the first
 * threshold — the same test that decides whether a cell is coloured at all,
 * so the streak can never disagree with what the grid shows.
 *
 * The current streak is measured back from the last in-range day, but if that
 * day is *today* and today is blank, it's measured from yesterday instead.
 * Without that grace a five-week streak would read as zero every morning
 * until the day's activity was logged.
 */
function computeStreaks(
  range: GridRange,
  active: (key: DayKey) => boolean
): StreakInfo {
  let longest = 0;
  let run = 0;
  for (let cursor = range.rangeStart; cursor <= range.rangeEnd; cursor = addDays(cursor, 1)) {
    if (active(dayKey(cursor))) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  let tail = range.rangeEnd;
  if (!active(dayKey(tail)) && dayKey(tail) === dayKey(range.today)) tail = addDays(tail, -1);
  let current = 0;
  for (let cursor = tail; cursor >= range.rangeStart; cursor = addDays(cursor, -1)) {
    if (!active(dayKey(cursor))) break;
    current += 1;
  }

  return { current, longest };
}

function resolveStatKinds(config: ActivityHeatmapCardConfig): StatKind[] {
  if (config.stats === false) return [];
  if (config.stats === undefined || config.stats === true) return DEFAULT_STATS;
  if (!Array.isArray(config.stats)) return DEFAULT_STATS;
  return config.stats.filter((kind): kind is StatKind => kind in STAT_LABELS);
}

/* ------------------------------------------------------------------- public */

export interface BuildGridInput {
  config: ActivityHeatmapCardConfig;
  values: Map<DayKey, number>;
  now: Date;
  darkMode: boolean;
  locale?: string;
  firstWeekday?: string;
  /** Falls back to the entity's own unit; see the card's `_unit` getter. */
  unit?: string;
}

/**
 * Pure: no DOM, no service calls, no clock reads — `now` comes in as an
 * argument so the whole grid is reproducible in a test or the dev harness.
 */
export function buildGrid(input: BuildGridInput): HeatGrid {
  const { config, values, now, darkMode, locale } = input;
  const range = resolveRange(config, now, input.firstWeekday);
  const levels = clampLevels(config.levels);
  const colors = levelColors(config.palette, config.color, levels, darkMode);
  const unit = input.unit ?? config.unit ?? "";
  const factor = Number.isFinite(config.factor) ? (config.factor as number) : 1;

  // Only in-range days feed the scale: the week-alignment padding can reach
  // into a period the user didn't ask about, and one stray spike there would
  // rescale every colour on the card.
  const inRangeValues: number[] = [];
  for (let cursor = range.rangeStart; cursor <= range.rangeEnd; cursor = addDays(cursor, 1)) {
    const raw = values.get(dayKey(cursor));
    if (raw !== undefined && Number.isFinite(raw)) inRangeValues.push(raw * factor);
  }

  const min = Number.isFinite(config.min) ? (config.min as number) : 0;
  const active = inRangeValues.filter((value) => value > min);
  // With no data at all, "just above the floor" still has to be a real number
  // so that a later non-zero value would colour in rather than compare against
  // NaN.
  const lowest =
    active.length > 0 ? Math.min(...active) : min + Math.max(Math.abs(min), 1) * 1e-9;
  const observedMax = active.length > 0 ? Math.max(...active) : lowest;
  const scaleMax = Number.isFinite(config.max) ? (config.max as number) : observedMax;
  const explicit = Array.isArray(config.thresholds)
    ? config.thresholds.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
    : [];
  const thresholds =
    explicit.length > 0
      ? explicit.slice(0, levels)
      : autoThresholds(lowest, Math.max(scaleMax, lowest), levels, config.scale ?? "linear");

  const todayKey = dayKey(range.today);
  const cells: HeatCell[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < range.columns; column += 1) {
      const date = addDays(range.start, column * 7 + row);
      const key = dayKey(date);
      const inRange = date >= range.rangeStart && date <= range.rangeEnd;
      const raw = inRange ? values.get(key) : undefined;
      const value = raw === undefined || !Number.isFinite(raw) ? null : raw * factor;
      cells.push({
        key,
        date,
        column,
        row,
        value,
        level: inRange ? levelFor(value, thresholds) : 0,
        inRange,
        future: date > range.today,
        today: key === todayKey,
      });
    }
  }

  const activeTest = (key: DayKey): boolean => {
    const raw = values.get(key);
    if (raw === undefined || !Number.isFinite(raw)) return false;
    return raw * factor >= thresholds[0];
  };

  let total = 0;
  let activeDays = 0;
  let rangeDays = 0;
  let elapsedDays = 0;
  let best: { value: number; date: Date } | null = null;
  for (let cursor = range.rangeStart; cursor <= range.rangeEnd; cursor = addDays(cursor, 1)) {
    rangeDays += 1;
    if (cursor <= range.today) elapsedDays += 1;
    const raw = values.get(dayKey(cursor));
    if (raw === undefined || !Number.isFinite(raw)) continue;
    const value = raw * factor;
    total += value;
    if (value >= thresholds[0]) activeDays += 1;
    if (!best || value > best.value) best = { value, date: cursor };
  }

  const streaks = computeStreaks(range, activeTest);
  const dateFormat = fullDateFormatter(locale);
  const decimals = config.decimals;

  const stats: HeatStat[] = resolveStatKinds(config).map((kind) => {
    const label = STAT_LABELS[kind];
    switch (kind) {
      case "total":
        return { kind, label, value: formatValue(total, unit, decimals) };
      case "average":
        return {
          kind,
          label,
          value: formatValue(elapsedDays > 0 ? total / elapsedDays : null, unit, decimals ?? 1),
        };
      case "active":
        return { kind, label, value: `${activeDays}`, detail: `of ${rangeDays}` };
      case "rate":
        return {
          kind,
          label,
          value: rangeDays > 0 ? `${Math.round((activeDays / rangeDays) * 100)}%` : "—",
        };
      case "streak":
        return { kind, label, value: `${streaks.current}`, detail: streaks.current === 1 ? "day" : "days" };
      case "longest":
        return { kind, label, value: `${streaks.longest}`, detail: streaks.longest === 1 ? "day" : "days" };
      case "best":
      default:
        return {
          kind,
          label,
          value: formatValue(best?.value ?? null, unit, decimals),
          detail: best ? dateFormat.format(best.date) : undefined,
        };
    }
  });

  return {
    range,
    columns: range.columns,
    cells,
    monthLabels: config.month_labels === false ? [] : buildMonthLabels(range, locale),
    weekdayLabels: buildWeekdayLabels(range, config.weekday_labels ?? "auto", locale),
    levels,
    colors,
    thresholds,
    scaleMax,
    stats,
    unit,
    total,
    activeDays,
    rangeDays,
    hasData: inRangeValues.length > 0,
  };
}

/**
 * Every entity the card reads, deduplicated: `entity` first, then whatever
 * `entities` adds. Additive rather than either/or, so filling in the second
 * field in the editor can't silently orphan the first one.
 */
export function cardEntities(config: ActivityHeatmapCardConfig): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [config.entity, ...(config.entities ?? [])]) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (id === "" || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * A change signature over only the entities this card reads, so unrelated
 * `hass` updates elsewhere in HA don't trigger a re-render. The attribute
 * source has its data *in* the attributes, so those are folded in too —
 * without that, a template sensor recomputing its history map would leave
 * the card showing the old grid.
 */
export function entitySignature(
  hass: { states: Record<string, { state: string; attributes: Record<string, unknown> }> },
  config: ActivityHeatmapCardConfig
): string {
  return cardEntities(config)
    .map((id) => {
      const entity = hass.states[id];
      if (!entity) return `${id}:_`;
      if (!config.attribute) return `${id}:${entity.state}`;
      const raw = entity.attributes[config.attribute];
      return `${id}:${entity.state}:${raw === undefined ? "_" : JSON.stringify(raw)}`;
    })
    .join("|");
}

/* ---------------------------------------------------------------- geometry */

export interface CellMetrics {
  /** Cell edge in px. */
  cell: number;
  /** Gap between cells in px. */
  gap: number;
  /** True when the finished grid is narrower than the space available. */
  centred: boolean;
  /** True when the cells hit their floor and the grid has to scroll. */
  overflowing: boolean;
}

export interface CellMetricsInput {
  /** Measured inner width of the scroll container. */
  available: number;
  /** Measured width of the weekday-label column, or 0 when it's hidden. */
  labelWidth: number;
  columns: number;
  /** `cell_size` — pins the cell edge and skips the fitting. */
  fixedCell?: number;
  /** `cell_gap` — pins the gap, whether or not the cell is pinned. */
  fixedGap?: number;
  minCell: number;
  maxCell: number;
  /** Gap as a fraction of the cell edge. */
  gapRatio: number;
}

/**
 * Cell and gap sizes for a grid that has to fit `columns` columns into
 * `available` pixels.
 *
 * This is measured and computed rather than left to `1fr` tracks because the
 * gap has to scale with the cell. A fixed 3px gap between `1fr` cells looks
 * right at 10px cells and wrong at both ends — a solid block at 18px, all
 * gutter at 6px — and CSS can't express "gap: 22% of the track". Fixed pixel
 * tracks from a measured width can, and they also make the overflow decision
 * exact instead of leaving it to fr-vs-min-width rounding.
 *
 * Fitting order: derive the cell from the pitch, cap it so a short range on a
 * wide card doesn't render inch-wide blocks (the leftover goes into the gap,
 * then into centring), and floor it so a long range on a narrow card scrolls
 * rather than shrinking into invisibility.
 */
export function cellMetrics(input: CellMetricsInput): CellMetrics {
  const columns = Math.max(1, input.columns);
  const labelWidth = Math.max(0, input.labelWidth);
  const pitch = Math.max(1, (input.available - labelWidth) / columns);
  const ratio = Math.max(0, input.gapRatio);

  let gap: number;
  let cell: number;
  if (input.fixedCell !== undefined && input.fixedCell > 0) {
    cell = input.fixedCell;
    gap = input.fixedGap ?? Math.max(1, Math.round(cell * ratio));
  } else {
    gap = input.fixedGap ?? Math.max(1, Math.round((pitch * ratio) / (1 + ratio)));
    cell = Math.floor(pitch - gap);
    if (cell > input.maxCell) {
      cell = input.maxCell;
      if (input.fixedGap === undefined) {
        // Spend the leftover width on a wider gap before resorting to
        // centring, up to the point where the gutters would dominate.
        gap = Math.max(1, Math.min(Math.round(cell * 0.5), Math.floor(pitch - cell)));
      }
    }
    if (cell < input.minCell) {
      cell = input.minCell;
      if (input.fixedGap === undefined) gap = Math.max(1, Math.round(cell * ratio));
    }
  }

  const gaps = labelWidth > 0 ? columns : columns - 1;
  const total = labelWidth + columns * cell + gaps * gap;
  return {
    cell,
    gap,
    centred: total < input.available - 1,
    overflowing: total > input.available + 1,
  };
}

/* --------------------------------------------------------------- breakdown */

export interface ResolvedSlice {
  state: string;
  seconds: number;
  /** 0-1 of the day's tracked time. */
  share: number;
  color: string;
  /** Times the entity entered this state that day. */
  count: number;
  /** Days it appeared on. Only present in the whole-range summary. */
  days?: number;
  /** True for the synthetic row the tail collapses into. */
  other: boolean;
}

export interface DayBreakdown {
  /** Null for the whole-range summary. */
  key: DayKey | null;
  date: Date | null;
  /** Formatted date for the panel heading. */
  label: string;
  totalSeconds: number;
  slices: ResolvedSlice[];
  /** States dropped into the "Other" row. */
  hidden: number;
}

/**
 * Human duration, not a decimal of an hour. "6h 12m" is what someone asking
 * "how long was I playing that" wants back; "6.2 h" makes them do the
 * arithmetic themselves.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m";
  const total = Math.round(seconds / 60);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return minutes === 0 ? "<1m" : `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/**
 * Every state's total across the days actually on show.
 *
 * Range-filtered on purpose: the fetch window reaches back before the first
 * visible day (a week to square the grid off, plus a day for statistics), and
 * counting that padding would make the summary disagree with the cells above
 * it. Returned sorted, so the order doubles as the colour ranking — which is
 * why a state keeps its colour whether it's being shown in the summary or in
 * a single day.
 */
export function aggregateBreakdown(
  breakdown: Map<DayKey, StateSlice[]> | undefined,
  range: GridRange
): StateSlice[] {
  const totals = new Map<string, StateSlice>();
  if (breakdown) {
    for (let cursor = range.rangeStart; cursor <= range.rangeEnd; cursor = addDays(cursor, 1)) {
      for (const slice of breakdown.get(dayKey(cursor)) ?? []) {
        const total = totals.get(slice.state) ?? { state: slice.state, seconds: 0, count: 0, days: 0 };
        total.seconds += slice.seconds;
        total.count += slice.count;
        if (slice.seconds > 0) total.days = (total.days ?? 0) + 1;
        totals.set(slice.state, total);
      }
    }
  }
  return [...totals.values()]
    .filter((slice) => slice.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds || a.state.localeCompare(b.state));
}

/** Colour ranking from an ordered slice list. */
export function ranksFrom(slices: StateSlice[]): Map<string, number> {
  return new Map(slices.map((slice, index) => [slice.state, index]));
}

export interface BuildBreakdownInput {
  /** A day key, or null for the whole-range summary. */
  key: DayKey | null;
  /** Heading when `key` is null. */
  summaryLabel?: string;
  slices: StateSlice[] | undefined;
  ranks: Map<string, number>;
  palette: string[];
  overrides?: Record<string, string>;
  max: number;
  darkMode: boolean;
  locale?: string;
}

/** Pure: one day's slices resolved to colours, shares and a capped list. */
export function buildBreakdown(input: BuildBreakdownInput): DayBreakdown | null {
  const date = input.key === null ? null : parseDayKey(input.key);
  if (input.key !== null && !date) return null;
  const label = date ? fullDateFormatter(input.locale).format(date) : (input.summaryLabel ?? "");
  const all = (input.slices ?? []).filter((slice) => slice.seconds > 0);
  const totalSeconds = all.reduce((sum, slice) => sum + slice.seconds, 0);

  if (all.length === 0 || totalSeconds <= 0) {
    return { key: input.key, date, label, totalSeconds: 0, slices: [], hidden: 0 };
  }

  const max = Math.max(1, Math.floor(input.max));
  const shown = all.slice(0, max);
  const tail = all.slice(max);

  const slices: ResolvedSlice[] = shown.map((slice) => ({
    state: slice.state,
    seconds: slice.seconds,
    share: slice.seconds / totalSeconds,
    count: slice.count,
    days: slice.days,
    color: stateColor(
      slice.state,
      input.ranks.get(slice.state) ?? 0,
      input.overrides,
      input.palette,
      input.darkMode
    ),
    other: false,
  }));

  if (tail.length > 0) {
    const seconds = tail.reduce((sum, slice) => sum + slice.seconds, 0);
    slices.push({
      state: `${tail.length} more`,
      seconds,
      share: seconds / totalSeconds,
      count: tail.reduce((sum, slice) => sum + slice.count, 0),
      color: darkOrLightNeutral(input.darkMode),
      other: true,
    });
  }

  return { key: input.key, date, label, totalSeconds, slices, hidden: tail.length };
}

/** The "Other" row is deliberately colourless — it isn't a state. */
function darkOrLightNeutral(darkMode: boolean): string {
  return darkMode ? "#5b6672" : "#9aa4b0";
}
