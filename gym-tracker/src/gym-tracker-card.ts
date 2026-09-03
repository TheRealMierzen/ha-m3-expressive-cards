import { LitElement, html, nothing, svg } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import "./gym-tracker-card-editor";
import { cardStyles } from "./card.css";
import { computeVals, formatCurrency } from "./compute";
import { GymTrackerCardConfig, HomeAssistant } from "./types";

const DEFAULT_CONFIG: Partial<GymTrackerCardConfig> = {
  title: "Gym Tracker",
  currency: "R",
};

// SVG ring geometry: radius 42 on a 100x100 viewBox, 9-unit stroke.
const RING_RADIUS = 42;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Gap in viewBox units between the active arc and the remaining track, at
 * both ends — the circular counterpart of the M3 Expressive linear
 * indicator's active/gap/track split. The track is drawn with butt caps and
 * the active arc with round ones, so the visible gap is this minus half a
 * stroke width (10 - 4.5 = 5.5 units, about 6px at the rendered 116px). */
const RING_GAP = 10;

/** Arc lengths for the active fill and the remaining track, as
 * stroke-dasharray/dashoffset values. Either can come back null, meaning
 * "don't render that arc at all": a zero-length dash with a round cap is
 * renderer-dependent (some draw a dot), and at 100% the track has no room
 * left once both gaps are taken out. */
function ringArcs(pct: number | null): {
  active: number | null;
  track: number | null;
  trackOffset: number;
} {
  if (pct == null) {
    // Nothing measured: one plain full circle, no gaps to leave room for.
    return { active: null, track: RING_CIRCUMFERENCE, trackOffset: 0 };
  }
  const active = RING_CIRCUMFERENCE * (pct / 100);
  if (active <= 0) {
    // Nothing attained yet: a closed track circle, since there is no active
    // arc for the two gaps to separate it from.
    return { active: null, track: RING_CIRCUMFERENCE, trackOffset: 0 };
  }
  const track = RING_CIRCUMFERENCE - active - 2 * RING_GAP;
  return {
    active,
    track: track > 0 ? track : null,
    // Negative dashoffset shifts the dash forward along the path, so the
    // track starts one gap after the active arc ends.
    trackOffset: -(active + RING_GAP),
  };
}

type CostUnit = "month" | "year";

/** Only re-renders when one of the entities this card actually reads
 * changes, not on every unrelated hass update elsewhere in the system. */
function entitySignature(hass: HomeAssistant, config: GymTrackerCardConfig): string {
  const ids = [
    config.actual_counter,
    config.target_counter,
    config.adherence_sensor,
    config.monthly_cost_entity,
    config.daily_cost_entity,
    config.money_wasted_entity,
  ];
  return ids
    .map((id) => {
      if (typeof id !== "string" || id === "") return "";
      const e = hass.states[id];
      return e ? `${id}:${e.state}` : `${id}:_`;
    })
    .join("|");
}

/** Formats a monthly cost for the editable input, converted to the
 * currently-selected unit — plain number text, no currency symbol, since
 * it's meant to be typed back over. */
function formatCostInputValue(monthlyCost: number | null, unit: CostUnit): string {
  if (monthlyCost == null) return "";
  const value = unit === "year" ? monthlyCost * 12 : monthlyCost;
  return String(Math.round(value * 100) / 100);
}

@customElement("m3-gym-tracker-card")
export class GymTrackerCard extends LitElement {
  static styles = cardStyles;

  private _hass?: HomeAssistant;
  private _lastSignature = "";

  // Plain fields, not @state — they track interaction transients the
  // render output doesn't depend on directly (the input's own value
  // reflects them imperatively via updated(), not through a template
  // binding), so changing them shouldn't itself trigger a re-render.
  private _costInputFocused = false;
  private _costEditCancelled = false;

  @state() private _config!: GymTrackerCardConfig;
  @state() private _expanded = false;
  @state() private _costUnit: CostUnit = "month";

  @query('[data-ref="card-body"]') private _cardBodyEl?: HTMLElement;
  private _syncedCardBodyEl?: HTMLElement;

  @query('[data-ref="cost-input"]') private _costInputEl?: HTMLInputElement;
  private _syncedCostInputEl?: HTMLInputElement;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    // Reflects HA's actual theme setting, not the OS-level
    // prefers-color-scheme media feature — those two can disagree (HA dark
    // theme + light OS, or vice versa), and the card should follow HA.
    this.setAttribute("data-theme", hass.themes?.darkMode ? "dark" : "light");
    if (!this._config) return;
    const signature = entitySignature(hass, this._config);
    if (signature === this._lastSignature) return;
    this._lastSignature = signature;
    this.requestUpdate();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  setConfig(config: GymTrackerCardConfig): void {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._lastSignature = "";
    this._expanded = false;
    this._costUnit = "month";
    this._costInputFocused = false;
    this._costEditCancelled = false;
    this._syncedCardBodyEl = undefined;
    this._syncedCostInputEl = undefined;
  }

