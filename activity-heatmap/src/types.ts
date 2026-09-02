/** A minimal slice of Home Assistant's entity type, just what this card reads. */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    icon?: string;
    unit_of_measurement?: string;
    state_class?: string;
    [key: string]: unknown;
  };
}

/**
 * A minimal slice of Home Assistant's Hass type, just what this card reads.
 *
 * `callWS` is the notable addition over the other cards in this family: a
 * heatmap is a view of *history*, and history doesn't live in `hass.states`.
 * It has to be pulled from the recorder over the websocket connection.
 */
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  themes?: { darkMode?: boolean };
  language?: string;
  locale?: { language?: string; first_weekday?: string };
  callService(domain: string, service: string, serviceData?: Record<string, unknown>): void;
  callWS?<T = unknown>(message: Record<string, unknown>): Promise<T>;
}

/** One state's share of a day, as produced by the history source. */
export interface StateSlice {
  state: string;
  seconds: number;
  /** Times the entity entered this state during the day. */
  count: number;
  /** Days this state appeared on. Only set when summing a whole range. */
  days?: number;
}

/* ------------------------------------------------------------------ config */

/**
 * Where a day's number comes from.
 *
 * - `statistics` — long-term statistics (`recorder/statistics_during_period`,
 *   `period: day`). The only source that reaches back a full year, because
 *   long-term stats are kept forever while raw recorder history is purged
 *   after `purge_keep_days` (10 by default). Requires the entity to have a
 *   `state_class`, which `counter.*` and most numeric sensors do.
 * - `history` — raw recorder history (`history/history_during_period`).
 *   Works for on/off entities, but only as far back as the recorder keeps.
 * - `attribute` — a date→value map (or a list of dates) already sitting on an
 *   entity attribute, typically built by a template sensor. No backend call,
 *   no retention limit.
 * - `auto` — `attribute` if `attribute` is set, otherwise `history` for
 *   toggle-ish domains and non-numeric states, otherwise `statistics`.
 */
export type SourceKind = "auto" | "statistics" | "history" | "attribute";

/** Which statistic column a day's value is read from. */
export type StatType = "change" | "sum" | "state" | "mean" | "min" | "max";

/**
 * How a day's raw history is reduced to one number.
 *
 * - `on_count` — transitions into an "on" state (see `on_states`). The
 *   default, and the one that makes a "did it happen today" heatmap.
 * - `on_time` — hours spent in an "on" state.
 * - `state_time` — hours spent in *any* state that isn't ignored. The one for
 *   a text sensor whose states are names rather than on/off — the game being
 *   played, the room being occupied, the washing-machine programme — where
 *   "how long was this doing something" is the question and *which* something
 *   is the follow-up (see `breakdown`).
 * - `mean` — time-weighted average of the numeric states, not a plain mean
 *   of samples: recorder rows are written on change, so a value that held
 *   for 20 hours would otherwise count the same as one that held for 20
 *   seconds.
 * - `delta` — last minus first numeric state, for something that only
 *   climbs (a counter, an energy total).
 * - `count` — number of recorded state changes.
 */
export type HistoryAggregate =
  | "on_count"
  | "on_time"
  | "state_time"
  | "mean"
  | "max"
  | "min"
  | "first"
  | "last"
  | "delta"
  | "count";

/** How auto thresholds distribute across the value range. */
export type ScaleKind = "linear" | "sqrt" | "log";

export type WeekStart = "auto" | "monday" | "sunday" | "saturday";

export type WeekdayLabelMode = "auto" | "all" | "none";

/** Cells for dates that haven't happened yet, in the trailing week column. */
export type FutureMode = "dim" | "hide";

export type StatKind =
  | "total"
  | "average"
  | "active"
  | "rate"
  | "streak"
  | "longest"
  | "best";

export type TapAction = "more-info" | "breakdown" | "none";

export interface ActivityHeatmapCardConfig {
  type: string;
  title?: string;

