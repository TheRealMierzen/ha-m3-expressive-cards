import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { PALETTE_NAMES } from "./palette";
import { ActivityHeatmapCardConfig, HomeAssistant, StatKind } from "./types";

/* ------------------------------------------------------------------ options */

const option = (value: string, label: string) => ({ value, label });

const SOURCE_OPTIONS = [
  option("auto", "Auto — pick from the entity"),
  option("statistics", "Long-term statistics (a full year)"),
  option("history", "Recorder history (recent only)"),
  option("attribute", "An entity attribute"),
];

const STAT_OPTIONS = [
  option("change", "Change over the day"),
  option("sum", "Running total"),
  option("state", "State at end of day"),
  option("mean", "Daily mean"),
  option("min", "Daily minimum"),
  option("max", "Daily maximum"),
];

const AGGREGATE_OPTIONS = [
  option("on_count", "Times it turned on"),
  option("on_time", "Hours spent on"),
  option("state_time", "Hours spent in any state (text sensors)"),
  option("mean", "Time-weighted average"),
  option("max", "Highest value"),
  option("min", "Lowest value"),
  option("first", "First value"),
  option("last", "Last value"),
  option("delta", "Increase over the day"),
  option("count", "State changes"),
];

const END_OPTIONS = [option("today", "Today"), option("yesterday", "Yesterday")];

const WEEK_START_OPTIONS = [
  option("auto", "Follow Home Assistant"),
  option("monday", "Monday"),
  option("sunday", "Sunday"),
  option("saturday", "Saturday"),
];

const SCALE_OPTIONS = [
  option("linear", "Linear"),
  option("sqrt", "Square root — lifts small values"),
  option("log", "Logarithmic — tames big spikes"),
];

const WEEKDAY_LABEL_OPTIONS = [
  option("auto", "Every other row"),
  option("all", "Every row"),
  option("none", "None"),
];

const FUTURE_OPTIONS = [
  option("dim", "Outline them"),
  option("hide", "Leave them blank"),
];

const TAP_OPTIONS = [
  option("none", "Nothing"),
  option("breakdown", "Open the per-state breakdown"),
  option("more-info", "Open more-info"),
];

const IGNORE_STATE_SUGGESTIONS = ["off", "idle", "standby", "unavailable", "unknown"];

const STAT_KIND_OPTIONS: Array<{ value: StatKind; label: string }> = [
  { value: "total", label: "Total" },
  { value: "average", label: "Daily average" },
  { value: "active", label: "Active days" },
  { value: "rate", label: "Consistency %" },
  { value: "streak", label: "Current streak" },
  { value: "longest", label: "Longest streak" },
  { value: "best", label: "Best day" },
];

const DEFAULT_STAT_KINDS: StatKind[] = ["total", "streak", "longest"];

const ON_STATE_SUGGESTIONS = ["on", "home", "open", "unlocked", "playing", "cleaning", "detected"];

const LABELS: Record<string, string> = {
  title: "Title",
  entity: "Entity",
  entities: "Also add (summed per day)",
  source: "Where the daily value comes from",
  stat: "Which statistic",
  aggregate: "How to reduce each day",
  attribute: "Attribute holding the data",
  on_states: "States that count as “on”",
  ignore_states: "States that don't count",
  breakdown: "Breakdown panel on day click",
  breakdown_max: "States listed before “Other”",
  breakdown_summary: "Summarise the whole range",
  factor: "Multiply values by",
  unit: "Unit",
  decimals: "Decimal places",
  days: "Days to show",
  weeks: "Weeks to show",
  months: "Months to show",
  end: "Last day shown",
  start_day_of_week: "Week starts on",
  align_weeks: "Fill the part-weeks at each end",
  palette_name: "Palette",
  palette_colors: "Custom palette",
  color: "Single colour",
  empty_color: "Empty-day colour",
  levels: "Shades",
  thresholds: "Manual thresholds",
  min: "Scale minimum",
  max: "Scale maximum",
  scale: "Scale shape",
  cell_size: "Fixed cell size (px)",
  min_cell_size: "Smallest cell before scrolling (px)",
  cell_gap: "Gap between cells (px)",
  cell_radius: "Cell corner radius (px)",
  month_labels: "Month labels",
  weekday_labels: "Weekday labels",
  highlight_today: "Ring around today",
  future: "Days that haven't happened yet",
  legend: "Legend",
  legend_less: "Legend “less” label",
  legend_more: "Legend “more” label",
  tooltip: "Tooltip on hover",
  stats: "Figures under the grid",
  tap_action: "Tapping a day",
  refresh_interval: "Refresh every (seconds)",
};

