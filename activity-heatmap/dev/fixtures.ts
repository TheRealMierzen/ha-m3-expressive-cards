import { addDays, dayKey, startOfDay } from "../src/dates";
import { ActivityHeatmapCardConfig } from "../src/types";

/** Deterministic so a Playwright run against this harness is reproducible —
 * the same grid comes out every time for a given `now`. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** One play session, in minutes from local midnight on its day. */
export interface Session {
  state: string;
  startMinutes: number;
  minutes: number;
}

export interface Fixture {
  /** dayKey -> gym visits that day (0-3). */
  visits: Map<string, number>;
  /** dayKey -> kWh generated that day, a continuous series for contrast. */
  energy: Map<string, number>;
  /** dayKey -> sessions of a text-state sensor (the game being played). */
  games: Map<string, Session[]>;
  first: Date;
  last: Date;
}

const GAMES = [
  "Elden Ring",
  "Baldur's Gate 3",
  "Helldivers 2",
  "Factorio",
  "Hades II",
  "Stardew Valley",
];

/**
 * A year of plausible gym history: weekday-biased, with a six-week slump
 * three months in and a strong recent run, so the grid has actual shape to
 * look at rather than uniform noise.
 */
export function buildFixture(now: Date, days = 420): Fixture {
  const random = lcg(20260828);
  const last = startOfDay(now);
  const first = addDays(last, -(days - 1));
  const visits = new Map<string, number>();
  const energy = new Map<string, number>();
  const games = new Map<string, Session[]>();

  const weekdayBias = [0.12, 0.72, 0.6, 0.34, 0.68, 0.45, 0.2];

  for (let i = 0; i < days; i += 1) {
    const date = addDays(first, i);
    const key = dayKey(date);
    const fromEnd = days - 1 - i;

    let chance = weekdayBias[date.getDay()];
    // The slump, and the recent run.
    if (fromEnd > 150 && fromEnd < 192) chance *= 0.08;
    if (fromEnd < 26) chance = Math.min(0.92, chance * 1.6);
    // Nothing logged at all before the habit started.
    if (fromEnd > 300) chance *= 0.15;

    let count = 0;
    if (random() < chance) {
      count = 1;
      if (random() < 0.22) count = 2;
      if (random() < 0.05) count = 3;
    }
    visits.set(key, count);

    const seasonal = 14 + 9 * Math.sin(((i / 365) * Math.PI * 2) - 1.4);
    energy.set(key, Math.max(0.4, seasonal * (0.55 + random() * 0.7)));

    // Gaming: nothing on most weeknights, a long session at the weekend, and
    // a bias toward two favourites so the breakdown has an obvious shape.
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const sessions: Session[] = [];
    if (random() < (weekend ? 0.85 : 0.4)) {
      const count = random() < (weekend ? 0.55 : 0.2) ? 2 : 1;
      let cursor = weekend ? 600 + Math.floor(random() * 240) : 1140 + Math.floor(random() * 90);
      for (let n = 0; n < count; n += 1) {
        const pick = random();
        const game =
          pick < 0.34
            ? GAMES[0]
            : pick < 0.6
              ? GAMES[1]
              : GAMES[2 + Math.floor(random() * (GAMES.length - 2))];
        const minutes = 35 + Math.floor(random() * (weekend ? 210 : 110));
        sessions.push({ state: game, startMinutes: cursor, minutes });
        cursor += minutes + 20 + Math.floor(random() * 60);
      }
    }
    if (sessions.length > 0) games.set(key, sessions);
  }

  return { visits, energy, games, first, last };
}

/**
 * On/off history for the same visits, as a binary sensor would have recorded
 * it: each visit becomes a ~1h20 window in the morning or evening. This is
 * what makes the harness exercise the real interval-splitting code in
 * data.ts rather than a shortcut.
 */
export function buildPresenceSamples(fixture: Fixture): Array<{ s: string; lu: number }> {
  const samples: Array<{ s: string; lu: number }> = [
    { s: "off", lu: Math.floor(addDays(fixture.first, -1).getTime() / 1000) },
  ];
  for (let date = fixture.first; date <= fixture.last; date = addDays(date, 1)) {
    const count = fixture.visits.get(dayKey(date)) ?? 0;
    for (let visit = 0; visit < count; visit += 1) {
      const startHour = visit === 0 ? 6 : 17 + visit;
      const on = new Date(date.getFullYear(), date.getMonth(), date.getDate(), startHour, 15);
      const off = new Date(on.getTime() + 80 * 60 * 1000);
      samples.push({ s: "on", lu: Math.floor(on.getTime() / 1000) });
      samples.push({ s: "off", lu: Math.floor(off.getTime() / 1000) });
    }
  }
  return samples;
}

