import { cardEntities } from "./compute";
import { addDays, DayKey, dayKey, GridRange, parseDayKey, startOfDay } from "./dates";
import {
  ActivityHeatmapCardConfig,
  HistoryAggregate,
  HomeAssistant,
  SourceKind,
  StateSlice,
  StatType,
} from "./types";

export type ResolvedSource = Exclude<SourceKind, "auto">;

export interface SeriesResult {
  values: Map<DayKey, number>;
  source: ResolvedSource;
  /** Set when the fetch itself failed. */
  error?: string;
  /**
   * Set when the backend answered fine but nothing usable came back, with the
   * specific reason and what to change. Distinct from `error` because it isn't
   * a failure — it's a misconfiguration the card can name.
   */
  notice?: string;
  /**
   * Per-day, per-state durations, when the source can produce them. Only
   * `history` carries the state text — statistics are numbers with the labels
   * already thrown away.
   */
  breakdown?: Map<DayKey, StateSlice[]>;
  /** The reduction the history source settled on, when it chose one itself. */
  aggregate?: HistoryAggregate;
}

/**
 * States that count as "on" when the config doesn't say. An allow-list rather
 * than "anything that isn't off", because plenty of domains have a third
 * state that is emphatically not activity — a media player sitting at `idle`,
 * a climate entity at `off` vs `unavailable`.
 */
const DEFAULT_ON_STATES = [
  "on",
  "true",
  "home",
  "open",
  "unlocked",
  "playing",
  "cleaning",
  "active",
  "detected",
  "running",
  "heating",
  "cooling",
];

const UNUSABLE_STATES = new Set(["unavailable", "unknown", "none", ""]);

/**
 * States that mean "nothing is happening" for `state_time` and the breakdown.
 * A text sensor parks in one of these between the things worth measuring — the
 * media player at `idle`, the game sensor at `off`, the whole entity going
 * `unavailable` when the machine sleeps.
 */
const DEFAULT_IGNORE_STATES = [
  "unavailable",
  "unknown",
  "none",
  "",
  "off",
  "idle",
  "standby",
  "false",
];

/* --------------------------------------------------------------- resolution */

/**
 * `source: auto` in one place.
 *
 * `state_class` is the deciding signal for statistics, because that attribute
 * is exactly what makes HA keep long-term statistics for an entity — and
 * long-term statistics are the only thing that reaches back a year. Note what
 * this means for `counter.*`: counters carry no `state_class`, so they have no
 * long-term statistics and land on `history`, which the recorder purges after
 * `purge_keep_days`. A year-long heatmap of a counter needs a template sensor
 * with `state_class: total_increasing` mirroring it — see the README.
 */
export function resolveSource(
  hass: HomeAssistant | undefined,
  config: ActivityHeatmapCardConfig
): ResolvedSource {
  if (config.source && config.source !== "auto") return config.source;
  if (config.attribute) return "attribute";
  const first = cardEntities(config)[0];
  const entity = first ? hass?.states[first] : undefined;
  if (entity?.attributes.state_class) return "statistics";
  return "history";
}

/**
 * The two-state vocabulary. An entity sitting in one of these is being asked a
 * yes/no question, so counting the yeses is the sensible default.
 */
const BINARY_VOCAB = new Set([
  "on",
  "off",
  "true",
  "false",
  "open",
  "closed",
  "home",
  "not_home",
  "locked",
  "unlocked",
  "detected",
  "clear",
]);

/**
 * `history`'s default reduction, guessed from the entity's *current* state.
 *
 * Only a guess, and only used before any history has been fetched (the first
 * render, and the editor's field visibility). The current state is a bad
 * witness for this decision on exactly the entities the decision matters most
 * for: a sensor reporting which game is running reads `off` whenever you
 * aren't playing, which is most of the time, so a snapshot would call it a
 * binary sensor and count transitions that never happen. Once the samples are
 * in hand, `resolveAggregateFromSamples` decides from all of them instead.
 */
export function defaultAggregate(
  hass: HomeAssistant | undefined,
  config: ActivityHeatmapCardConfig
): HistoryAggregate {
  const first = cardEntities(config)[0];
  if (first?.startsWith("counter.")) return "delta";
  const entity = first ? hass?.states[first] : undefined;
  if (!entity) return "on_count";
  if (Number.isFinite(Number(entity.state)) && entity.state.trim() !== "") return "mean";
  return BINARY_VOCAB.has(entity.state.toLowerCase()) ? "on_count" : "state_time";
}