const HELPERS: Record<string, string> = {
  entity: "One day per cell, coloured by this entity's history.",
  entities: "Optional. Their daily values are added to the entity above.",
  source:
    "Long-term statistics reach back a year but need an entity with a state_class. Recorder history works for anything but is purged after purge_keep_days (10 by default).",
  stat:
    "“Change over the day” turns a rising total into a per-day number, and needs a total/total_increasing sensor. A measurement sensor (temperature, power) has no running total, so use a daily mean, minimum or maximum instead — which is what the default picks for you.",
  attribute: "A {date: value} map, or a list of dates — duplicates are counted.",
  on_states: "Leave empty for the sensible defaults (on, home, open, playing, …).",
  ignore_states:
    "Excluded from “hours spent in any state” and from the breakdown. Empty means the defaults: off, idle, standby, unavailable, unknown.",
  breakdown:
    "Clicking a day slides in how its total divided across the states — which game, which programme, which room. Needs recorder history, and defaults to on for the “hours spent in any state” aggregate.",
  breakdown_max: "Longer tails collapse into a single “Other” row. Default 8.",
  breakdown_summary:
    "On, the panel shows the whole range's totals until a day is clicked, and the ✕ goes back to it. Off, it stays closed until you click a day.",
  tap_action: "Pin this to override what clicking a day does.",
  factor: "Handy for unit changes — 1/60 turns minutes into hours.",
  days: "Ignored when weeks or months is set. 7–730.",
  align_weeks:
    "Off draws nothing outside the range instead of empty cells, so the grid starts and ends ragged.",
  palette_colors:
    "Comma-separated colours, faintest first — overrides the palette above. Hex values get blended to fit the shade count; theme tokens and rgb() are used as-is.",
  color: "A single colour to build a ramp from. Only used when no palette is set.",
  levels: "How many filled shades, 1–9. One shade makes it a plain on/off grid. More shades than the data has distinct values will leave some unused.",
  thresholds:
    "Comma-separated lower bounds, one per shade — e.g. 1, 2, 4, 8. Overrides the scale settings below.",
  max: "Empty means the busiest day in range sets the top of the scale.",
  cell_size: "Empty fits the cells to the card width, which is usually what you want.",
  cell_gap: "Empty scales the gap with the cell size.",
  min_cell_size: "Below this the grid scrolls instead of shrinking further. Default 5.",
  future:
    "Only the trailing part-week is affected, and only while “fill the part-weeks” is on.",
  refresh_interval:
    "Statistics are recompiled every five minutes, so there's little point going below that.",
};

/** Fields that only apply to one source, so the editor can drop the rest. */
const SOURCE_ONLY: Record<string, string[]> = {
  stat: ["statistics"],
  aggregate: ["history"],
  on_states: ["history"],
  ignore_states: ["history"],
  attribute: ["attribute"],
  breakdown: ["history"],
  breakdown_max: ["history"],
  breakdown_summary: ["history"],
};

/* ------------------------------------------------------------------- shapes */

// Keys this editor owns. The form is the sole authority on them, so an edit
// clears them and rewrites whichever ones still have a value; everything else
// in the config — Home Assistant's own `grid_options` / `layout_options` /
// `view_layout` / `visibility`, and hand-written YAML with no selector here,
// such as `state_colors` — is carried through untouched. Rebuilding the config
// from a whitelist instead would silently reset the card's layout settings
// every time a field changed.
const COPY_KEYS = [
  "title",
  "entity",
  "entities",
  "stat",
  "aggregate",
  "attribute",
  "on_states",
  "ignore_states",
  "breakdown_max",
  "factor",
  "unit",
  "decimals",
  "days",
  "weeks",
  "months",
  "color",
  "empty_color",
  "levels",
  "min",
  "max",
  "cell_size",
  "min_cell_size",
  "cell_gap",
  "cell_radius",
  "legend_less",
  "legend_more",
  "refresh_interval",
];