  static getStubConfig(): GymTrackerCardConfig {
    return {
      type: "custom:m3-gym-tracker-card",
      title: "Gym Tracker",
      actual_counter: "counter.gym_actual_counter",
      target_counter: "counter.gym_target_counter",
      adherence_sensor: "sensor.gym_adherence",
      monthly_cost_entity: "input_number.gym_monthly_cost",
      daily_cost_entity: "number.gym_daily_cost",
      money_wasted_entity: "number.gym_money_wasted",
      currency: "R",
    };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("m3-gym-tracker-card-editor");
  }

  /** data-level on the host is what the whole card's colour hangs off — the
   * ring, the leading icon and its shape morph all read the --gym-level-*
   * aliases m3.css.ts swaps here, so not one component rule has to know that
   * adherence levels exist. Set in willUpdate rather than the hass setter
   * because it depends on the thresholds in config as well as on state.
   * setAttribute on the host doesn't itself schedule a Lit update, so this
   * can't loop. */
  protected willUpdate(): void {
    const level = this._hass && this._config ? computeVals(this._hass, this._config).adherenceLevel : "unknown";
    this.setAttribute("data-level", level);
  }

  protected updated(): void {
    // A newly-mounted body (only happens once, at first render, or after a
    // config reset) needs its max-height snapped to the current
    // open/closed state with no animation — _toggleCard animates
    // explicitly and must not be fought here.
    const cardBody = this._cardBodyEl;
    if (cardBody && cardBody !== this._syncedCardBodyEl) {
      this._syncedCardBodyEl = cardBody;
      cardBody.style.maxHeight = this._expanded ? "none" : "0";
    }

    // The cost input is deliberately NOT bound via a Lit `.value=` template
    // expression — that would overwrite it on every re-render (including
    // ones triggered by an unrelated entity change) and fight whatever the
    // user is mid-typing. Instead it's synced imperatively here, and only
    // while the field isn't focused — same "don't fight an ongoing
    // interaction" rule as the collapsible bodies above, applied to a text
    // input instead of a max-height.
    const costInput = this._costInputEl;
    if (costInput && this._hass && this._config && !this._costInputFocused) {
      const v = computeVals(this._hass, this._config);
      const next = formatCostInputValue(v.monthlyCost, this._costUnit);
      if (costInput !== this._syncedCostInputEl || costInput.value !== next) {
        this._syncedCostInputEl = costInput;
        costInput.value = next;
      }
    }
  }

  /** Teardown for the expand/collapse currently running on a body element,
      so a new toggle can cancel it instead of racing it. */
  private _expandCleanups = new WeakMap<HTMLElement, () => void>();

  private _prefersReducedMotion(): boolean {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  private _animateExpand(el: HTMLElement, open: boolean): void {
    // Spammed toggles: tear down the previous run first. Its transitionend
    // listener would otherwise still be armed and fire at the end of *this*
    // animation, snapping max-height back to the superseded target — the
    // section visibly jumping to whatever the first click was heading for.
    this._expandCleanups.get(el)?.();

    if (this._prefersReducedMotion()) {
      el.style.maxHeight = open ? "none" : "0";
      return;
    }

    // Animate from the height that is on screen right now — mid-flight that
    // is somewhere between 0 and the content height, not either endpoint —
    // so an interrupted section continues from where it is instead of
    // snapping to 0 (or to full height) before moving.
    const from = el.offsetHeight;
    const to = open ? el.scrollHeight : 0;
    if (from === to) {
      el.style.maxHeight = open ? "none" : "0";
      return;
    }
    el.style.maxHeight = `${from}px`;
    void el.offsetHeight; // flush the start value so the change below transitions

    const cleanup = (): void => {
      el.removeEventListener("transitionend", onDone);
      el.removeEventListener("transitioncancel", onDone);
      this._expandCleanups.delete(el);
    };
    const onDone = (e: TransitionEvent): void => {
      if (e.target !== el || e.propertyName !== "max-height") return;
      const settled = e.type === "transitionend";
      cleanup();
      // Only a run that reached its end releases the clamp, so an open
      // section can grow with its content afterwards.
      if (open && settled) el.style.maxHeight = "none";
    };
    el.addEventListener("transitionend", onDone);
    el.addEventListener("transitioncancel", onDone);
    this._expandCleanups.set(el, cleanup);
    el.style.maxHeight = `${to}px`;
  }

  private _toggleCard(): void {
    this._expanded = !this._expanded;
    void this.updateComplete.then(() => {
      if (this._cardBodyEl) this._animateExpand(this._cardBodyEl, this._expanded);
    });
  }

  private _headerKeydown(e: KeyboardEvent): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    this._toggleCard();
  }