/* ------------------------------------------------------------------ helpers */

function addTo(target: Map<DayKey, number>, key: DayKey, value: number): void {
  if (!Number.isFinite(value)) return;
  target.set(key, (target.get(key) ?? 0) + value);
}

function toNumber(state: unknown): number | null {
  if (state === null || state === undefined) return null;
  const text = String(state).trim();
  if (UNUSABLE_STATES.has(text.toLowerCase())) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/**
 * Inclusive-start, exclusive-end window the backend is asked for.
 *
 * Statistics get one extra day at the front: reconstructing a day's `change`
 * from `sum` deltas needs the previous day's row, and without the padding the
 * first day actually shown would always come out blank.
 */
function fetchWindow(
  range: GridRange,
  now: Date,
  source: ResolvedSource
): { start: Date; end: Date } {
  const hardEnd = addDays(range.rangeEnd, 1);
  return {
    start: source === "statistics" ? addDays(range.start, -1) : range.start,
    end: now < hardEnd ? now : hardEnd,
  };
}

/* --------------------------------------------------------------- statistics */

interface StatisticRow {
  start: number | string;
  end?: number | string;
  change?: number | null;
  sum?: number | null;
  state?: number | null;
  mean?: number | null;
  min?: number | null;
  max?: number | null;
}

/**
 * Every column, not just the one being displayed.
 *
 * Asking for a single column leaves the card unable to tell "this entity has
 * no long-term statistics" from "it has them, but not that column" — and those
 * two need completely different advice. The extra columns cost nothing on the
 * wire and turn a blank grid into a specific message.
 */
const STAT_TYPES: StatType[] = ["change", "sum", "state", "mean", "min", "max"];

function rowTimestamp(value: number | string): number | null {
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function statNumber(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isFinite(value) ? value : null;
}

/**
 * The default `stat`, from the entity's own `state_class`.
 *
 * This is the difference between the card working and silently showing nothing.
 * `change` is computed from a statistic's `sum` column, and only the `total`
 * and `total_increasing` classes have one. A `measurement` sensor — a
 * temperature, a power reading, a humidity — keeps `mean`/`min`/`max` instead,
 * so asking it for `change` returns a row per day with `change: null` in every
 * one. No error, no data, nothing to go on.
 */
export function defaultStat(
  hass: HomeAssistant | undefined,
  config: ActivityHeatmapCardConfig
): StatType {
  const first = cardEntities(config)[0];
  const stateClass = String(
    (first ? hass?.states[first]?.attributes.state_class : undefined) ?? ""
  ).toLowerCase();
  return stateClass === "measurement" ? "mean" : "change";
}

interface StatisticsOutcome {
  values: Map<DayKey, number>;
  /** Rows the recorder returned, across all requested ids. */
  rows: number;
  /** Columns that carried at least one real number. */
  present: StatType[];
  /** True when `change` had to be reconstructed from `sum` deltas. */
  derived: boolean;
}

function requestStatistics(
  hass: HomeAssistant,
  ids: string[],
  window: { start: Date; end: Date },
  types: StatType[]
): Promise<Record<string, StatisticRow[]>> {
  return hass.callWS!<Record<string, StatisticRow[]>>({
    type: "recorder/statistics_during_period",
    start_time: window.start.toISOString(),
    end_time: window.end.toISOString(),
    statistic_ids: ids,
    period: "day",
    types,
  });
}

async function fetchStatistics(
  hass: HomeAssistant,
  ids: string[],
  window: { start: Date; end: Date },
  stat: StatType
): Promise<StatisticsOutcome> {
  let response: Record<string, StatisticRow[]>;
  try {
    response = await requestStatistics(hass, ids, window, STAT_TYPES);
  } catch {
    // `change` is the newest of the statistic columns, and an HA that doesn't
    // know it rejects the whole request rather than ignoring the unknown type.
    // Drop it and reconstruct the value from `sum` below.
    response = await requestStatistics(
      hass,
      ids,
      window,
      STAT_TYPES.filter((type) => type !== "change")
    );
  }

  const values = new Map<DayKey, number>();
  const present = new Set<StatType>();
  let rows = 0;
  let derived = false;

  for (const raw of Object.values(response ?? {})) {
    // Sorted because a `sum` delta only means anything against the previous
    // day's row, and nothing in the protocol promises an order.
    const sorted = (raw ?? [])
      .map((row) => ({ ms: rowTimestamp(row.start), row }))
      .filter((entry): entry is { ms: number; row: StatisticRow } => entry.ms !== null)
      .sort((a, b) => a.ms - b.ms);
    rows += sorted.length;

    let previousSum: number | null = null;
    for (const { ms, row } of sorted) {
      for (const type of STAT_TYPES) {
        if (statNumber(row[type]) !== null) present.add(type);
      }

      let value = statNumber(row[stat]);
      const sum = statNumber(row.sum);
      if (value === null && stat === "change" && sum !== null && previousSum !== null) {
        value = sum - previousSum;
        derived = true;
      }
      // Updated even when the day contributed no value, so a gap in the
      // series doesn't make the next day's delta count the whole gap.
      if (sum !== null) previousSum = sum;

      if (value === null) continue;
      addTo(values, dayKey(new Date(ms)), value);
    }
  }

  return { values, rows, present: STAT_TYPES.filter((type) => present.has(type)), derived };
}

/**
 * Turns an empty statistics result into something actionable. "Nothing to show"
 * has three completely different causes here and they need different fixes.
 */
function statisticsNotice(
  ids: string[],
  stat: StatType,
  outcome: StatisticsOutcome
): string | undefined {
  if (outcome.values.size > 0) return undefined;
  const subject = ids.length === 1 ? ids[0] : ids.join(", ");
  if (outcome.rows === 0) {
    return `No long-term statistics for ${subject}. Home Assistant only keeps them for entities with a state_class — a counter.* has none, so mirror it with a template sensor declaring state_class: total_increasing.`;
  }
  if (outcome.present.length === 0) {
    return `${subject} returned ${outcome.rows} daily rows but no values in any column.`;
  }
  const suggestion = outcome.present.includes("mean") ? "mean" : outcome.present[0];
  return `${subject} has daily statistics, but no "${stat}" values — that column only exists for total/total_increasing sensors. Available here: ${outcome.present.join(", ")}. Try stat: ${suggestion}.`;
}

/**
 * The reduction to use, decided from every state seen in the window rather
 * than from whichever one happens to be current.
 *
 * A single named state anywhere in the range means the entity is not answering
 * a yes/no question, whatever it reads right now.
 */
function resolveAggregateFromSamples(
  samples: Sample[],
  ignoreStates: Set<string>
): HistoryAggregate {
  let sawNumeric = false;
  for (const sample of samples) {
    const state = sample.state.toLowerCase();
    if (ignoreStates.has(state) || UNUSABLE_STATES.has(state)) continue;
    if (toNumber(sample.state) !== null) {
      sawNumeric = true;
      continue;
    }
    if (!BINARY_VOCAB.has(state)) return "state_time";
  }
  return sawNumeric ? "mean" : "on_count";
}

/* ------------------------------------------------------------------ history */

interface HistoryRow {
  /** Compressed response: state. */
  s?: string;
  /** Compressed response: last-updated, in *seconds*. */
  lu?: number;
  /** Uncompressed fallback. */
  state?: string;
  last_changed?: string;
  last_updated?: string;
}

interface Sample {
  t: number;
  state: string;
}

function toSamples(rows: HistoryRow[]): Sample[] {
  const out: Sample[] = [];
  for (const row of rows ?? []) {
    const state = row.s ?? row.state;
    if (state === undefined) continue;
    let t: number | null = null;
    if (typeof row.lu === "number") t = row.lu * 1000;
    else if (row.last_changed) t = Date.parse(row.last_changed);
    else if (row.last_updated) t = Date.parse(row.last_updated);
    if (t === null || Number.isNaN(t)) continue;
    out.push({ t, state });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

interface DayAccumulator {
  touched: boolean;
  onSeconds: number;
  /** state text -> seconds held that day, ignored states already dropped. */
  stateSeconds: Map<string, number>;
  stateCounts: Map<string, number>;
  onCount: number;
  changes: number;
  weighted: number;
  numericSeconds: number;
  max: number | null;
  min: number | null;
  firstSample: number | null;
  lastSample: number | null;
  valueAtStart: number | null;
  valueAtEnd: number | null;
}

function newAccumulator(): DayAccumulator {
  return {
    touched: false,
    onSeconds: 0,
    stateSeconds: new Map(),
    stateCounts: new Map(),
    onCount: 0,
    changes: 0,
    weighted: 0,
    numericSeconds: 0,
    max: null,
    min: null,
    firstSample: null,
    lastSample: null,
    valueAtStart: null,
    valueAtEnd: null,
  };
}

/**
 * Turns one entity's recorder rows into per-day accumulators.
 *
 * Two passes over the same data, because they need different views of it.
 * Durations (`on_time`, the time-weighted `mean`, the value in effect at a
 * day's edges) come from *intervals* — a state written once at 08:00 and not
 * touched again holds for sixteen hours, and averaging the raw rows instead
 * would weigh that the same as a value that lasted a second. Event counts
 * (`on_count`, `count`) come from the *samples*, since those are about the
 * moment of change, not the span after it.
 *
 * Intervals are split at local midnight, so a light left on overnight is
 * charged to both days in the right proportion rather than landing entirely
 * on whichever day it started.
 */
function accumulate(
  samples: Sample[],
  window: { start: Date; end: Date },
  onStates: Set<string>,
  ignoreStates: Set<string>
): Map<DayKey, DayAccumulator> {
  const days = new Map<DayKey, DayAccumulator>();
  const at = (key: DayKey): DayAccumulator => {
    let acc = days.get(key);
    if (!acc) {
      acc = newAccumulator();
      days.set(key, acc);
    }
    return acc;
  };

  const startMs = window.start.getTime();
  const endMs = window.end.getTime();

  // Pass 1 — intervals.
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    const from = Math.max(sample.t, startMs);
    const to = Math.min(i + 1 < samples.length ? samples[i + 1].t : endMs, endMs);
    if (!(to > from)) continue;

    const isOn = onStates.has(sample.state.toLowerCase());
    const counts = !ignoreStates.has(sample.state.toLowerCase());
    const numeric = toNumber(sample.state);

    let cursor = from;
    while (cursor < to) {
      const day = startOfDay(new Date(cursor));
      const nextMidnight = addDays(day, 1).getTime();
      const sliceEnd = Math.min(nextMidnight, to);
      const seconds = (sliceEnd - cursor) / 1000;
      const acc = at(dayKey(day));
      acc.touched = true;
      if (isOn) acc.onSeconds += seconds;
      // Charged to the day the slice falls in, so a session running past
      // midnight is split between the two days rather than landing whole on
      // whichever one it started in.
      if (counts) {
        acc.stateSeconds.set(sample.state, (acc.stateSeconds.get(sample.state) ?? 0) + seconds);
      }
      if (numeric !== null) {
        acc.weighted += numeric * seconds;
        acc.numericSeconds += seconds;
        acc.max = acc.max === null ? numeric : Math.max(acc.max, numeric);
        acc.min = acc.min === null ? numeric : Math.min(acc.min, numeric);
        if (acc.valueAtStart === null) acc.valueAtStart = numeric;
        acc.valueAtEnd = numeric;
      }
      cursor = sliceEnd;
    }
  }

  // Pass 2 — events. The row at index 0 is whatever state was already in
  // effect when the window opened; HA reports it with the timestamp of the
  // change that produced it, which may predate the window. Counting it as a
  // transition is only correct when that change actually happened inside the
  // window, hence the strict `>` against the window start.
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    if (i === 0 && !(sample.t > startMs)) continue;
    if (sample.t < startMs || sample.t >= endMs) continue;
    const key = dayKey(new Date(sample.t));
    const acc = at(key);
    acc.touched = true;
    acc.changes += 1;
    const isOn = onStates.has(sample.state.toLowerCase());
    const previous = i > 0 ? onStates.has(samples[i - 1].state.toLowerCase()) : false;
    if (isOn && !previous) acc.onCount += 1;
    if (!ignoreStates.has(sample.state.toLowerCase())) {
      acc.stateCounts.set(sample.state, (acc.stateCounts.get(sample.state) ?? 0) + 1);
    }
    const numeric = toNumber(sample.state);
    if (numeric !== null) {
      if (acc.firstSample === null) acc.firstSample = numeric;
      acc.lastSample = numeric;
    }
  }

  return days;
}

function reduceAccumulator(acc: DayAccumulator, aggregate: HistoryAggregate): number | null {
  switch (aggregate) {
    case "on_time":
      return acc.onSeconds / 3600;
    case "state_time": {
      let total = 0;
      for (const seconds of acc.stateSeconds.values()) total += seconds;
      return total / 3600;
    }
    case "on_count":
      return acc.onCount;
    case "count":
      return acc.changes;
    case "mean":
      return acc.numericSeconds > 0 ? acc.weighted / acc.numericSeconds : null;
    case "max":
      return acc.max;
    case "min":
      return acc.min;
    case "first":
      return acc.firstSample ?? acc.valueAtStart;
    case "last":
      return acc.lastSample ?? acc.valueAtEnd;
    case "delta":
      // Edge-to-edge, not last-sample-minus-first-sample: a counter bumped
      // exactly once in a day has one sample, and the naive version would
      // report that day as zero change.
      if (acc.valueAtStart === null || acc.valueAtEnd === null) return null;
      return Math.max(0, acc.valueAtEnd - acc.valueAtStart);
    default:
      return null;
  }
}

interface HistoryOutcome {
  values: Map<DayKey, number>;
  breakdown: Map<DayKey, StateSlice[]>;
  /** What the reduction actually resolved to, for the card's unit and panel. */
  aggregate: HistoryAggregate;
}

async function fetchHistory(
  hass: HomeAssistant,
  ids: string[],
  window: { start: Date; end: Date },
  requested: HistoryAggregate | undefined,
  fallback: HistoryAggregate,
  onStates: Set<string>,
  ignoreStates: Set<string>
): Promise<HistoryOutcome> {
  const response = await hass.callWS!<Record<string, HistoryRow[]>>({
    type: "history/history_during_period",
    start_time: window.start.toISOString(),
    end_time: window.end.toISOString(),
    entity_ids: ids,
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
  });

  // Parsed up front so the aggregate can be decided from the whole window
  // before anything is reduced with it.
  const perEntity = Object.values(response ?? {}).map((rows) => toSamples(rows ?? []));
  const aggregate =
    requested ??
    // `delta` is chosen by domain, not by state text, so samples can't improve
    // on it; everything else is better decided from the data.
    (fallback === "delta"
      ? "delta"
      : resolveAggregateFromSamples(perEntity.flat(), ignoreStates));

  const values = new Map<DayKey, number>();
  const merged = new Map<DayKey, Map<string, StateSlice>>();

  for (const samples of perEntity) {
    const days = accumulate(samples, window, onStates, ignoreStates);
    for (const [key, acc] of days) {
      if (!acc.touched) continue;
      const value = reduceAccumulator(acc, aggregate);
      if (value !== null) addTo(values, key, value);

      // Merged across entities rather than kept per entity: two sensors both
      // reporting "Elden Ring" are one row in the breakdown, not two.
      let day = merged.get(key);
      if (!day) {
        day = new Map();
        merged.set(key, day);
      }
      for (const [state, seconds] of acc.stateSeconds) {
        const slice = day.get(state) ?? { state, seconds: 0, count: 0 };
        slice.seconds += seconds;
        day.set(state, slice);
      }
      for (const [state, count] of acc.stateCounts) {
        const slice = day.get(state) ?? { state, seconds: 0, count: 0 };
        slice.count += count;
        day.set(state, slice);
      }
    }
  }

  const breakdown = new Map<DayKey, StateSlice[]>();
  for (const [key, day] of merged) {
    const slices = [...day.values()]
      .filter((slice) => slice.seconds > 0 || slice.count > 0)
      .sort((a, b) => b.seconds - a.seconds || b.count - a.count);
    if (slices.length > 0) breakdown.set(key, slices);
  }

  return { values, breakdown, aggregate };
}

/* ---------------------------------------------------------------- attribute */

/**
 * Parses a date→value structure off an entity attribute. Deliberately
 * permissive about shape, because there is no convention for this — every
 * template sensor that keeps a history invents its own. All four of these
 * work:
 *
 *   {"2026-08-01": 2, "2026-08-03": 1}     a map
 *   ["2026-08-01", "2026-08-01", ...]      a list of dates, counted
 *   [{date: "2026-08-01", value: 2}, ...]  a list of records
 *   [["2026-08-01", 2], ...]               a list of pairs
 *
 * A bare date list counting duplicates is the useful case: an automation that
 * appends today's date on each gym visit produces a working heatmap with no
 * further templating.
 */
export function parseAttributeSeries(raw: unknown): Map<DayKey, number> | null {
  if (raw === null || raw === undefined) return null;
  const values = new Map<DayKey, number>();

  const put = (dateLike: unknown, valueLike: unknown): void => {
    if (typeof dateLike !== "string" && typeof dateLike !== "number") return;
    const date = parseDayKey(String(dateLike));
    if (!date) return;
    let value = 1;
    if (valueLike !== undefined && valueLike !== null && typeof valueLike !== "boolean") {
      const parsed = Number(valueLike);
      if (!Number.isFinite(parsed)) return;
      value = parsed;
    } else if (valueLike === false) {
      value = 0;
    }
    addTo(values, dayKey(date), value);
  };

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === "string" || typeof entry === "number") {
        put(entry, undefined);
      } else if (Array.isArray(entry)) {
        put(entry[0], entry[1]);
      } else if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const date = record.date ?? record.day ?? record.start ?? record.timestamp ?? record.key;
        const value = record.value ?? record.count ?? record.total ?? record.state ?? record.v;
        put(date, value);
      }
    }
  } else if (typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) put(key, value);
  } else {
    return null;
  }

  return values.size > 0 ? values : null;
}