// Selects with a meaningful default: written only when they differ from it, so
// a freshly configured card stays a short, readable YAML block.
const PICK_DEFAULTS: Record<string, string> = {
  source: "auto",
  end: "today",
  start_day_of_week: "auto",
  scale: "linear",
  weekday_labels: "auto",
  future: "dim",
  tap_action: "none",
};

// Booleans that default to on: only the "off" is worth persisting.
const BOOLEAN_KEYS = [
  "align_weeks",
  "month_labels",
  "highlight_today",
  "legend",
  "tooltip",
  "breakdown_summary",
];

const EDITED_KEYS = [
  ...COPY_KEYS,
  ...Object.keys(PICK_DEFAULTS),
  ...BOOLEAN_KEYS,
  "breakdown",
  "palette",
  "thresholds",
  "stats",
];

interface FormData {
  [key: string]: unknown;
}

function parseNumberList(text: unknown): number[] | undefined {
  if (typeof text !== "string" || text.trim() === "") return undefined;
  const numbers = text
    .split(/[,\s]+/)
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n));
  return numbers.length > 0 ? numbers.sort((a, b) => a - b) : undefined;
}

function parseColorList(text: unknown): string[] | undefined {
  if (typeof text !== "string" || text.trim() === "") return undefined;
  const colors = text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  return colors.length > 0 ? colors : undefined;
}

/**
 * The editor covers every option this card has, but three of them don't map
 * onto any `ha-form` selector: `palette` is a name *or* a list, `thresholds`
 * is a list of numbers, and `stats` is a boolean *or* a list. Those get
 * synthesised form fields (`palette_name` / `palette_colors`, a comma-
 * separated `thresholds` string, a multi-select `stats`) and are translated
 * back in `_valueChanged` — which is also why `_data` can't just be a
 * spread of the config.
 */
