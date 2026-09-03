import { LitElement, html, nothing, TemplateResult } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import "./activity-heatmap-card-editor";
import { cardStyles } from "./card.css";
import {
  aggregateBreakdown,
  buildBreakdown,
  buildGrid,
  cardEntities,
  CellMetrics,
  cellMetrics,
  DayBreakdown,
  entitySignature,
  formatDuration,
  formatValue,
  HeatCell,
  HeatGrid,
  ranksFrom,
  ROWS,
} from "./compute";
import { defaultAggregate, fetchSeries, resolveSource } from "./data";
import { categoricalColors } from "./palette";
import { DayKey, dayKey, fullDateFormatter, resolveRange } from "./dates";
import {
  ActivityHeatmapCardConfig,
  HistoryAggregate,
  HomeAssistant,
  StateSlice,
  TapAction,
} from "./types";

/**
 * There is deliberately no DEFAULT_CONFIG object here.
 *
 * Spreading one over the user's config turns every default into a *value*, and
 * a value can't be distinguished from a deliberate choice. That silently broke
 * two options: a pinned `palette: "github"` meant `color:` was never consulted,
 * because the palette always won; and a pinned `tap_action: "none"` meant the
 * breakdown panel could never make itself the default action for the aggregate
 * that exists for it. Every read site applies its own fallback instead —
 * `?? "auto"` for the enums, `!== false` for the flags — so an option left out
 * stays genuinely absent.
 */

/** How often the housekeeping tick runs. Cheap, and it's what notices the
 * date rolling over — a heatmap left open past midnight otherwise keeps
 * drawing yesterday's grid until something else forces a refetch. */
const TICK_MS = 60_000;

const DEFAULT_REFRESH_S = 300;
const MIN_REFRESH_S = 30;

/** Recorder rows land immediately, so a state change is worth chasing. */
const HISTORY_DEBOUNCE_MS = 1500;

/** Gap as a fraction of the cell edge, and the size band a cell may take.
 * The ratio is GitHub's (3px on a 13px pitch); the cap stops `weeks: 8` on a
 * wide dashboard from rendering inch-wide blocks. */
const GAP_RATIO = 0.22;
const MAX_CELL_PX = 22;
const DEFAULT_MIN_CELL_PX = 5;

@customElement("m3-activity-heatmap-card")
export class ActivityHeatmapCard extends LitElement {
  static styles = [cardStyles];

  private _hass?: HomeAssistant;
  private _lastSignature = "";

  @state() private _config!: ActivityHeatmapCardConfig;
  @state() private _values: Map<DayKey, number> = new Map();
  @state() private _loading = false;
  /** False until a fetch has actually completed. Distinguishes "no data" from
   * "no data *yet*" — without it the card asserts the range is empty during
   * the debounce, before it has asked the recorder anything. */
  @state() private _loaded = false;
  @state() private _error?: string;
  /** Backend answered, but with nothing usable — and it knows why. */
  @state() private _notice?: string;
  @state() private _breakdown?: Map<string, StateSlice[]>;
  /**
   * What the history source decided to reduce by, once it had the samples.
   * Preferred over the pre-fetch guess for the unit and the breakdown default,
   * since the guess only ever saw the entity's current state.
   */
  @state() private _aggregate?: HistoryAggregate;
  /** Day whose breakdown panel is open. */
  @state() private _selected: string | null = null;
  /**
   * Kept after `_selected` clears so the panel still has something to render
   * on the way out — unmounting the content would make it vanish instead of
   * sliding closed.
   */
  @state() private _lastSelected: string | null = null;
  @state() private _now = new Date();
  /** Pointer hover, and keyboard cursor. Kept apart so moving the mouse away
   * doesn't throw away where the keyboard was. */
  @state() private _hover: number | null = null;
  @state() private _cursor: number | null = null;
  /** Null until the first measurement; the grid renders on flexible tracks
   * in the meantime. */
  @state() private _metrics: (CellMetrics & { hideLabels: boolean }) | null = null;

  @query("ha-card") private _cardEl?: HTMLElement;
  @query(".board") private _boardEl?: HTMLElement;
  @query(".scroll") private _scrollEl?: HTMLElement;
  @query(".tip") private _tipEl?: HTMLElement;