/**
 * History rows for a text-state sensor: the state is the name of the game, and
 * `off` in between. Sessions are emitted at their real wall-clock times, so a
 * late-night one that runs past midnight genuinely spans two days and
 * exercises the interval splitting in data.ts rather than just asserting it.
 */
export function buildGameSamples(fixture: Fixture): Array<{ s: string; lu: number }> {
  const samples: Array<{ s: string; lu: number }> = [
    { s: "off", lu: Math.floor(addDays(fixture.first, -1).getTime() / 1000) },
  ];
  for (let date = fixture.first; date <= fixture.last; date = addDays(date, 1)) {
    for (const session of fixture.games.get(dayKey(date)) ?? []) {
      const start = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        0,
        session.startMinutes
      );
      const end = new Date(start.getTime() + session.minutes * 60 * 1000);
      samples.push({ s: session.state, lu: Math.floor(start.getTime() / 1000) });
      samples.push({ s: "off", lu: Math.floor(end.getTime() / 1000) });
    }
  }
  return samples.sort((a, b) => a.lu - b.lu);
}

/** The `attribute` source's input: a plain list of dates, one entry per visit. */
export function buildVisitDates(fixture: Fixture): string[] {
  const out: string[] = [];
  for (const [key, count] of fixture.visits) {
    for (let i = 0; i < count; i += 1) out.push(key);
  }
  return out;
}

export interface DemoConfig {
  id: string;
  label: string;
  config: ActivityHeatmapCardConfig;
}

export const DEMOS: DemoConfig[] = [
  {
    id: "stats",
    label: "Statistics (counter mirror)",
    config: {
      type: "custom:m3-activity-heatmap-card",
      title: "Gym Consistency",
      entity: "sensor.gym_visits_total",
      source: "statistics",
      stat: "change",
      days: 365,
      levels: 4,
      palette: "github",
      stats: ["total", "streak", "longest"],
    },
  },
  {
    id: "history",
    label: "History (binary sensor)",
    config: {
      type: "custom:m3-activity-heatmap-card",
      title: "Gym Attendance",
      entity: "binary_sensor.gym_presence",
      source: "history",
      aggregate: "on_time",
      unit: "h",
      decimals: 1,
      days: 180,
      levels: 4,
      palette: "emerald",
      stats: ["total", "average", "rate"],
    },
  },
  {
    id: "attribute",
    label: "Attribute (date list)",
    config: {
      type: "custom:m3-activity-heatmap-card",
      title: "Workouts Logged",
      entity: "sensor.gym_log",
      source: "attribute",
      attribute: "visit_dates",
      unit: "visits",
      months: 12,
      levels: 3,
      palette: "aurora",
      cell_radius: 6,
      stats: ["active", "streak", "best"],
    },
  },
  {
    id: "game",
    label: "Text states + breakdown",
    config: {
      type: "custom:m3-activity-heatmap-card",
      title: "Gaming",
      entity: "sensor.current_game",
      source: "history",
      aggregate: "state_time",
      days: 120,
      levels: 4,
      palette: "ocean",
      unit: "h",
      decimals: 1,
      stats: ["total", "active", "best"],
      breakdown: true,
    },
  },
  {
    id: "energy",
    label: "Energy (continuous, sqrt)",
    config: {
      type: "custom:m3-activity-heatmap-card",
      title: "Solar Generation",
      entity: "sensor.solar_energy_daily",
      source: "statistics",
      stat: "change",
      days: 365,
      levels: 6,
      palette: "heat",
      scale: "sqrt",
      decimals: 1,
      stats: ["total", "average", "best"],
    },
  },
  {
    id: "minimal",
    label: "Minimal (no chrome)",
    config: {
      type: "custom:m3-activity-heatmap-card",
      entity: "sensor.gym_visits_total",
      source: "statistics",
      weeks: 20,
      levels: 1,
      color: "#4da3ff",
      month_labels: false,
      weekday_labels: "none",
      legend: false,
      stats: false,
      cell_radius: 20,
      cell_gap: 4,
    },
  },
];
