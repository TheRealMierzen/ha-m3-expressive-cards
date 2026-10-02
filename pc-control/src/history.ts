import { isUnk } from "./compute";
import { HomeAssistant } from "./types";

/** A state change: when, and the number it changed to — null for a reading
 * that isn't one (unavailable while the PC sleeps, unknown at boot). */
export type Sample = [t: number, value: number | null];

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

export function toValue(state: unknown): number | null {
  if (isUnk(state)) return null;
  const text = String(state).trim();
  const n = Number(text);
  return text !== "" && Number.isFinite(n) ? n : null;
}

/**
 * Every entity's recent changes in one request.
 *
 * `significant_changes_only: false` because the recorder's notion of
 * significant is per domain, and for a plain numeric sensor it would drop
 * exactly the small movements a sparkline is for.
 */
export async function fetchHistory(
  hass: HomeAssistant,
  ids: string[],
  hours: number,
  now = Date.now()
): Promise<Record<string, Sample[]>> {
  if (typeof hass.callWS !== "function" || ids.length === 0) return {};
  const response = await hass.callWS<Record<string, HistoryRow[]>>({
    type: "history/history_during_period",
    start_time: new Date(now - hours * 3_600_000).toISOString(),
    end_time: new Date(now).toISOString(),
    entity_ids: ids,
    minimal_response: true,
    no_attributes: true,
    significant_changes_only: false,
  });
  const out: Record<string, Sample[]> = {};
  for (const id of ids) {
    const samples: Sample[] = [];
    for (const row of response?.[id] ?? []) {
      let t: number | null = null;
      if (typeof row.lu === "number") t = row.lu * 1000;
      else if (row.last_changed) t = Date.parse(row.last_changed);
      else if (row.last_updated) t = Date.parse(row.last_updated);
      if (t === null || Number.isNaN(t)) continue;
      samples.push([t, toValue(row.s ?? row.state)]);
    }
    samples.sort((a, b) => a[0] - b[0]);
    out[id] = samples;
  }
  return out;
}

/**
 * The window cut into equal buckets, each holding the time-weighted mean of
 * what the entity read during it, or null where it read nothing usable.
 *
 * Weighted by time rather than by sample because a sensor reports when it
 * changes, not on a clock: a CPU that sat at 5% for an hour and then spiked
 * through twenty readings in a minute was not mostly at 90%.
 */
export function bucketise(samples: Sample[], start: number, end: number, buckets: number): Array<number | null> {
  const width = (end - start) / buckets;
  const sum = new Array<number>(buckets).fill(0);
  const weight = new Array<number>(buckets).fill(0);
  for (let i = 0; i < samples.length; i++) {
    const [t, value] = samples[i];
    if (value === null) continue;
    // Each reading holds until the next one; the first may predate the
    // window, since the recorder opens with the state already in effect.
    const from = Math.max(t, start);
    const to = Math.min(i + 1 < samples.length ? samples[i + 1][0] : end, end);
    if (to <= from) continue;
    const first = Math.floor((from - start) / width);
    const last = Math.min(buckets - 1, Math.floor((to - start) / width));
    for (let b = first; b <= last; b++) {
      const overlap = Math.min(to, start + (b + 1) * width) - Math.max(from, start + b * width);
      if (overlap <= 0) continue;
      sum[b] += value * overlap;
      weight[b] += overlap;
    }
  }
  return sum.map((s, b) => (weight[b] > 0 ? s / weight[b] : null));
}

export const SPARK_W = 100;
export const SPARK_H = 32;

export interface SparkPaths {
  line: string;
  area: string;
}

/**
 * SVG paths for each series on one shared scale. A gap in the data is a gap
 * in the line — the PC being off is information, not something to bridge.
 */
export function sparkPaths(series: Array<Array<number | null>>, min?: number, max?: number): SparkPaths[] {
  const values = series.flat().filter((v): v is number => v !== null);
  if (values.length === 0) return series.map(() => ({ line: "", area: "" }));
  let lo = min ?? Math.min(...values);
  let hi = max ?? Math.max(...values);
  if (hi <= lo) {
    // A flat line sits mid-height instead of hugging an edge.
    lo -= 1;
    hi += 1;
  }
  const pad = 2;
  const y = (v: number): number => {
    const f = Math.min(Math.max((v - lo) / (hi - lo), 0), 1);
    return +(pad + (1 - f) * (SPARK_H - 2 * pad)).toFixed(2);
  };
  return series.map((buckets) => {
    const n = buckets.length;
    const x = (i: number): number => +(n === 1 ? SPARK_W / 2 : (i / (n - 1)) * SPARK_W).toFixed(2);
    let line = "";
    let area = "";
    let run: Array<[number, number]> = [];
    const flush = (): void => {
      if (run.length === 0) return;
      // A lone reading between two gaps still deserves a mark.
      const pts = run.length === 1 ? [run[0], [run[0][0] + 0.5, run[0][1]] as [number, number]] : run;
      line += `M${pts.map(([px, py]) => `${px} ${py}`).join("L")}`;
      area += `M${pts[0][0]} ${SPARK_H}L${pts.map(([px, py]) => `${px} ${py}`).join("L")}L${pts[pts.length - 1][0]} ${SPARK_H}Z`;
      run = [];
    };
    buckets.forEach((v, i) => {
      if (v === null) flush();
      else run.push([x(i), y(v)]);
    });
    flush();
    return { line, area };
  });
}
