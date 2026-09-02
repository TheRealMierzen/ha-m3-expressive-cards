import { addDays, dayKey, startOfDay } from "../src/dates";
import { HassEntity, HomeAssistant } from "../src/types";
import { buildGameSamples, buildPresenceSamples, buildVisitDates, Fixture } from "./fixtures";

/**
 * Which shape of statistics backend to imitate.
 *
 * - `full` — a total_increasing sensor: sum, state and change all present.
 * - `measurement` — a measurement sensor: mean/min/max only, no sum, so no
 *   change. The case that made the card look broken.
 * - `legacy` — an HA old enough to reject the `change` type outright.
 * - `none` — an entity the recorder keeps no statistics for.
 */
export type StatsMode = "full" | "measurement" | "legacy" | "none";

export interface MockOptions {
  fixture: Fixture;
  statsMode: StatsMode;
  darkMode: boolean;
  /** Make every websocket call reject, to see the card's error state. */
  failWS: boolean;
  /** Answer with no rows, to see the "nothing recorded" state. */
  emptyData: boolean;
  latencyMs: number;
  onCallService: (domain: string, service: string, data?: Record<string, unknown>) => void;
  onWs: (message: Record<string, unknown>, summary: string) => void;
}

/** Which fixture series backs which statistic id. */
function seriesFor(fixture: Fixture, id: string): Map<string, number> | undefined {
  if (id === "sensor.gym_visits_total") return fixture.visits;
  if (id === "sensor.solar_energy_daily") return fixture.energy;
  return undefined;
}

function buildEntities(fixture: Fixture, statsMode: StatsMode): HassEntity[] {
  const today = dayKey(fixture.last);
  const todaysVisits = fixture.visits.get(today) ?? 0;
  let total = 0;
  for (const count of fixture.visits.values()) total += count;

  return [
    {
      entity_id: "sensor.gym_visits_total",
      state: String(total),
      attributes: {
        friendly_name: "Gym visits total",
        unit_of_measurement: "visits",
        // The attribute that makes source: auto choose statistics — and, since
        // it also decides which columns the recorder keeps, the one that has to
        // agree with the backend shape being imitated.
        state_class: statsMode === "measurement" ? "measurement" : "total_increasing",
      },
    },
    {
      entity_id: "binary_sensor.gym_presence",
      state: todaysVisits > 0 ? "on" : "off",
      attributes: { friendly_name: "Gym presence", device_class: "presence" },
    },
    {
      entity_id: "sensor.gym_log",
      state: String(total),
      attributes: {
        friendly_name: "Gym log",
        visit_dates: buildVisitDates(fixture),
      },
    },
    {
      entity_id: "sensor.solar_energy_daily",
      state: (fixture.energy.get(today) ?? 0).toFixed(2),
      attributes: {
        friendly_name: "Solar energy daily",
        unit_of_measurement: "kWh",
        state_class: "total_increasing",
      },
    },
    {
      entity_id: "sensor.current_game",
      // A text state, which is what makes source: auto choose history and
      // defaultAggregate choose state_time.
      state: fixture.games.get(today)?.[0]?.state ?? "off",
      attributes: { friendly_name: "Current game" },
    },
    {
      entity_id: "counter.gym_visits",
      state: String(total),
      attributes: { friendly_name: "Gym visits counter" },
    },
  ];
}

/**
 * Real HA answers `recorder/statistics_during_period` and
 * `history/history_during_period` over the websocket connection; this stands
 * in for both, in the same wire shapes, so the harness exercises the actual
 * parsing and aggregation in `src/data.ts` rather than a shortcut around it.
 *
 * Two details are deliberately faithful because the card's code depends on
 * them: statistics `start` comes back as epoch milliseconds (not an ISO
 * string), and a history response opens with whatever state was already in
 * effect at `start_time`, carrying its *original* timestamp — which is what
 * makes "was it already on?" distinguishable from "did it turn on just now".
 */