@customElement("m3-activity-heatmap-card-editor")
export class ActivityHeatmapCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: ActivityHeatmapCardConfig;

  setConfig(config: ActivityHeatmapCardConfig): void {
    this._config = config;
  }

  /** The source the schema is built for — `auto` resolves against the entity
   * so the irrelevant fields still disappear when nothing is pinned. */
  private get _effectiveSource(): string {
    const config = this._config;
    if (!config) return "history";
    if (config.source && config.source !== "auto") return config.source;
    if (config.attribute) return "attribute";
    const entity = config.entity ? this.hass?.states[config.entity] : undefined;
    return entity?.attributes.state_class ? "statistics" : "history";
  }

  private get _schema(): unknown[] {
    const source = this._effectiveSource;
    const keep = (name: string): boolean => {
      const only = SOURCE_ONLY[name];
      return only === undefined || only.includes(source);
    };
    const fields = (entries: Array<{ name: string; selector: unknown }>) =>
      entries.filter((entry) => keep(entry.name));

    return [
      { name: "title", selector: { text: {} } },
      { name: "entity", selector: { entity: {} } },
      {
        type: "expandable",
        name: "",
        title: "Data",
        iconPath: undefined,
        schema: fields([
          { name: "source", selector: { select: { mode: "dropdown", options: SOURCE_OPTIONS } } },
          { name: "stat", selector: { select: { mode: "dropdown", options: STAT_OPTIONS } } },
          {
            name: "aggregate",
            selector: { select: { mode: "dropdown", options: AGGREGATE_OPTIONS } },
          },
          { name: "attribute", selector: { text: {} } },
          {
            name: "on_states",
            selector: {
              select: {
                multiple: true,
                custom_value: true,
                options: ON_STATE_SUGGESTIONS.map((state) => option(state, state)),
              },
            },
          },
          {
            name: "ignore_states",
            selector: {
              select: {
                multiple: true,
                custom_value: true,
                options: IGNORE_STATE_SUGGESTIONS.map((state) => option(state, state)),
              },
            },
          },
          { name: "entities", selector: { entity: { multiple: true } } },
          { name: "factor", selector: { number: { mode: "box", step: "any" } } },
          { name: "unit", selector: { text: {} } },
          { name: "decimals", selector: { number: { min: 0, max: 3, mode: "box" } } },
        ]),
      },
      {
        type: "expandable",
        name: "",
        title: "Range",
        schema: [
          { name: "days", selector: { number: { min: 7, max: 730, mode: "box" } } },
          { name: "weeks", selector: { number: { min: 1, max: 104, mode: "box" } } },
          { name: "months", selector: { number: { min: 1, max: 24, mode: "box" } } },
          { name: "end", selector: { select: { mode: "dropdown", options: END_OPTIONS } } },
          {
            name: "start_day_of_week",
            selector: { select: { mode: "dropdown", options: WEEK_START_OPTIONS } },
          },
          { name: "align_weeks", selector: { boolean: {} } },
        ],
      },
      {
        type: "expandable",
        name: "",
        title: "Colour",
        schema: [
          {
            name: "palette_name",
            selector: {
              select: { mode: "dropdown", options: PALETTE_NAMES.map((n) => option(n, n)) },
            },
          },
          { name: "palette_colors", selector: { text: {} } },
          { name: "color", selector: { text: {} } },
          { name: "empty_color", selector: { text: {} } },
          { name: "levels", selector: { number: { min: 1, max: 9, mode: "box" } } },
          { name: "thresholds", selector: { text: {} } },
          { name: "min", selector: { number: { mode: "box", step: "any" } } },
          { name: "max", selector: { number: { mode: "box", step: "any" } } },
          { name: "scale", selector: { select: { mode: "dropdown", options: SCALE_OPTIONS } } },
        ],
      },
      {
        type: "expandable",
        name: "",
        title: "Layout",
        schema: [
          { name: "cell_size", selector: { number: { min: 4, max: 40, mode: "box" } } },
          { name: "min_cell_size", selector: { number: { min: 2, max: 40, mode: "box" } } },
          { name: "cell_gap", selector: { number: { min: 0, max: 12, mode: "box" } } },
          { name: "cell_radius", selector: { number: { min: 0, max: 20, mode: "box" } } },
          { name: "month_labels", selector: { boolean: {} } },
          {
            name: "weekday_labels",
            selector: { select: { mode: "dropdown", options: WEEKDAY_LABEL_OPTIONS } },
          },
          { name: "highlight_today", selector: { boolean: {} } },
          { name: "future", selector: { select: { mode: "dropdown", options: FUTURE_OPTIONS } } },
        ],
      },
      {
        type: "expandable",
        name: "",
        title: "Extras",
        schema: [
          { name: "breakdown", selector: { boolean: {} } },
          { name: "breakdown_summary", selector: { boolean: {} } },
          { name: "breakdown_max", selector: { number: { min: 1, max: 20, mode: "box" } } },
          {
            name: "stats",
            selector: { select: { multiple: true, options: STAT_KIND_OPTIONS } },
          },
          { name: "legend", selector: { boolean: {} } },
          { name: "legend_less", selector: { text: {} } },
          { name: "legend_more", selector: { text: {} } },
          { name: "tooltip", selector: { boolean: {} } },
          { name: "tap_action", selector: { select: { mode: "dropdown", options: TAP_OPTIONS } } },
          { name: "refresh_interval", selector: { number: { min: 30, max: 3600, mode: "box" } } },
        ],
      },
    ];
  }

  private get _data(): FormData {
    const config = this._config;
    if (!config) return {};
    const paletteIsList = Array.isArray(config.palette);
    return {
      title: config.title,
      entity: config.entity,
      entities: config.entities,
      source: config.source ?? "auto",
      stat: config.stat,
      aggregate: config.aggregate,
      attribute: config.attribute,
      on_states: config.on_states,
      ignore_states: config.ignore_states,
      breakdown: config.breakdown,
      breakdown_summary: config.breakdown_summary !== false,
      breakdown_max: config.breakdown_max,
      factor: config.factor,
      unit: config.unit,
      decimals: config.decimals,
      days: config.days,
      weeks: config.weeks,
      months: config.months,
      end: config.end ?? "today",
      start_day_of_week: config.start_day_of_week ?? "auto",
      align_weeks: config.align_weeks !== false,
      palette_name: paletteIsList ? undefined : (config.palette as string | undefined),
      palette_colors: paletteIsList ? (config.palette as string[]).join(", ") : undefined,
      color: config.color,
      empty_color: config.empty_color,
      levels: config.levels,
      thresholds: config.thresholds?.join(", "),
      min: config.min,
      max: config.max,
      scale: config.scale ?? "linear",
      cell_size: config.cell_size,
      min_cell_size: config.min_cell_size,
      cell_gap: config.cell_gap,
      cell_radius: config.cell_radius,
      month_labels: config.month_labels !== false,
      weekday_labels: config.weekday_labels ?? "auto",
      highlight_today: config.highlight_today !== false,
      future: config.future ?? "dim",
      legend: config.legend !== false,
      legend_less: config.legend_less,
      legend_more: config.legend_more,
      tooltip: config.tooltip !== false,
      stats:
        config.stats === false
          ? []
          : Array.isArray(config.stats)
            ? config.stats
            : DEFAULT_STAT_KINDS,
      tap_action: config.tap_action ?? "none",
      refresh_interval: config.refresh_interval,
    };
  }

  private _computeLabel = (schema: { name: string; title?: string }): string =>
    LABELS[schema.name] ?? schema.title ?? schema.name;

  private _computeHelper = (schema: { name: string }): string | undefined => HELPERS[schema.name];

  private _valueChanged(ev: CustomEvent<{ value: FormData }>): void {
    if (!this._config) return;
    const value = ev.detail.value ?? {};
    // Start from the existing config so keys this editor does not own survive
    // the round trip, then clear the ones the form is about to rewrite.
    const next: Record<string, unknown> = { ...this._config };
    for (const key of EDITED_KEYS) delete next[key];

    const copy = (key: string): void => {
      const raw = value[key];
      if (raw === undefined || raw === null || raw === "") return;
      if (Array.isArray(raw) && raw.length === 0) return;
      if (typeof raw === "number" && !Number.isFinite(raw)) return;
      next[key] = raw;
    };

    for (const key of COPY_KEYS) copy(key);

    for (const [key, fallback] of Object.entries(PICK_DEFAULTS)) {
      const raw = value[key];
      if (typeof raw === "string" && raw !== "" && raw !== fallback) next[key] = raw;
    }

    for (const key of BOOLEAN_KEYS) {
      if (value[key] === false) next[key] = false;
    }
    // `breakdown` has no fixed default — it follows the aggregate — so both
    // answers are a real choice and both get written.
    if (typeof value.breakdown === "boolean") next.breakdown = value.breakdown;

    const colors = parseColorList(value.palette_colors);
    if (colors) next.palette = colors;
    else if (typeof value.palette_name === "string" && value.palette_name !== "") {
      next.palette = value.palette_name;
    }

    const thresholds = parseNumberList(value.thresholds);
    if (thresholds) next.thresholds = thresholds;

    const stats = value.stats;
    if (Array.isArray(stats)) {
      if (stats.length === 0) next.stats = false;
      else if (
        stats.length !== DEFAULT_STAT_KINDS.length ||
        stats.some((kind, i) => kind !== DEFAULT_STAT_KINDS[i])
      ) {
        next.stats = stats;
      }
    }

    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: next as unknown as ActivityHeatmapCardConfig },
        bubbles: true,
        composed: true,
      })
    );
  }

  protected render() {
    if (!this._config || !this.hass) return nothing;
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._data}
        .schema=${this._schema}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "m3-activity-heatmap-card-editor": ActivityHeatmapCardEditor;
  }
}