  private _svc(domain: string, service: string, data: Record<string, unknown>): void {
    this._hass?.callService(domain, service, data);
  }

  /** The target counter is normally driven by an automation (one tick per
   * weekday, holidays excluded) — this covers the exceptions it can't know
   * about, like a day away that shouldn't count against adherence. */
  private _stepTarget(delta: 1 | -1, e: Event): void {
    e.stopPropagation();
    const c = this._config;
    if (!c.target_counter) return;
    this._svc("counter", delta > 0 ? "increment" : "decrement", { entity_id: c.target_counter });
  }

  private _setCostUnit(unit: CostUnit): void {
    // Switching units re-derives the displayed figure from the entity's
    // actual value rather than converting whatever's currently typed —
    // simpler, and correct as long as the field isn't mid-edit when the
    // toggle is used (it's disabled-in-practice while focused, since the
    // toggle buttons themselves take focus away from the input first).
    this._costUnit = unit;
  }

  private _commitCostInput(): void {
    const c = this._config;
    const el = this._costInputEl;
    if (!c.monthly_cost_entity || !el) return;
    const raw = Number(el.value);
    if (!Number.isFinite(raw)) {
      this.requestUpdate(); // invalid text: drop it, resync from the entity
      return;
    }
    const monthly = this._costUnit === "year" ? raw / 12 : raw;
    this._svc("input_number", "set_value", {
      entity_id: c.monthly_cost_entity,
      value: Math.round(monthly * 100) / 100,
    });
  }

  private _onCostFocus(): void {
    this._costInputFocused = true;
  }

  private _onCostBlur(): void {
    this._costInputFocused = false;
    if (this._costEditCancelled) {
      this._costEditCancelled = false;
    } else {
      this._commitCostInput();
    }
    this.requestUpdate();
  }

  private _onCostKeydown(e: KeyboardEvent): void {
    const el = e.target as HTMLInputElement;
    if (e.key === "Enter") {
      e.preventDefault();
      el.blur(); // triggers _onCostBlur -> commits
    } else if (e.key === "Escape") {
      e.preventDefault();
      this._costEditCancelled = true;
      el.blur(); // triggers _onCostBlur -> discards, resyncs from the entity
    }
  }