  /* ------------------------------------------------------------------ data */
  entity?: string;
  /** Extra entities whose daily values are added to `entity`'s. */
  entities?: string[];
  source?: SourceKind;
  /**
   * `statistics` only. Defaults to `change` for a `total`/`total_increasing`
   * sensor and `mean` for a `measurement` one — `change` is derived from the
   * statistic's `sum` column, which a measurement sensor doesn't have.
   */
  stat?: StatType;
  /** `history` only. Default `on_count`. */
  aggregate?: HistoryAggregate;
  /** `attribute` source: which attribute holds the date→value data. */
  attribute?: string;
  /** What counts as "on" for `on_count` / `on_time`. */
  on_states?: string[];
  /**
   * States that don't count as activity for `state_time`, and are left out of
   * the breakdown. Defaults to the unavailable/unknown/off/idle/standby family
   * — the states a text sensor sits in when nothing is happening.
   */
  ignore_states?: string[];
  /** Multiplies every daily value — seconds→minutes, Wh→kWh, and so on. */
  factor?: number;
  /**
   * Suffix in tooltips and stats. Defaults to the entity's own unit (and to
   * `h` for the `on_time` aggregate). A word-shaped unit is singularised for a
   * value of exactly one, so `visits` shows as `1 visit`.
   */
  unit?: string;
  /** Decimal places for displayed values. Auto (0 or 1) when omitted. */
  decimals?: number;

  /* ----------------------------------------------------------------- range */
  /** Days ending at `end`, inclusive. Default 365. Capped at 730. */
  days?: number;
  /** Whole weeks instead of days — wins over `days` when both are set. */
  weeks?: number;
  /** Whole months instead of days — wins over `days` and `weeks`. */
  months?: number;
  /** Right edge of the range. Default `today`. */
  end?: "today" | "yesterday";
  start_day_of_week?: WeekStart;
  /**
   * Pad the range out to whole weeks so every column has seven cells, the
   * way GitHub's graph does. Default true.
   */
  align_weeks?: boolean;

  /* --------------------------------------------------------------- colours */
  /** Filled shades, not counting the empty cell. 1–9, default 4. */
  levels?: number;
  /** A built-in palette name, or an explicit list of colours (low → high). */
  palette?: string | string[];
  /** Single colour to derive a ramp from — ignored when `palette` is set. */
  color?: string;
  /** Overrides the level-0 cell colour. */
  empty_color?: string;
  /**
   * Explicit lower bounds, one per level, ascending. Overrides
   * `min`/`max`/`scale` — `[1, 2, 4, 8]` says "one is level 1, two is level 2,
   * four is level 3, eight or more is level 4".
   */
  thresholds?: number[];
  /** Values at or below this are drawn as empty. Default 0. */
  min?: number;
  /**
   * Top of the scale. Default: the largest value in range, so the busiest day
   * always reaches the strongest shade. Pin it to keep the colours comparable
   * across cards, or across a range whose peak moves.
   */
  max?: number;
  scale?: ScaleKind;

  /* ---------------------------------------------------------------- layout */
  /**
   * Fixed cell edge in px. Omit to fit the cells to the card's measured width,
   * which is almost always better — the range then decides the cell size
   * instead of the cell size deciding whether the range fits.
   */
  cell_size?: number;
  /** Floor for fitted cells before the grid starts scrolling. Default 5. */
  min_cell_size?: number;
  /** Gap in px. Default: ~22% of the cell edge, so it scales with the cell. */
  cell_gap?: number;
  /** Corner radius in px. Half the cell size or more reads as a dot. */
  cell_radius?: number;
  month_labels?: boolean;
  weekday_labels?: WeekdayLabelMode;
  /** Ring around today's cell. Default true. */
  highlight_today?: boolean;
  future?: FutureMode;

  /* ---------------------------------------------------------------- extras */
  /**
   * Show a per-state breakdown panel when a day is clicked: how the day's total
   * divided across the states the entity actually held. Needs `source:
   * history`, since statistics keep numbers and not the state text. Defaults
   * to on for the `state_time` aggregate, off otherwise.
   */
  breakdown?: boolean;
  /** States to list before the rest collapse into "Other". Default 8. */
  breakdown_max?: number;
  /**
   * Show the whole range's breakdown when no day is selected, so the panel
   * says something before anything is clicked. Default true. Set false to keep
   * the panel collapsed until a day is picked.
   */
  breakdown_summary?: boolean;
  /**
   * Pin colours for particular states, by exact state text. Anything not named
   * is assigned a colour by how much time it accounts for across the whole
   * range, so a given state keeps its colour from day to day.
   */
  state_colors?: Record<string, string>;
  legend?: boolean;
  legend_less?: string;
  legend_more?: string;
  tooltip?: boolean;
  /**
   * `true` (the default) for total / current streak / longest streak, `false`
   * for none, or an explicit list.
   */
  stats?: boolean | StatKind[];
  tap_action?: TapAction;
  /** Seconds between refetches. Default 300. Minimum 30. */
  refresh_interval?: number;
}