  private _tickTimer?: number;
  private _fetchTimer?: number;
  /** Guards against a slow fetch landing after a newer one. */
  private _fetchToken = 0;
  private _lastFetchAt = 0;
  private _lastFetchDay = "";
  private _scrolledToEnd = false;
  private _resizeObserver?: ResizeObserver;
  /** Inputs the current _metrics were derived from, so re-measuring after our
   * own size change can't feed back into itself. */
  private _measureKey = "";
  private _renderedColumns = 0;
  /** Last width the weekday-label column actually measured. Cached, and always
   * the value fed to cellMetrics, so hiding the labels can't change the input
   * that decided to hide them — otherwise the two states oscillate. */
  private _labelWidth = 22;

  connectedCallback(): void {
    super.connectedCallback();
    this._tickTimer = window.setInterval(() => this._tick(), TICK_MS);
    if (this._hass && this._config) this._scheduleFetch(0);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._tickTimer);
    clearTimeout(this._fetchTimer);
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
  }

  set hass(hass: HomeAssistant) {
    const first = this._hass === undefined;
    this._hass = hass;
    // HA's own theme setting, not prefers-color-scheme — the OS theme and
    // HA's theme toggle can disagree, and the card should follow HA.
    const theme = hass.themes?.darkMode === false ? "light" : "dark";
    if (this.getAttribute("data-theme") !== theme) {
      this.setAttribute("data-theme", theme);
      this.requestUpdate();
    }
    if (!this._config) return;
    if (first) {
      this._scheduleFetch(0);
      return;
    }
    const signature = entitySignature(hass, this._config);
    if (signature === this._lastSignature) return;
    const hadSignature = this._lastSignature !== "";
    this._lastSignature = signature;
    // A first sighting is a load, not a change: debouncing it would leave the
    // card blank for the debounce window every time a dashboard opens.
    if (hadSignature) this._onWatchedEntityChanged();
    else this._scheduleFetch(0);
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  setConfig(config: ActivityHeatmapCardConfig): void {
    if (!config) throw new Error("Invalid configuration");
    if (config.entities !== undefined && !Array.isArray(config.entities)) {
      throw new Error("`entities` must be a list");
    }
    if (config.thresholds !== undefined && !Array.isArray(config.thresholds)) {
      throw new Error("`thresholds` must be a list of numbers");
    }
    this._config = { ...config };
    this._lastSignature = "";
    this._values = new Map();
    this._loaded = false;
    this._error = undefined;
    this._notice = undefined;
    this._breakdown = undefined;
    this._aggregate = undefined;
    this._selected = null;
    this._lastSelected = null;
    this._hover = null;
    this._cursor = null;
    this._scrolledToEnd = false;
    this._measureKey = "";
    if (this._hass) this._scheduleFetch(0);
  }

  static getStubConfig(): ActivityHeatmapCardConfig {
    return { type: "custom:m3-activity-heatmap-card", title: "Activity", days: 365, levels: 4 };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("m3-activity-heatmap-card-editor");
  }

  /* ------------------------------------------------------------ data loading */

  private get _refreshSeconds(): number {
    const raw = this._config?.refresh_interval;
    if (raw === undefined || !Number.isFinite(raw)) return DEFAULT_REFRESH_S;
    return Math.max(MIN_REFRESH_S, Math.floor(raw));
  }

  /**
   * A watched entity changed. Whether that's worth a refetch depends entirely
   * on the source: an attribute series is already in `hass` and costs nothing
   * to re-read, raw history has the new row the moment the state lands, but
   * long-term statistics are only compiled on the recorder's own five-minute
   * cadence — refetching those immediately would return the same numbers and
   * spend a round-trip proving it. The periodic refresh covers that case.
   */
  private _onWatchedEntityChanged(): void {
    const source = resolveSource(this._hass, this._config);
    if (source === "attribute") this._scheduleFetch(0);
    else if (source === "history") this._scheduleFetch(HISTORY_DEBOUNCE_MS);
  }

  private _tick(): void {
    const now = new Date();
    this._now = now;
    if (!this._hass || !this._config) return;
    if (dayKey(now) !== this._lastFetchDay) {
      this._scheduleFetch(0);
      return;
    }
    if (now.getTime() - this._lastFetchAt >= this._refreshSeconds * 1000) this._scheduleFetch(0);
  }

  private _scheduleFetch(delayMs: number): void {
    clearTimeout(this._fetchTimer);
    this._fetchTimer = window.setTimeout(() => void this._fetch(), delayMs);
  }

  private async _fetch(): Promise<void> {
    const hass = this._hass;
    const config = this._config;
    if (!hass || !config) return;
    if (cardEntities(config).length === 0) {
      this._values = new Map();
      this._error = undefined;
      this._notice = undefined;
      this._loading = false;
      this._loaded = true;
      return;
    }

    const token = ++this._fetchToken;
    const now = new Date();
    this._now = now;
    this._loading = true;
    const range = resolveRange(config, now, hass.locale?.first_weekday);
    const result = await fetchSeries(hass, config, range, now);
    if (token !== this._fetchToken) return;

    this._values = result.values;
    this._error = result.error;
    this._notice = result.notice;
    this._breakdown = result.breakdown;
    this._aggregate = result.aggregate;
    this._loading = false;
    this._loaded = true;
    this._lastFetchAt = Date.now();
    this._lastFetchDay = dayKey(now);
    this._lastSignature = entitySignature(hass, config);
  }

  /* ------------------------------------------------------------ interaction */

  private get _activeIndex(): number | null {
    return this._hover ?? this._cursor;
  }

  private _cellIndexFromEvent(event: Event): number | null {
    const target = event.target as HTMLElement | null;
    const cell = target?.closest?.("[data-i]") as HTMLElement | null;
    if (!cell) return null;
    const index = Number(cell.dataset.i);
    return Number.isFinite(index) ? index : null;
  }

  private _onPointerOver(event: PointerEvent): void {
    this._hover = this._cellIndexFromEvent(event);
  }

  private _onPointerLeave(): void {
    this._hover = null;
  }

  private _onClick(event: MouseEvent, grid: HeatGrid): void {
    const index = this._cellIndexFromEvent(event);
    if (index === null) return;
    // On a touch device this is also what surfaces the tooltip, since there
    // is no hover to surface it with.
    this._cursor = index;
    this._fireTapAction(grid.cells[index]);
  }

  private _fireTapAction(cell: HeatCell | undefined): void {
    if (!cell || !cell.inRange) return;
    const action = this._tapAction;

    if (action === "breakdown") {
      // Clicking the open day again closes it, so the same gesture undoes
      // itself rather than needing the × every time.
      this._selected = this._selected === cell.key ? null : cell.key;
      if (this._selected) this._lastSelected = this._selected;
      return;
    }

    if (action !== "more-info") return;
    const entity = cardEntities(this._config)[0];
    if (!entity) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        bubbles: true,
        composed: true,
        detail: { entityId: entity },
      })
    );
  }

  private _closePanel(): void {
    this._selected = null;
  }

  /**
   * Arrow keys walk a single roving cursor rather than every cell being its
   * own tab stop: a year's grid is 371 cells, and tabbing through that to
   * reach the card after it would be hostile.
   */
  private _onKeydown(event: KeyboardEvent, grid: HeatGrid): void {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -grid.columns,
      ArrowDown: grid.columns,
    };

    if (event.key === "Escape") {
      // The panel first, then the cursor — one escape per thing that's open.
      if (this._selected !== null) this._selected = null;
      else this._cursor = null;
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (this._cursor !== null) {
        event.preventDefault();
        this._fireTapAction(grid.cells[this._cursor]);
      }
      return;
    }
    const step = steps[event.key];
    if (step === undefined) return;
    event.preventDefault();

    if (this._cursor === null) {
      this._cursor = this._latestIndex(grid);
      return;
    }
    // Walk in the requested direction until an in-range cell turns up, so
    // the cursor never lands on the week-alignment padding.
    for (let next = this._cursor + step; next >= 0 && next < grid.cells.length; next += step) {
      if (grid.cells[next].inRange) {
        this._cursor = next;
        return;
      }
    }
  }

  /**
   * The most recent day in range — where the cursor starts. Not simply the
   * last in-range cell in DOM order: the grid is laid out row-major by
   * weekday, so the final in-range cell is the last *Sunday*, which can be up
   * to six days older than today.
   */
  private _latestIndex(grid: HeatGrid): number | null {
    let best: number | null = null;
    for (let i = 0; i < grid.cells.length; i += 1) {
      const cell = grid.cells[i];
      if (!cell.inRange) continue;
      if (best === null || cell.date > grid.cells[best].date) best = i;
    }
    return best;
  }

  private _onFocus(grid: HeatGrid): void {
    if (this._cursor === null) this._cursor = this._latestIndex(grid);
  }

  private _onBlur(): void {
    this._cursor = null;
  }

  /* ---------------------------------------------------------------- tooltip */

  protected updated(): void {
    this._observeSize();
    this._measure();
    this._positionTip();
    // The newest week is the one worth seeing first, and only once the fit is
    // known — before that a provisional layout could scroll for no reason.
    if (
      !this._scrolledToEnd &&
      this._metrics?.overflowing &&
      this._scrollEl &&
      this._values.size > 0
    ) {
      const el = this._scrollEl;
      if (el.scrollWidth > el.clientWidth + 1) {
        el.scrollLeft = el.scrollWidth;
        this._scrolledToEnd = true;
      }
    }
  }

  private _observeSize(): void {
    const el = this._scrollEl;
    if (!el || this._resizeObserver || typeof ResizeObserver !== "function") return;
    this._resizeObserver = new ResizeObserver(() => this._measure());
    this._resizeObserver.observe(el);
  }

  /**
   * Re-fits the cells to the measured width. Guarded by a key over every
   * input, because setting _metrics re-renders, which lands back here — and
   * the grid's own size is one of the things the observer watches.
   */
  private _measure(): void {
    const scroll = this._scrollEl;
    if (!scroll || this._renderedColumns === 0) return;
    const available = scroll.clientWidth;
    if (available <= 0) return;

    const label = this.renderRoot.querySelector(".dlab") as HTMLElement | null;
    if (label) {
      const measured = Math.ceil(label.getBoundingClientRect().width) + 3;
      if (measured > 0) this._labelWidth = measured;
    }

    const config = this._config;
    const wantLabels = (config.weekday_labels ?? "auto") !== "none";
    const labelWidth = wantLabels ? this._labelWidth : 0;
    const key = [
      available,
      labelWidth,
      this._renderedColumns,
      config.cell_size,
      config.cell_gap,
      config.min_cell_size,
      config.weekday_labels,
    ].join("|");
    if (key === this._measureKey) return;
    this._measureKey = key;

    const fit = (width: number): CellMetrics =>
      cellMetrics({
        available,
        labelWidth: width,
        columns: this._renderedColumns,
        fixedCell: config.cell_size,
        fixedGap: config.cell_gap,
        minCell: Math.max(2, config.min_cell_size ?? DEFAULT_MIN_CELL_PX),
        maxCell: MAX_CELL_PX,
        gapRatio: GAP_RATIO,
      });

    // Once the cells are at their floor and the grid has to scroll, the
    // weekday labels are the wrong thing to keep: they'd scroll away with the
    // oldest weeks anyway, since the newest end is what gets shown. Giving
    // their column back to the cells is the better trade — unless the config
    // asked for them outright.
    let next: CellMetrics & { hideLabels: boolean } = { ...fit(labelWidth), hideLabels: false };
    if (next.overflowing && wantLabels && config.weekday_labels !== "all") {
      next = { ...fit(0), hideLabels: true };
    }

    const previous = this._metrics;
    if (
      previous &&
      previous.cell === next.cell &&
      previous.gap === next.gap &&
      previous.centred === next.centred &&
      previous.overflowing === next.overflowing &&
      previous.hideLabels === next.hideLabels
    ) {
      return;
    }
    this._metrics = next;
  }

  private _positionTip(): void {
    const index = this._activeIndex;
    const tip = this._tipEl;
    const board = this._boardEl;
    const card = this._cardEl;
    if (index === null || !tip || !board || !card) return;
    const cell = this.renderRoot.querySelector(`[data-i="${index}"]`) as HTMLElement | null;
    if (!cell) return;

    const cellRect = cell.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const halfTip = tip.offsetWidth / 2;
    const centre = cellRect.left - boardRect.left + cellRect.width / 2;
    const limit = Math.max(halfTip + 2, boardRect.width - halfTip - 2);
    const x = Math.min(Math.max(centre, halfTip + 2), limit);

    // ha-card clips its overflow, so a tooltip above a top-row cell in a
    // title-less card would be cut in half. Flip it below instead.
    const flip = cellRect.top - cardRect.top < tip.offsetHeight + 12;
    tip.classList.toggle("below", flip);
    tip.style.setProperty("--tip-x", `${x}px`);
    tip.style.setProperty(
      "--tip-y",
      `${(flip ? cellRect.bottom : cellRect.top) - boardRect.top}px`
    );
    // The caret follows the cell even after the tooltip itself was clamped
    // to stay inside the board.
    const caret = Math.max(-halfTip + 8, Math.min(halfTip - 8, centre - x));
    tip.style.setProperty("--tip-caret", `${caret}px`);
  }

  /* ----------------------------------------------------------------- render */

  private get _unit(): string {
    const config = this._config;
    if (config.unit !== undefined) return config.unit;
    const source = resolveSource(this._hass, config);
    if (source === "history") {
      const aggregate = this._effectiveAggregate;
      if (aggregate === "on_time" || aggregate === "state_time") return "h";
      if (aggregate === "on_count" || aggregate === "count") return "";
    }
    if (source === "attribute") return "";
    const first = cardEntities(config)[0];
    return (first ? this._hass?.states[first]?.attributes.unit_of_measurement : undefined) ?? "";
  }

  /**
   * Whether the breakdown panel is available. Defaults on for `state_time`,
   * which is the aggregate that exists precisely because the states have names
   * worth breaking down. Statistics and attribute sources can't offer it at
   * all — neither one carries the state text.
   */
  /** Config first, then whatever the fetch settled on, then the guess. */
  private get _effectiveAggregate(): HistoryAggregate {
    return this._config.aggregate ?? this._aggregate ?? defaultAggregate(this._hass, this._config);
  }

  private get _breakdownEnabled(): boolean {
    const config = this._config;
    if (resolveSource(this._hass, config) !== "history") return false;
    if (config.breakdown !== undefined) return config.breakdown;
    return this._effectiveAggregate === "state_time";
  }

  private get _tapAction(): TapAction {
    return this._config.tap_action ?? (this._breakdownEnabled ? "breakdown" : "none");
  }

  /**
   * Config the card can't honour, said out loud. Asking for the breakdown on a
   * statistics card is a reasonable thing to try and produces exactly nothing,
   * so it gets an explanation rather than silence — the same treatment as a
   * statistics column that doesn't exist.
   */
  private get _configWarning(): string | undefined {
    const config = this._config;
    if (config.breakdown === true && resolveSource(this._hass, config) !== "history") {
      return "The breakdown panel needs source: history — statistics and attribute data are numbers with the state text already dropped.";
    }
    return undefined;
  }

  private get _rangeNote(): string {
    const config = this._config;
    if (config.months) return `last ${config.months} months`;
    if (config.weeks) return `last ${config.weeks} weeks`;
    return `last ${config.days ?? 365} days`;
  }

  /** Config-derived custom properties, set on .wrap so the legend swatches
   * see the same ramp the cells do. */
  private _styleVars(grid: HeatGrid): string {
    const config = this._config;
    const parts: string[] = [];
    grid.colors.forEach((color, i) => parts.push(`--ah-l${i + 1}:${color}`));
    if (config.empty_color) parts.push(`--ah-empty:${config.empty_color}`);
    if (config.cell_radius !== undefined) {
      parts.push(`--ah-radius:${Math.max(0, config.cell_radius)}px`);
    }
    return parts.join(";");
  }

  private _cellClasses(cell: HeatCell, grid: HeatGrid, active: number | null, index: number): string {
    const config = this._config;
    const classes = ["cell"];
    if (cell.inRange) {
      classes.push(`lvl-${cell.level}`);
      if (cell.today && config.highlight_today !== false) classes.push("today");
      if (index === active) classes.push("active");
      if (this._selected === cell.key) classes.push("selected");
    } else if (config.align_weeks === false) {
      classes.push("blank");
    } else if (cell.date >= grid.range.today) {
      classes.push("future");
      if (config.future === "hide") classes.push("hide");
    }
    return classes.join(" ");
  }

  private _renderGrid(grid: HeatGrid): TemplateResult {
    const config = this._config;
    const active = this._activeIndex;
    const metrics = this._metrics;
    const showDayLabels =
      grid.weekdayLabels.some((label) => label !== null) && metrics?.hideLabels !== true;
    const track = metrics ? `${metrics.cell}px` : "minmax(0, 1fr)";
    // max-content, not auto: an auto track would be stretched by the grid's
    // leftover width (see justify-content in card.css.ts).
    const style = [
      `grid-template-columns:${showDayLabels ? "max-content " : ""}repeat(${grid.columns}, ${track})`,
      metrics ? `gap:${metrics.gap}px` : "",
    ]
      .filter((part) => part !== "")
      .join(";");
    this._renderedColumns = grid.columns;

    const monthRow =
      config.month_labels === false
        ? nothing
        : html`
            ${showDayLabels ? html`<div class="corner"></div>` : nothing}
            ${Array.from({ length: grid.columns }, (_, column) => {
              const label = grid.monthLabels.find((m) => m.column === column);
              return html`<div class="mlab">
                ${label ? html`<span>${label.label}</span>` : nothing}
              </div>`;
            })}
          `;

    return html`
      <div
        class=${[
          "grid",
          metrics?.centred ? "centred" : "",
          this._tapAction !== "none" ? "selectable" : "",
        ]
          .filter((part) => part !== "")
          .join(" ")}
        role="group"
        tabindex="0"
        aria-label=${this._gridLabel(grid)}
        style=${style}
        @pointerover=${this._onPointerOver}
        @pointerleave=${this._onPointerLeave}
        @click=${(e: MouseEvent) => this._onClick(e, grid)}
        @keydown=${(e: KeyboardEvent) => this._onKeydown(e, grid)}
        @focus=${() => this._onFocus(grid)}
        @blur=${this._onBlur}
      >
        ${monthRow}
        ${Array.from({ length: ROWS }, (_, row) => {
          const label = grid.weekdayLabels[row];
          return html`
            ${showDayLabels ? html`<div class="dlab">${label ?? ""}</div>` : nothing}
            ${Array.from({ length: grid.columns }, (_, column) => {
              const index = row * grid.columns + column;
              const cell = grid.cells[index];
              // Only days that actually recorded something are announced.
              // Labelling all 371 cells would make a screen reader read out
              // three hundred "no data" entries to get at a dozen facts; the
              // totals that matter are on the container's own label instead.
              const spoken = cell.inRange && cell.value !== null;
              return html`<div
                class=${this._cellClasses(cell, grid, active, index)}
                data-i=${cell.inRange ? index : nothing}
                role=${spoken ? "img" : nothing}
                aria-hidden=${spoken ? nothing : "true"}
                aria-label=${spoken ? this._cellLabel(cell, grid) : nothing}
              ></div>`;
            })}
          `;
        })}
      </div>
    `;
  }

  private _gridLabel(grid: HeatGrid): string {
    const title = this._config.title ?? "Activity";
    const total = formatValue(grid.total, grid.unit, this._config.decimals);
    return `${title} heatmap, ${this._rangeNote}: ${total} across ${grid.activeDays} of ${grid.rangeDays} days`;
  }

  private _cellLabel(cell: HeatCell, grid: HeatGrid): string {
    const date = fullDateFormatter(this._hass?.locale?.language ?? this._hass?.language).format(
      cell.date
    );
    if (cell.value === null) return `${date}: no data`;
    return `${date}: ${formatValue(cell.value, grid.unit, this._config.decimals)}`;
  }

  private _renderTip(grid: HeatGrid): TemplateResult | typeof nothing {
    if (this._config.tooltip === false) return nothing;
    const index = this._activeIndex;
    const cell = index === null ? undefined : grid.cells[index];
    // Kept in the DOM when idle so its width can be measured for clamping
    // before it's ever shown, and so showing it is a pure opacity change.
    const show = cell !== undefined && cell.inRange;
    const date = cell
      ? fullDateFormatter(this._hass?.locale?.language ?? this._hass?.language).format(cell.date)
      : "";
    return html`
      <div class=${show ? "tip show" : "tip"} role="tooltip" aria-hidden=${show ? "false" : "true"}>
        <span class="tip-value"
          >${cell && cell.value !== null
            ? formatValue(cell.value, grid.unit, this._config.decimals)
            : "No data"}</span
        >
        <span class="tip-date"> · ${date}</span>
      </div>
    `;
  }

  private _renderLegend(grid: HeatGrid): TemplateResult {
    const config = this._config;
    return html`
      <div class="legend" aria-hidden="true">
        <span>${config.legend_less ?? "Less"}</span>
        <span class="sw"></span>
        ${grid.colors.map((color) => html`<span class="sw" style=${`background:${color}`}></span>`)}
        <span>${config.legend_more ?? "More"}</span>
      </div>
    `;
  }

  /* --------------------------------------------------------------- panel */

  private get _summaryEnabled(): boolean {
    return this._config.breakdown_summary !== false;
  }

  /**
   * Two modes in one panel: the whole range by default, one day once a day is
   * clicked. Both are built from the same slice list and the same colour
   * ranking, so switching between them only changes which rows are shown —
   * never what a colour means.
   */
  private _renderPanel(grid: HeatGrid): TemplateResult | typeof nothing {
    if (!this._breakdownEnabled) return nothing;
    const key = this._selected ?? (this._summaryEnabled ? null : this._lastSelected);
    // Nothing selected, no summary wanted: the panel has nothing to say.
    if (key === null && !this._summaryEnabled) return nothing;

    const hass = this._hass;
    const darkMode = hass?.themes?.darkMode !== false;
    const overall = aggregateBreakdown(this._breakdown, grid.range);
    const day = buildBreakdown({
      key,
      summaryLabel: this._summaryHeading(),
      slices: key === null ? overall : this._breakdown?.get(key),
      // Ranked over the whole range in both modes — see aggregateBreakdown.
      ranks: ranksFrom(overall),
      palette: categoricalColors(12, darkMode),
      overrides: this._config.state_colors,
      max: this._config.breakdown_max ?? 8,
      darkMode,
      locale: hass?.locale?.language ?? hass?.language,
    });
    if (!day) return nothing;

    const isSummary = key === null;
    const open = this._selected !== null || this._summaryEnabled;

    return html`
      <div class=${open ? "slot open" : "slot"} aria-hidden=${open ? "false" : "true"}>
        <div class="panel">
          <div class="panel-inner">
            <div class="panel-head">
              <span class="panel-date">${day.label}</span>
              <span class="panel-total">${formatDuration(day.totalSeconds)}</span>
              ${isSummary
                ? // Only promise this when a click actually delivers it — with
                  // tap_action pinned to more-info, clicking a day opens the
                  // dialog and the panel stays on the summary.
                  this._tapAction === "breakdown"
                  ? html`<span class="panel-hint">Click a day for its breakdown</span>`
                  : nothing
                : html`<button
                    class="panel-close"
                    type="button"
                    aria-label=${this._summaryEnabled
                      ? "Back to the range summary"
                      : "Close breakdown"}
                    title=${this._summaryEnabled ? "Back to the range summary" : "Close"}
                    @click=${this._closePanel}
                  >
                    ✕
                  </button>`}
            </div>
            ${day.slices.length === 0
              ? html`<div class="panel-empty">
                  ${isSummary
                    ? "Nothing recorded in this range."
                    : "Nothing recorded on this day."}
                </div>`
              : this._renderSlices(day)}
          </div>
        </div>
      </div>
    `;
  }

  /** Heading for the summary mode — "Last 120 days", sentence-cased. */
  private _summaryHeading(): string {
    const note = this._rangeNote;
    return note.charAt(0).toUpperCase() + note.slice(1);
  }

  private _renderSlices(day: DayBreakdown): TemplateResult {
    return html`
      <div class="bar" role="presentation">
        ${day.slices.map(
          (slice) =>
            html`<span
              style=${`width:${(slice.share * 100).toFixed(3)}%;background:${slice.color}`}
              title=${`${slice.state} — ${formatDuration(slice.seconds)}`}
            ></span>`
        )}
      </div>
      <div class="rows">
        ${day.slices.map(
          (slice) => html`
            <div class=${slice.other ? "row other" : "row"}>
              <span class="dot" style=${`background:${slice.color}`}></span>
              <span class="name" title=${slice.state}>${slice.state}</span>
              ${slice.days !== undefined && !slice.other
                ? html`<span class="times">${slice.days} ${slice.days === 1 ? "day" : "days"}</span>`
                : slice.count > 1 && !slice.other
                  ? html`<span class="times">×${slice.count}</span>`
                  : nothing}
              <span class="dur">${formatDuration(slice.seconds)}</span>
              <span class="share">${Math.round(slice.share * 100)}%</span>
            </div>
          `
        )}
      </div>
    `;
  }

  private _renderStats(grid: HeatGrid): TemplateResult | typeof nothing {
    if (grid.stats.length === 0) return nothing;
    return html`
      <div class="stats">
        ${grid.stats.map(
          (stat) => html`
            <div class="stat">
              <div class="stat-label">${stat.label}</div>
              <div class="stat-figure">
                <span class="stat-value">${stat.value}</span>
                ${stat.detail ? html`<span class="stat-detail">${stat.detail}</span>` : nothing}
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  protected render() {
    if (!this._config || !this._hass) return nothing;
    const config = this._config;
    const hass = this._hass;

    if (cardEntities(config).length === 0) {
      return html`
        <ha-card>
          <div class="wrap">
            <div class="head"><h2 class="title">${config.title ?? "Activity heatmap"}</h2></div>
            <div class="setup">
              No entity configured yet — pick one in the card editor. A sensor with a
              <code>state_class</code> gives a full year of history; anything else falls back to
              raw recorder history, which only reaches back as far as your recorder keeps it.
            </div>
          </div>
        </ha-card>
      `;
    }

    const grid = buildGrid({
      config,
      values: this._values,
      now: this._now,
      darkMode: hass.themes?.darkMode !== false,
      locale: hass.locale?.language ?? hass.language,
      firstWeekday: hass.locale?.first_weekday,
      unit: this._unit,
    });

    const settled = this._loaded && !this._loading;
    const showEmptyNotice = settled && !this._error && !grid.hasData;

    return html`
      <ha-card>
        <div class="wrap" style=${this._styleVars(grid)}>
          ${config.title
            ? html`
                <div class="head">
                  <h2 class="title">${config.title}</h2>
                  <span class="range-note">${this._rangeNote}</span>
                </div>
              `
            : nothing}

          <div class=${this._loaded ? "board" : "board loading"}>
            <div class="scroll">${this._renderGrid(grid)}</div>
            ${this._renderTip(grid)}
          </div>

          ${this._renderPanel(grid)}

          ${grid.stats.length > 0 || config.legend !== false
            ? html`
                <div class="foot">
                  ${this._renderStats(grid)}
                  ${config.legend === false ? nothing : this._renderLegend(grid)}
                </div>
              `
            : nothing}
          ${this._error ? html`<div class="notice error">${this._error}</div>` : nothing}
          ${this._configWarning
            ? html`<div class="notice">${this._configWarning}</div>`
            : nothing}
          ${showEmptyNotice
            ? html`<div class="notice">
                ${this._notice
                  ? this._notice
                  : html`Nothing recorded in this range yet
                      ${resolveSource(hass, config) === "history"
                        ? html`— raw recorder history only goes back
                            <code>purge_keep_days</code> (10 days by default).`
                        : nothing}`}
              </div>`
            : nothing}
        </div>
      </ha-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3-activity-heatmap-card": ActivityHeatmapCard;
  }
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string; preview?: boolean }>;
  }
}

// Without this the card works via YAML but never appears in "Add Card".
window.customCards = window.customCards ?? [];
window.customCards.push({
  type: "m3-activity-heatmap-card",
  name: "M3 Activity Heatmap",
  description:
    "A GitHub-style contribution grid for any entity — one cell per day, coloured by how much happened.",
});