  protected render() {
    if (!this._config || !this._hass) {
      return nothing;
    }
    const c = this._config;
    const v = computeVals(this._hass, c);
    const currency = c.currency ?? "R";

    // Money wasted now only appears in the hero money-block, not duplicated
    // in the expanded section below — so it doesn't count toward whether
    // there's anything to expand.
    const hasSettings = Boolean(c.target_counter || c.monthly_cost_entity || c.daily_cost_entity);
    const hasMoneyBlock = Boolean(c.daily_cost_entity || c.money_wasted_entity);

    const arcs = ringArcs(v.adherencePct);

    return html`
      <ha-card>
        <div class="wrap">
          <div
            class="header ${hasSettings ? "toggle" : ""}"
            tabindex=${hasSettings ? "0" : nothing}
            role=${hasSettings ? "button" : nothing}
            aria-expanded=${hasSettings ? (this._expanded ? "true" : "false") : nothing}
            aria-label=${hasSettings ? "Toggle settings" : nothing}
            @click=${() => hasSettings && this._toggleCard()}
            @keydown=${(e: KeyboardEvent) => hasSettings && this._headerKeydown(e)}
          >
            <div class="leading-icon"><ha-icon icon="mdi:dumbbell"></ha-icon></div>
            <div class="title-text">
              <div class="name m3-title-medium-emphasized">${c.title || "Gym Tracker"}</div>
              <div class="supporting m3-body-small">${v.visitsText}</div>
            </div>
            ${hasSettings
              ? html`<ha-icon
                  class="chevron ${this._expanded ? "" : "collapsed"}"
                  icon="mdi:chevron-down"
                ></ha-icon>`
              : nothing}
          </div>

          <div class="hero">
            <div
              class="ring-block"
              role="img"
              aria-label=${v.adherencePct != null
                ? `Adherence ${v.adherenceValueText} percent`
                : "Adherence unavailable"}
            >
              <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
                ${arcs.track != null
                  ? svg`
                      <circle
                        class="ring-track"
                        cx="50"
                        cy="50"
                        r=${RING_RADIUS}
                        stroke-dasharray="${arcs.track} ${RING_CIRCUMFERENCE}"
                        stroke-dashoffset=${arcs.trackOffset}
                      ></circle>
                    `
                  : nothing}
                ${arcs.active != null
                  ? svg`
                      <circle
                        class="ring-fill"
                        cx="50"
                        cy="50"
                        r=${RING_RADIUS}
                        stroke-dasharray="${arcs.active} ${RING_CIRCUMFERENCE}"
                      ></circle>
                    `
                  : nothing}
              </svg>
              <div class="ring-label">
                <div class="ring-value">
                  <span class="ring-pct m3-display-small-emphasized">${v.adherenceValueText}</span>
                  ${v.adherencePct != null
                    ? html`<span class="ring-unit m3-title-small">%</span>`
                    : nothing}
                </div>
              </div>
            </div>

            ${hasMoneyBlock
              ? html`
                  <div class="money-block">
                    ${c.daily_cost_entity
                      ? html`
                          <div class="money-row good">
                            <div class="money-badge"><ha-icon icon="mdi:trending-up"></ha-icon></div>
                            <div class="money-text">
                              <div class="money-label m3-label-medium">Invested this year</div>
                              <div class="money-value m3-title-medium-emphasized">
                                ${formatCurrency(v.moneyInvested, currency)}
                              </div>
                            </div>
                          </div>
                        `
                      : nothing}
                    ${c.money_wasted_entity
                      ? html`
                          <div class="money-row bad">
                            <div class="money-badge"><ha-icon icon="mdi:cash-remove"></ha-icon></div>
                            <div class="money-text">
                              <div class="money-label m3-label-medium">Wasted this year</div>
                              <div class="money-value m3-title-medium-emphasized">${formatCurrency(v.moneyWasted, currency)}</div>
                            </div>
                          </div>
                        `
                      : nothing}
                  </div>
                `
              : nothing}
          </div>

          ${hasSettings
            ? html`
                <div class="card-body" data-ref="card-body" style="max-height:0">
                  <div class="section">
                    <div class="section-title m3-label-large-emphasized">Settings</div>
                    ${c.target_counter
                      ? html`
                          <div class="row">
                            <span class="m3-body-medium">Visit target</span>
                            <div class="button-group">
                              <button
                                class="segment"
                                type="button"
                                title="Decrease target by one day (e.g. travel)"
                                aria-label="Decrease visit target"
                                @click=${(e: Event) => this._stepTarget(-1, e)}
                              >
                                <ha-icon icon="mdi:minus"></ha-icon>
                              </button>
                              <span class="segment value m3-title-small">${v.target ?? "—"}</span>
                              <button
                                class="segment"
                                type="button"
                                title="Increase target by one day"
                                aria-label="Increase visit target"
                                @click=${(e: Event) => this._stepTarget(1, e)}
                              >
                                <ha-icon icon="mdi:plus"></ha-icon>
                              </button>
                            </div>
                          </div>
                        `
                      : nothing}
                    ${c.monthly_cost_entity
                      ? html`
                          <div class="row">
                            <span class="m3-body-medium">Membership cost</span>
                            <div class="button-group">
                              <button
                                class="segment unit m3-label-medium ${this._costUnit === "month" ? "selected" : ""}"
                                type="button"
                                aria-pressed=${this._costUnit === "month" ? "true" : "false"}
                                @click=${() => this._setCostUnit("month")}
                              >
                                /mo
                              </button>
                              <button
                                class="segment unit m3-label-medium ${this._costUnit === "year" ? "selected" : ""}"
                                type="button"
                                aria-pressed=${this._costUnit === "year" ? "true" : "false"}
                                @click=${() => this._setCostUnit("year")}
                              >
                                /yr
                              </button>
                              <input
                                class="segment cost-input m3-title-small"
                                data-ref="cost-input"
                                type="number"
                                inputmode="decimal"
                                step="0.01"
                                aria-label=${this._costUnit === "year"
                                  ? "Membership cost per year"
                                  : "Membership cost per month"}
                                @focus=${() => this._onCostFocus()}
                                @blur=${() => this._onCostBlur()}
                                @keydown=${(e: KeyboardEvent) => this._onCostKeydown(e)}
                              />
                            </div>
                          </div>
                        `
                      : nothing}
                    ${c.daily_cost_entity
                      ? html`
                          <div class="row">
                            <span class="m3-body-medium">Daily cost</span>
                            <span class="value-readout m3-title-small">
                              ${formatCurrency(v.dailyCost, currency)}
                            </span>
                          </div>
                        `
                      : nothing}
                  </div>
                </div>
              `
            : nothing}
        </div>
      </ha-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3-gym-tracker-card": GymTrackerCard;
  }
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string; preview?: boolean }>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "m3-gym-tracker-card",
  name: "M3 Gym Tracker Card",
  description: "Gym visit adherence ring, money-wasted stat, and editable target/cost settings",
});