function fetchAttribute(
  hass: HomeAssistant,
  ids: string[],
  attribute: string
): { values: Map<DayKey, number>; error?: string } {
  const values = new Map<DayKey, number>();
  let parsedAny = false;
  for (const id of ids) {
    const entity = hass.states[id];
    if (!entity) continue;
    const parsed = parseAttributeSeries(entity.attributes[attribute]);
    if (!parsed) continue;
    parsedAny = true;
    for (const [key, value] of parsed) addTo(values, key, value);
  }
  if (!parsedAny) {
    return { values, error: `No date data found in the "${attribute}" attribute` };
  }
  return { values };
}

/* ------------------------------------------------------------------- public */

/**
 * The only side-effecting module in the card: everything downstream of here
 * takes the returned map as input and is pure.
 */
export async function fetchSeries(
  hass: HomeAssistant,
  config: ActivityHeatmapCardConfig,
  range: GridRange,
  now: Date
): Promise<SeriesResult> {
  const source = resolveSource(hass, config);
  const ids = cardEntities(config);
  if (ids.length === 0) {
    return { values: new Map(), source, error: "No entity configured" };
  }

  if (source === "attribute") {
    const attribute = config.attribute;
    if (!attribute) {
      return { values: new Map(), source, error: "`attribute` is required for source: attribute" };
    }
    const result = fetchAttribute(hass, ids, attribute);
    return { values: result.values, source, error: result.error };
  }

  if (typeof hass.callWS !== "function") {
    return { values: new Map(), source, error: "No websocket connection available" };
  }

  const window = fetchWindow(range, now, source);
  const lower = (states: string[]): Set<string> =>
    new Set(states.map((state) => String(state).toLowerCase()));
  const onStates = lower(
    config.on_states && config.on_states.length > 0 ? config.on_states : DEFAULT_ON_STATES
  );
  const ignoreStates = lower(
    config.ignore_states && config.ignore_states.length > 0
      ? config.ignore_states
      : DEFAULT_IGNORE_STATES
  );

  try {
    if (source === "statistics") {
      const stat = config.stat ?? defaultStat(hass, config);
      const outcome = await fetchStatistics(hass, ids, window, stat);
      return { values: outcome.values, source, notice: statisticsNotice(ids, stat, outcome) };
    }
    const outcome = await fetchHistory(
      hass,
      ids,
      window,
      config.aggregate,
      defaultAggregate(hass, config),
      onStates,
      ignoreStates
    );
    return {
      values: outcome.values,
      source,
      breakdown: outcome.breakdown,
      aggregate: outcome.aggregate,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { values: new Map(), source, error: message || "History request failed" };
  }
}