export function buildMockHass(options: MockOptions): HomeAssistant {
  const { fixture } = options;
  const states: Record<string, HassEntity> = {};
  for (const entity of buildEntities(fixture, options.statsMode)) states[entity.entity_id] = entity;

  const settle = <T>(value: T): Promise<T> =>
    new Promise((resolve, reject) => {
      window.setTimeout(() => {
        if (options.failWS) reject(new Error("Connection lost"));
        else resolve(value);
      }, options.latencyMs);
    });

  const callWS = <T>(message: Record<string, unknown>): Promise<T> => {
    const start = new Date(String(message.start_time));
    const end = new Date(String(message.end_time));

    if (message.type === "recorder/statistics_during_period") {
      const ids = (message.statistic_ids as string[]) ?? [];
      const requested = ((message.types as string[]) ?? ["change"]).slice();

      // Real HA validates `types` against the columns it knows and rejects the
      // whole request on an unknown one — it does not quietly ignore it.
      if (options.statsMode === "legacy" && requested.includes("change")) {
        options.onWs(message, `statistics REJECTED unknown type "change" (legacy mode)`);
        return Promise.reject(new Error("Value error, unknown statistic type: change"));
      }

      const response: Record<string, Array<Record<string, unknown>>> = {};
      for (const id of ids) {
        const series = seriesFor(fixture, id);
        if (!series) continue;
        const rows: Array<Record<string, unknown>> = [];
        if (!options.emptyData && options.statsMode !== "none") {
          let runningSum = 0;
          for (let date = startOfDay(start); date < end; date = addDays(date, 1)) {
            const value = series.get(dayKey(date));
            if (value === undefined) continue;
            runningSum += value;
            // Only the requested columns come back, and a measurement-class
            // statistic has no sum, so it can have no change either.
            const columns: Record<string, number> = {
              mean: value,
              min: value,
              max: value,
            };
            if (options.statsMode !== "measurement") {
              columns.sum = runningSum;
              columns.state = runningSum;
              columns.change = value;
            }
            const row: Record<string, unknown> = {
              start: date.getTime(),
              end: addDays(date, 1).getTime(),
            };
            for (const type of requested) {
              if (columns[type] !== undefined) row[type] = columns[type];
            }
            rows.push(row);
          }
        }
        response[id] = rows;
      }
      const first = Object.values(response)[0] ?? [];
      options.onWs(
        message,
        `statistics ${ids.join(", ")} [${requested.join(",")}] → ${first.length} rows, columns: ${
          first.length > 0 ? Object.keys(first[0]).join(",") : "—"
        }`
      );
      return settle(response as unknown as T);
    }

    if (message.type === "history/history_during_period") {
      const ids = (message.entity_ids as string[]) ?? [];
      const response: Record<string, Array<{ s: string; lu: number }>> = {};
      for (const id of ids) {
        if (options.emptyData) {
          response[id] = [];
          continue;
        }
        const samples =
          id === "binary_sensor.gym_presence"
            ? buildPresenceSamples(fixture)
            : id === "sensor.current_game"
              ? buildGameSamples(fixture)
              : null;
        if (!samples) {
          response[id] = [];
          continue;
        }
        const startSec = start.getTime() / 1000;
        const endSec = end.getTime() / 1000;
        const inside = samples.filter((s) => s.lu >= startSec && s.lu < endSec);
        const before = samples.filter((s) => s.lu < startSec).pop();
        response[id] = before ? [before, ...inside] : inside;
      }
      options.onWs(message, `history ${ids.join(", ")} → ${Object.values(response)[0]?.length ?? 0} rows`);
      return settle(response as unknown as T);
    }

    options.onWs(message, `unhandled ${String(message.type)}`);
    return settle({} as T);
  };

  return {
    states,
    themes: { darkMode: options.darkMode },
    language: "en",
    locale: { language: "en", first_weekday: "monday" },
    callService: options.onCallService,
    callWS,
  };
}
