import { LitElement, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./schedule-timeline-card-editor";
import { cardStyles } from "./card.css";
import { readableTextColor } from "./palette";
import { resolveEntities } from "./resolve-entities";
import { fetchScheduleBlocks } from "./schedule-service";
import { buildLanes } from "./timeline-renderer";
import {
  HomeAssistant,
  LayoutBlock,
  LayoutLane,
  ScheduleBlocksByEntity,
  ScheduleTimelineCardConfig,
  Weekday,
} from "./types";
import {
  MINUTES_PER_DAY,
  blockDurationMinutes,
  formatDuration,
  formatMinutes,
  weekdayFromDate,
  weekdayLabel,
  windowMinutesToPercent,
} from "./time-utils";

const NOW_REFRESH_MS = 30_000;
/** How far the range-extend buttons can pull in hours from the adjacent
 * day, each direction, before they disable themselves. 24h means the
 * window can grow to at most a 3-calendar-day span (yesterday's tail,
 * all of today, tomorrow's head) — enough for real overnight-context
 * viewing without sliding into full multi-day-scroller territory. */
const MAX_EXTENSION_HOURS = 24;
/** Candidate tick spacings the ruler snaps to, in hours. */
const NICE_TICK_HOURS = [1, 2, 3, 4, 6, 8, 12, 24];

/** Card padding (16px a side) plus the gap between a lane's label and its
 * track — the chrome between the host's width and the track's. */
const TRACK_INSET_PX = 16 * 2 + 10;

/** Horizontal room one tick label needs before it touches its neighbour.
 * "00:00" at the label-small size measures about 30px; the rest is the
 * breathing space that keeps them reading as separate labels. */
const TICK_LABEL_MIN_PX = 48;

/**
 * HA cards can end up in a narrow dashboard column or on a phone screen.
 * Fixed hourly ticks would overlap into unreadable mush at those widths, so
 * thin them out based on the card's actual measured width rather than the
 * viewport (a ResizeObserver on the host, since dashboard column width has
 * nothing to do with the browser window size). Picks a "nice" whole-hour
 * spacing for the current window size (which can be wider than 24h once
 * hours have been pulled in from an adjacent day) so gridlines/labels stay
 * evenly spaced and land on clean hour boundaries.
 *
 * Takes the *track* width, not the host width. Those differ by the card
 * padding and the whole lane-label column — over 140px of it on a wide card
 * — and sizing off the host meant a 320px card asked for five ticks in a
 * 162px track and drew them on top of each other. Deriving the count from a
 * minimum per-label width also means it keeps working if the label column or
 * the type scale changes, instead of needing its breakpoints re-tuned.
 */
function chooseTickIntervalMinutes(windowMinutes: number, trackWidth: number): number {
  const maxTicks = Math.max(2, Math.floor(trackWidth / TICK_LABEL_MIN_PX) + 1);
  const rawHours = windowMinutes / 60 / (maxTicks - 1);
  const chosenHours = NICE_TICK_HOURS.find((h) => h >= rawHours) ?? 24;
  return chosenHours * 60;
}

/** Ticks always start exactly at windowStart, which is itself always a
 * whole hour (extension happens in whole-hour steps) — so stepping by a
 * whole-hour interval lands on clean hour boundaries with no rounding, and
 * the CSS gridline gradient (also starting at 0%) lines up automatically. */
function generateTicks(
  windowStartMinutes: number,
  windowEndMinutes: number,
  intervalMinutes: number
): number[] {
  const ticks: number[] = [];
  for (let t = windowStartMinutes; t <= windowEndMinutes; t += intervalMinutes) {
    ticks.push(t);
  }
  return ticks;
}

/** Same idea as chooseTickIntervalMinutes: give the label column a bit more
 * room on wider cards (real entity names run longer than "Gym"), a bit less
 * on narrow ones where the track needs the space more. */
function laneLabelWidthForWidth(width: number): number {
  if (width < 320) return 96;
  if (width < 480) return 116;
  return 140;
}

@customElement("m3-schedule-timeline-card")
export class ScheduleTimelineCard extends LitElement {
  static styles = cardStyles;

  private _hass?: HomeAssistant;
  private _lastSignature = "";
  private _nowTimer?: ReturnType<typeof setInterval>;
  private _resizeObserver?: ResizeObserver;

  @state() private _config!: ScheduleTimelineCardConfig;
  @state() private _dayOffset = 0;
  @state() private _leadHours = 0;
  @state() private _trailHours = 0;
  @state() private _hidden: Set<string> = new Set();
  @state() private _now = new Date();
  @state() private _hostWidth = 480;
  @state() private _scheduleBlocks: ScheduleBlocksByEntity = new Map();

  /**
   * HA replaces the whole `hass` object on any state change anywhere in the
   * system, not just for entities this card cares about. Re-rendering the
   * timeline on every unrelated change would be wasteful, so this only
   * requests an update when a schedule.* entity actually changed.
   */
  set hass(hass: HomeAssistant) {
    const signature = computeScheduleSignature(hass);
    this._hass = hass;
    // Reflects HA's actual theme setting, not the OS-level
    // prefers-color-scheme media feature — those two can disagree (HA dark
    // theme + light OS, or vice versa), and the card should follow HA.
    this.setAttribute("data-theme", hass.themes?.darkMode ? "dark" : "light");
    if (signature !== this._lastSignature) {
      this._lastSignature = signature;
      this.requestUpdate();
      void this._refreshScheduleBlocks(hass);
    }
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  private async _refreshScheduleBlocks(hass: HomeAssistant): Promise<void> {
    const entityIds = Object.keys(hass.states).filter((id) => id.startsWith("schedule."));
    try {
      this._scheduleBlocks = await fetchScheduleBlocks(hass, entityIds);
    } catch (err) {
      console.error("schedule-timeline-card: failed to fetch schedule blocks", err);
    }
  }

  setConfig(config: ScheduleTimelineCardConfig): void {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this._config = { short_block_minutes: 10, ...config };
    this._hidden = new Set(config.default_hidden ?? []);
    try {
      const stored = localStorage.getItem(this._storageKey());
      if (stored) {
        this._hidden = new Set(JSON.parse(stored));
      }
    } catch {
      // localStorage unavailable / corrupt value: fall back to default_hidden.
    }
  }

  static getStubConfig(): ScheduleTimelineCardConfig {
    return { type: "custom:m3-schedule-timeline-card", title: "Daily Schedule" };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("m3-schedule-timeline-card-editor");
  }

  getGridOptions() {
    return {
      columns: 12,
      rows: this.getCardSize(),
      min_rows: 2,
    };
  }

  getCardSize(): number {
    if (!this._hass || !this._config) {
      return 3;
    }
    const laneCount = resolveEntities(this._hass, this._config, false).filter(
      (e) => !this._hidden.has(e.entityId)
    ).length;
    return Math.max(2, 2 + Math.ceil(laneCount / 2));
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._nowTimer = setInterval(() => {
      this._now = new Date();
    }, NOW_REFRESH_MS);
    this._resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined && Math.abs(width - this._hostWidth) > 2) {
        this._hostWidth = width;
      }
    });
    this._resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._nowTimer !== undefined) {
      clearInterval(this._nowTimer);
    }
    this._resizeObserver?.disconnect();
  }

  protected render() {
    if (!this._config || !this._hass) {
      return nothing;
    }

    const darkMode = Boolean(this._hass.themes?.darkMode);
    const allEntities = resolveEntities(this._hass, this._config, darkMode, this._scheduleBlocks);
    const visible = allEntities.filter((e) => !this._hidden.has(e.entityId));

    const windowStartMinutes = -this._leadHours * 60;
    const windowEndMinutes = MINUTES_PER_DAY + this._trailHours * 60;
    const windowMinutes = windowEndMinutes - windowStartMinutes;

    const lanes = buildLanes(
      visible,
      this._viewedWeekday,
      this._config.short_block_minutes ?? 10,
      windowStartMinutes,
      windowEndMinutes
    );

    const currentMinutesOfDay = this._now.getHours() * 60 + this._now.getMinutes();
    const nowAbsoluteMinutes = -this._dayOffset * MINUTES_PER_DAY + currentMinutesOfDay;
    const nowPercent =
      nowAbsoluteMinutes >= windowStartMinutes && nowAbsoluteMinutes <= windowEndMinutes
        ? windowMinutesToPercent(nowAbsoluteMinutes, windowStartMinutes, windowEndMinutes)
        : null;

    // Label column first: the tick density depends on what's left over.
    const laneLabelWidth = laneLabelWidthForWidth(this._hostWidth);
    const trackWidth = Math.max(0, this._hostWidth - TRACK_INSET_PX - laneLabelWidth);
    const tickInterval = chooseTickIntervalMinutes(windowMinutes, trackWidth);
    const ticks = generateTicks(windowStartMinutes, windowEndMinutes, tickInterval);
    // Ticks are always evenly spaced (see generateTicks), so one interval
    // size draws every hour gridline via a single CSS gradient.
    const tickIntervalPercent = (tickInterval / windowMinutes) * 100;

    return html`
      <ha-card
        style="--tick-interval: ${tickIntervalPercent}%; --lane-label-width: ${laneLabelWidth}px"
      >
        <div class="header">
          <div class="title m3-title-medium-emphasized">
            ${this._config.title ?? "Schedule Timeline"}
          </div>
          <div class="day-switch">
            <button
              class="outlined-button m3-label-medium"
              type="button"
              ?disabled=${this._leadHours >= MAX_EXTENSION_HOURS}
              title="Pull in the previous hour"
              aria-label="Pull in the previous hour"
              @click=${() => this._pullInEarlierHour()}
            >
              +1h
            </button>
            <button
              class="icon-button"
              type="button"
              @click=${() => this._shiftDay(-1)}
              aria-label="Previous day"
            >
              <ha-icon icon="mdi:chevron-left"></ha-icon>
            </button>
            <span class="day-label m3-label-large">${this._dayLabel}</span>
            <button
              class="icon-button"
              type="button"
              @click=${() => this._shiftDay(1)}
              aria-label="Next day"
            >
              <ha-icon icon="mdi:chevron-right"></ha-icon>
            </button>
            <button
              class="outlined-button m3-label-medium"
              type="button"
              ?disabled=${this._trailHours >= MAX_EXTENSION_HOURS}
              title="Pull in the next hour"
              aria-label="Pull in the next hour"
              @click=${() => this._pullInLaterHour()}
            >
              +1h
            </button>
          </div>
        </div>

        ${this._rangeSummary
          ? html`
              <div class="range-extend m3-body-small">
                <span class="range-summary">${this._rangeSummary}</span>
                <button
                  class="text-button m3-label-medium"
                  type="button"
                  @click=${() => this._resetExtension()}
                >
                  Reset
                </button>
              </div>
            `
          : nothing}

        ${allEntities.length === 0
          ? html`<div class="empty m3-body-medium">No schedule helpers found.</div>`
          : html`
              <div class="chips">
                ${allEntities.length > 1
                  ? html`
                      <button
                        class="text-button m3-label-medium"
                        type="button"
                        @click=${() => this._setHidden(new Set())}
                      >
                        Show all
                      </button>
                      <span class="chip-action-divider"></span>
                      <button
                        class="text-button m3-label-medium"
                        type="button"
                        @click=${() =>
                          this._setHidden(new Set(allEntities.map((e) => e.entityId)))}
                      >
                        Hide all
                      </button>
                      <span class="chip-action-divider"></span>
                    `
                  : nothing}
                ${allEntities.map(
                  (e) => html`
                    <button
                      class="chip m3-label-medium ${this._hidden.has(e.entityId) ? "hidden" : ""}"
                      type="button"
                      role="switch"
                      aria-checked=${this._hidden.has(e.entityId) ? "false" : "true"}
                      @click=${() => this._toggleHidden(e.entityId)}
                    >
                      <span class="chip-dot" style="background:${e.color}"></span>
                      <span class="chip-label">${e.label}</span>
                    </button>
                  `
                )}
              </div>

              ${visible.length === 0
                ? html`<div class="empty m3-body-medium">All helpers are hidden — toggle one above.</div>`
                : html`
                    <div class="ruler">
                      <div class="ruler-label"></div>
                      <div class="ruler-track">
                        ${ticks.map((t, i) => {
                          const percent = windowMinutesToPercent(
                            t,
                            windowStartMinutes,
                            windowEndMinutes
                          );
                          return html`
                            <span
                              class="ruler-tick m3-label-small"
                              style="left:${percent}%; transform:${tickTransformForIndex(
                                i,
                                ticks.length,
                                percent
                              )}"
                              >${formatMinutes(t)}</span
                            >
                          `;
                        })}
                      </div>
                    </div>
                    <div class="lanes">
                      ${lanes.map((lane) => this._renderLane(lane, nowPercent))}
                    </div>
                  `}
            `}
      </ha-card>
    `;
  }

  private _renderLane(lane: LayoutLane, nowPercent: number | null) {
    return html`
      <div class="lane">
        <button
          class="lane-label m3-body-small"
          type="button"
          title=${lane.entityId}
          aria-label=${`${lane.label} — open schedule editor`}
          @click=${() => this._openMoreInfo(lane.entityId)}
        >
          ${lane.icon ? html`<ha-icon icon=${lane.icon}></ha-icon>` : nothing}
          <span>${lane.label}</span>
        </button>
        <div class="lane-track" @click=${() => this._openMoreInfo(lane.entityId)}>
          ${lane.blocks.length === 0
            ? html`<div class="empty-lane-hint"><span class="m3-label-small">No blocks today</span></div>`
            : nothing}
          ${lane.blocks.map((block) => this._renderBlock(lane, block))}
          ${nowPercent !== null
            ? html`<div class="now-line" style="left:${nowPercent}%"></div>`
            : nothing}
        </div>
      </div>
    `;
  }

  private _renderBlock(lane: LayoutLane, block: LayoutBlock) {
    const fromLabel = trimSeconds(block.from);
    const toLabel = trimSeconds(block.to);
    const title = `${lane.label}: ${fromLabel}–${toLabel}`;

    if (block.kind === "trigger") {
      const center = block.startPercent + block.widthPercent / 2;
      const labelOnLeft = center > 88;
      return html`
        <div
          class="trigger-marker"
          style="left:${center}%; background:${lane.color}"
          title=${title}
        ></div>
        <span
          class="trigger-label m3-label-small ${labelOnLeft ? "trigger-label-left" : ""}"
          style="left:${center}%"
          >${fromLabel}</span
        >
      `;
    }

    const classes = ["block"];
    if (block.clippedAtStart) classes.push("clipped-start");
    if (block.clippedAtEnd) classes.push("clipped-end");

    // A block clipped by the edge of the visible window shows an arrow
    // toward whatever's off-screen, rather than repeating a duration that
    // belongs to the whole (unclipped) event on both fragments. "range" and
    // "arrow" get their own CSS container-query thresholds (see
    // card.css.ts) since they're different lengths and a shared threshold
    // would either clip the longer one or hide the shorter one needlessly.
    let rangeText: string;
    let rangeVariant: "range" | "arrow";
    let showDuration = false;
    if (block.clippedAtStart) {
      rangeText = `→ ${toLabel}`;
      rangeVariant = "arrow";
    } else if (block.clippedAtEnd) {
      rangeText = `${fromLabel} →`;
      rangeVariant = "arrow";
    } else {
      rangeText = `${fromLabel}–${toLabel}`;
      rangeVariant = "range";
      showDuration = true;
    }
    const textColor = readableTextColor(lane.color);
    // A block clipped at the end of the window always ends exactly at that
    // edge by definition — pin it with `right: 0` instead of a computed
    // width, so it can't drift past the track from left% and width% being
    // rounded to the pixel independently by the browser.
    const positionStyle = block.clippedAtEnd
      ? `left:${block.startPercent}%; right: 0;`
      : `left:${block.startPercent}%; width:${block.widthPercent}%;`;

    return html`
      <div
        class=${classes.join(" ")}
        style="${positionStyle} background:${lane.color}"
        title=${title}
      >
        <span class="block-label m3-label-small ${rangeVariant}" style="color:${textColor}"
          >${rangeText}</span
        >
        ${showDuration
          ? html`<span class="block-duration m3-label-small" style="color:${textColor}"
              >· ${formatDuration(blockDurationMinutes(block.from, block.to))}</span
            >`
          : nothing}
      </div>
    `;
  }

  private _shiftDay(delta: number): void {
    this._dayOffset += delta;
    this._leadHours = 0;
    this._trailHours = 0;
  }

  private _pullInEarlierHour(): void {
    if (this._leadHours < MAX_EXTENSION_HOURS) {
      this._leadHours += 1;
    }
  }

  private _pullInLaterHour(): void {
    if (this._trailHours < MAX_EXTENSION_HOURS) {
      this._trailHours += 1;
    }
  }

  private _resetExtension(): void {
    this._leadHours = 0;
    this._trailHours = 0;
  }

  private get _rangeSummary(): string | null {
    if (this._leadHours === 0 && this._trailHours === 0) {
      return null;
    }
    const parts: string[] = [];
    if (this._leadHours > 0) {
      parts.push(`${formatMinutes(-this._leadHours * 60)} yesterday`);
    }
    if (this._trailHours > 0) {
      parts.push(`${formatMinutes(MINUTES_PER_DAY + this._trailHours * 60)} tomorrow`);
    }
    return parts.join(" – ");
  }

  private get _viewedDate(): Date {
    const d = new Date();
    d.setDate(d.getDate() + this._dayOffset);
    return d;
  }

  private get _viewedWeekday(): Weekday {
    return weekdayFromDate(this._viewedDate);
  }

  private get _dayLabel(): string {
    if (this._dayOffset === 0) return "Today";
    if (this._dayOffset === -1) return "Yesterday";
    if (this._dayOffset === 1) return "Tomorrow";
    return weekdayLabel(this._viewedWeekday);
  }

  private _toggleHidden(entityId: string): void {
    const next = new Set(this._hidden);
    if (next.has(entityId)) {
      next.delete(entityId);
    } else {
      next.add(entityId);
    }
    this._setHidden(next);
  }

  private _setHidden(next: Set<string>): void {
    this._hidden = next;
    try {
      localStorage.setItem(this._storageKey(), JSON.stringify([...next]));
    } catch {
      // localStorage unavailable (private browsing, quota): filter state just won't persist.
    }
  }

  private _storageKey(): string {
    return `schedule-timeline-card:hidden:${this._config.title ?? "default"}`;
  }

  private _openMoreInfo(entityId: string): void {
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      })
    );
  }
}

function tickTransformForIndex(index: number, count: number, percent: number): string {
  if (index === 0) return "translateX(0)";
  if (index === count - 1 && percent >= 99.9) return "translateX(-100%)";
  return "translateX(-50%)";
}

function trimSeconds(time: string): string {
  return time.slice(0, 5);
}

function computeScheduleSignature(hass: HomeAssistant): string {
  const ids = Object.keys(hass.states)
    .filter((id) => id.startsWith("schedule."))
    .sort();
  const entitiesSignature = ids
    .map((id) => {
      const entity = hass.states[id];
      return `${id}:${entity.state}:${JSON.stringify(entity.attributes)}`;
    })
    .join("|");
  return `dark=${Boolean(hass.themes?.darkMode)}|${entitiesSignature}`;
}

declare global {
  interface HTMLElementTagNameMap {
    "m3-schedule-timeline-card": ScheduleTimelineCard;
  }
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string; preview?: boolean }>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "m3-schedule-timeline-card",
  name: "M3 Schedule Timeline Card",
  description: "Visualize schedule.* helpers as a single timeline",
});
