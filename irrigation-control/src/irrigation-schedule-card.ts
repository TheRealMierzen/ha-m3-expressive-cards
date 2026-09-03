import { LitElement, html, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import "./irrigation-schedule-card-editor";
import { cardStyles } from "./card.css";
import { computeVals, minutesToHms } from "./compute";
import { HomeAssistant, IrrigationScheduleCardConfig } from "./types";

const DEFAULT_CONFIG: Partial<IrrigationScheduleCardConfig> = {
  title: "Irrigation",
};

/** Only re-renders when one of the entities this card actually reads
 * changes, not on every unrelated hass update elsewhere in the system. */
function entitySignature(hass: HomeAssistant, config: IrrigationScheduleCardConfig): string {
  const ids = [config.automation, config.should_water, config.start_time, config.stop_time, config.duration, config.timer, config.valve];
  return ids
    .map((id) => {
      if (typeof id !== "string" || id === "") return "";
      const e = hass.states[id];
      if (!e) return `${id}:_`;
      return `${id}:${e.state}:${e.last_changed ?? ""}:${e.attributes.finishes_at ?? ""}:${e.attributes.duration ?? ""}:${e.attributes.remaining ?? ""}`;
    })
    .join("|");
}

@customElement("m3-irrigation-schedule-card")
export class IrrigationScheduleCard extends LitElement {
  static styles = cardStyles;

  private _hass?: HomeAssistant;
  private _lastSignature = "";
  private _tickInterval?: ReturnType<typeof setInterval>;

  @state() private _config!: IrrigationScheduleCardConfig;
  @state() private _now = new Date();
  @state() private _mainOpen = false;
  @state() private _scheduleOpen = false;

  @query('[data-ref="card-body"]') private _cardBodyEl?: HTMLElement;
  private _syncedCardBodyEl?: HTMLElement;

  @query('[data-ref="schedule-body"]') private _scheduleBodyEl?: HTMLElement;
  private _syncedScheduleBodyEl?: HTMLElement;

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
    this._syncCountdownTicker(hass);
    this.requestUpdate();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  /** Live per-second countdown only runs while the timer is actually
   * active — no interval at all otherwise, so idle cards don't tick. */
  private _syncCountdownTicker(hass: HomeAssistant): void {
    const v = computeVals(hass, this._config, this._now);
    if (v.timerActive && !this._tickInterval) {
      this._tickInterval = setInterval(() => {
        this._now = new Date();
      }, 1000);
    } else if (!v.timerActive && this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = undefined;
    }
  }

  setConfig(config: IrrigationScheduleCardConfig): void {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._lastSignature = "";
    this._mainOpen = false;
    this._scheduleOpen = false;
    this._syncedCardBodyEl = undefined;
    this._syncedScheduleBodyEl = undefined;
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = undefined;
    }
  }

  static getStubConfig(): IrrigationScheduleCardConfig {
    return { type: "custom:m3-irrigation-schedule-card", title: "Irrigation" };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("m3-irrigation-schedule-card-editor");
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = undefined;
    }
  }

  protected updated(): void {
    // Newly-mounted bodies (only happens once, at first render, or after a
    // config reset) need their max-height snapped to the current
    // open/closed state with no animation — _toggleMain/_toggleSchedule
    // animate explicitly and must not be fought here.
    const cardBody = this._cardBodyEl;
    if (cardBody && cardBody !== this._syncedCardBodyEl) {
      this._syncedCardBodyEl = cardBody;
      cardBody.style.maxHeight = this._mainOpen ? "none" : "0";
    }
    const scheduleBody = this._scheduleBodyEl;
    if (scheduleBody && scheduleBody !== this._syncedScheduleBodyEl) {
      this._syncedScheduleBodyEl = scheduleBody;
      scheduleBody.style.maxHeight = this._scheduleOpen ? "none" : "0";
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

  private _toggleMain(): void {
    this._mainOpen = !this._mainOpen;
    void this.updateComplete.then(() => {
      if (this._cardBodyEl) this._animateExpand(this._cardBodyEl, this._mainOpen);
    });
  }

  private _headerKeydown(e: KeyboardEvent): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    this._toggleMain();
  }

  private _toggleSchedule(): void {
    this._scheduleOpen = !this._scheduleOpen;
    void this.updateComplete.then(() => {
      if (this._scheduleBodyEl) this._animateExpand(this._scheduleBodyEl, this._scheduleOpen);
    });
  }

  private _scheduleKeydown(e: KeyboardEvent): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    this._toggleSchedule();
  }

  private _svc(domain: string, service: string, data: Record<string, unknown>): void {
    this._hass?.callService(domain, service, data);
  }

  private _toggleAutomation(turnOn: boolean, e: Event): void {
    e.stopPropagation();
    const automation = this._config.automation;
    if (!automation) return;
    this._svc("automation", turnOn ? "turn_on" : "turn_off", { entity_id: automation });
  }

  /** The one rule this card exists to enforce: the valve is never toggled
   * without also starting/cancelling its paired timer. */
  private _toggleValve(e: Event): void {
    e.stopPropagation();
    const c = this._config;
    if (!c.valve || !this._hass) return;
    const v = computeVals(this._hass, c, this._now);

    if (v.valveOn) {
      this._svc("switch", "turn_off", { entity_id: c.valve });
      if (c.timer) this._svc("timer", "cancel", { entity_id: c.timer });
    } else {
      this._svc("switch", "turn_on", { entity_id: c.valve });
      if (c.timer) {
        const data: Record<string, unknown> = { entity_id: c.timer };
        if (v.durationMinutes != null) data.duration = minutesToHms(v.durationMinutes);
        this._svc("timer", "start", data);
      }
    }
  }

  protected render() {
    if (!this._config || !this._hass) {
      return nothing;
    }
    const c = this._config;
    const v = computeVals(this._hass, c, this._now);
    const hasAuto = Boolean(c.automation);

    let subtitleText: string | typeof nothing = nothing;
    if (c.should_water && v.shouldWater != null) {
      if (v.shouldWater) {
        subtitleText = c.start_time && v.startText ? `Watering today at ${v.startText}` : "Watering scheduled today";
      } else {
        subtitleText = "Skipping today";
      }
    }

    const showSchedule = Boolean((c.start_time || c.stop_time || c.duration) && v.shouldWater !== false);
    const showTimer = Boolean(c.timer && (v.timerActive || v.timerPaused));
    // The card's active state is the valve being open, not the automation
    // being enabled — that's the thing worth noticing at a glance.
    const watering = v.valveOn || v.timerActive;

    return html`
      <ha-card class=${watering ? "watering" : ""}>
        <div class="wrap">
          <div
            class="header"
            tabindex="0"
            role="button"
            aria-expanded=${this._mainOpen ? "true" : "false"}
            aria-label="Toggle card"
            @click=${() => this._toggleMain()}
            @keydown=${(e: KeyboardEvent) => this._headerKeydown(e)}
          >
            <div class="leading-icon">
              <ha-icon icon=${watering ? "mdi:sprinkler-variant" : "mdi:water-outline"}></ha-icon>
            </div>
            <div class="title-text">
              <div class="name m3-title-medium-emphasized">${c.title || "Irrigation"}</div>
              <div class="supporting m3-body-small">${subtitleText}</div>
            </div>
            ${hasAuto
              ? html`
                  <div class="header-actions" @click=${(e: Event) => e.stopPropagation()}>
                    ${this._switch(
                      v.automationEnabled,
                      v.automationEnabled ? "Disable AI scheduling" : "Enable AI scheduling",
                      (e: Event) => this._toggleAutomation(!v.automationEnabled, e)
                    )}
                  </div>
                `
              : nothing}
          </div>

          <div class="card-body" data-ref="card-body" style="max-height:0">
            ${showTimer
              ? html`
                  <div class="section">
                    <div class="timer-row m3-body-small">
                      <span>${v.timerPaused ? "Paused" : "Watering now"}</span>
                      <span class="timer-countdown m3-title-small">${v.timerCountdownText}</span>
                    </div>
                    ${this._waveProgress(v.timerProgressPercent, v.timerPaused)}
                  </div>
                `
              : nothing}
            ${c.valve
              ? html`
                  <div class="section">
                    <div class="row">
                      <div class="valve-info">
                        <div class="valve-label m3-body-medium">Valve</div>
                        <div class="valve-meta m3-body-small">Last watered: ${v.lastWateredText}</div>
                      </div>
                      ${this._switch(v.valveOn, v.valveOn ? "Close valve" : "Open valve", (e: Event) =>
                        this._toggleValve(e)
                      )}
                    </div>
                  </div>
                `
              : nothing}
            ${showSchedule
              ? html`
                  <div class="section">
                    <div class="schedule-section${this._scheduleOpen ? "" : " collapsed"}">
                      <div
                        class="section-title toggle m3-label-large-emphasized"
                        tabindex="0"
                        role="button"
                        aria-expanded=${this._scheduleOpen ? "true" : "false"}
                        @click=${() => this._toggleSchedule()}
                        @keydown=${(e: KeyboardEvent) => this._scheduleKeydown(e)}
                      >
                        <span>Schedule</span>
                        <ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon>
                      </div>
                      <div class="schedule-body" data-ref="schedule-body" style="max-height:0">
                        <div class="schedule-body-inner">
                          <div class="schedule-grid">
                            ${c.start_time
                              ? this._tile("mdi:clock-start", "Start", v.startText ?? "—")
                              : nothing}
                            ${c.stop_time ? this._tile("mdi:clock-end", "Stop", v.stopText ?? "—") : nothing}
                            ${c.duration
                              ? this._tile("mdi:timer-outline", "Duration", v.durationText ?? "—")
                              : nothing}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                `
              : nothing}
          </div>
        </div>
      </ha-card>
    `;
  }

  /** M3 switch, rendered from one helper and shared by the scheduling
   * automation and the valve so the two are visibly the same control. */
  private _switch(isOn: boolean, label: string, onClick: (e: Event) => void) {
    return html`
      <button
        type="button"
        class="m3-switch ${isOn ? "on" : ""}"
        role="switch"
        aria-checked=${isOn ? "true" : "false"}
        aria-label=${label}
        title=${label}
        @click=${onClick}
      >
        <span class="m3-switch-thumb"><ha-icon icon="mdi:check"></ha-icon></span>
      </button>
    `;
  }

  /** M3 Expressive wavy linear progress: wavy active track, a 4px gap, the
   * flat remaining track, and a stop indicator at full scale. Flattens to
   * the plain linear indicator when paused, because an animated wave should
   * only ever mean work actually in progress.
   *
   * Note this bar *drains*: computeVals gives remaining/total, so it starts
   * full and empties as the timer runs down. That is the original card's
   * choice and the conventional reading of a countdown, so it is preserved —
   * but it means the wave shrinks rather than grows, which is the opposite
   * of what the M3 recipe's name suggests.
   *
   * calc(0% - 4px) clamps to 0 and a negative track width clamps to 0, so
   * both ends of the range need no special-casing. */
  private _waveProgress(percent: number, paused: boolean) {
    const p = Math.min(100, Math.max(0, percent));
    return html`
      <div class="wave ${paused ? "flat" : ""}">
        <div class="wave-active" style="width:calc(${p}% - 4px)"></div>
        <div class="wave-track" style="left:calc(${p}% + 4px)"></div>
        ${p < 99.5 ? html`<div class="wave-stop"></div>` : nothing}
      </div>
    `;
  }

  private _tile(icon: string, label: string, value: string) {
    return html`
      <div class="tile">
        <div class="tile-label m3-label-medium"><ha-icon icon=${icon}></ha-icon><span>${label}</span></div>
        <div class="tile-value m3-title-small-emphasized">${value}</div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3-irrigation-schedule-card": IrrigationScheduleCard;
  }
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string; preview?: boolean }>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "m3-irrigation-schedule-card",
  name: "M3 Irrigation Schedule Card",
  description: "AI-scheduled irrigation status with live countdown and safe manual valve override",
});
