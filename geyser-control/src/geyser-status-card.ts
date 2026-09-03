import { LitElement, html, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import "./geyser-status-card-editor";
import { cardStyles } from "./card.css";
import { clamp, computeVals } from "./compute";
import { GeyserStatusCardConfig, HomeAssistant } from "./types";

const DEFAULT_CONFIG: Partial<GeyserStatusCardConfig> = {
  title: "Geyser",
};

/** Only re-renders when one of the entities this card actually reads
 * changes, not on every unrelated hass update elsewhere in the system. */
function entitySignature(hass: HomeAssistant, config: GeyserStatusCardConfig): string {
  const ids = [
    config.switch,
    config.current_temp,
    config.target_temp,
    config.time_to_heat,
    config.next_shower,
    config.heating_automation,
    config.efficiency,
    config.shower_override_switch,
    config.default_shower_time,
  ];
  return ids
    .map((id) => {
      if (typeof id !== "string" || id === "") return "";
      const e = hass.states[id];
      return e ? `${id}:${e.state}` : `${id}:_`;
    })
    .join("|");
}

@customElement("m3-geyser-status-card")
export class GeyserStatusCard extends LitElement {
  static styles = cardStyles;

  private _hass?: HomeAssistant;
  private _lastSignature = "";
  /** Last next_shower state actually observed, so a *change* can be told
   * apart from the first value this card ever sees. */
  private _lastNextShowerState?: string;

  @state() private _config!: GeyserStatusCardConfig;
  @state() private _mainOpen = false;
  @state() private _settingsOpen = false;
  @state() private _detailsOpen = false;

  @query('[data-ref="card-body"]') private _cardBodyEl?: HTMLElement;
  private _syncedCardBodyEl?: HTMLElement;
  @query('[data-ref="settings-body"]') private _settingsBodyEl?: HTMLElement;
  private _syncedSettingsBodyEl?: HTMLElement;
  @query('[data-ref="details-body"]') private _detailsBodyEl?: HTMLElement;
  private _syncedDetailsBodyEl?: HTMLElement;

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
    // The whole M3 accent set (primary/secondary/tertiary + containers)
    // swaps on this attribute, so every descendant picks the heat/cool
    // change up through inheritance and no component rule has to know that
    // modes exist. Surfaces stay on the shared house neutral in both modes —
    // the accent and the ambient glow carry the state, the plate doesn't.
    const mode = computeVals(hass, this._config, new Date()).mode;
    if (mode) this.setAttribute("data-mode", mode);
    else this.removeAttribute("data-mode");
    // Safe to do here rather than on every hass update: next_shower is part
    // of the signature, so an unchanged signature means an unchanged
    // next_shower and there would be nothing to react to.
    this._syncOverrideForShowerChange(hass);
    this.requestUpdate();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  setConfig(config: GeyserStatusCardConfig): void {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._lastSignature = "";
    this._lastNextShowerState = undefined;
    this._mainOpen = false;
    this._settingsOpen = false;
    this._detailsOpen = false;
    this._syncedCardBodyEl = undefined;
    this._syncedSettingsBodyEl = undefined;
    this._syncedDetailsBodyEl = undefined;
  }

  static getStubConfig(): GeyserStatusCardConfig {
    return { type: "custom:m3-geyser-status-card", title: "Geyser" };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("m3-geyser-status-card-editor");
  }

  protected updated(): void {
    // Newly-mounted bodies (only happens once, at first render, or after a
    // config reset) need their max-height snapped to the current
    // open/closed state with no animation — the _toggle* methods animate
    // explicitly and must not be fought here.
    const cardBody = this._cardBodyEl;
    if (cardBody && cardBody !== this._syncedCardBodyEl) {
      this._syncedCardBodyEl = cardBody;
      cardBody.style.maxHeight = this._mainOpen ? "none" : "0";
    }
    const settingsBody = this._settingsBodyEl;
    if (settingsBody && settingsBody !== this._syncedSettingsBodyEl) {
      this._syncedSettingsBodyEl = settingsBody;
      settingsBody.style.maxHeight = this._settingsOpen ? "none" : "0";
    }
    const detailsBody = this._detailsBodyEl;
    if (detailsBody && detailsBody !== this._syncedDetailsBodyEl) {
      this._syncedDetailsBodyEl = detailsBody;
      detailsBody.style.maxHeight = this._detailsOpen ? "none" : "0";
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

  private _toggleSettings(): void {
    this._settingsOpen = !this._settingsOpen;
    void this.updateComplete.then(() => {
      if (this._settingsBodyEl) this._animateExpand(this._settingsBodyEl, this._settingsOpen);
    });
  }

  private _toggleDetails(): void {
    this._detailsOpen = !this._detailsOpen;
    void this.updateComplete.then(() => {
      if (this._detailsBodyEl) this._animateExpand(this._detailsBodyEl, this._detailsOpen);
    });
  }

  private _subsectionKeydown(e: KeyboardEvent, toggle: () => void): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    toggle();
  }

  private _svc(domain: string, service: string, data: Record<string, unknown>): void {
    this._hass?.callService(domain, service, data);
  }

  /** next_shower doubles as the override time (see README): while the
   * override is on, it holds the overridden value rather than the default
   * schedule. So a next-shower time that no longer matches
   * default_shower_time means an override is in effect, and the switch
   * should say so — this turns it on when something moves the shower time
   * off the default while the switch is still off.
   *
   * Only ever fires on an observed *change*, never on the first value this
   * card sees. Acting on the initial read would flip the switch during
   * dashboard load for a time that was already set — by another automation,
   * or by a previous session — which is not a change the user just made and
   * is not this card's to reinterpret.
   *
   * Comparison is time-of-day only, via computeVals: next_shower is
   * typically a full datetime while default_shower_time is typically a
   * time-only input_datetime, so the raw states differ even when the
   * schedule matches. nextShowerIsDefault is null when either side can't be
   * read, and the strict `!== false` check means an unreadable value never
   * triggers a write.
   *
   * No loop risk: turning the override on doesn't change next_shower, and
   * the external reset automation moves next_shower *to* the default, which
   * fails the condition. */
  private _syncOverrideForShowerChange(hass: HomeAssistant): void {
    const c = this._config;
    if (!c.next_shower || !c.shower_override_switch || !c.default_shower_time) return;

    const raw = hass.states[c.next_shower]?.state;
    if (raw == null) return;

    const previous = this._lastNextShowerState;
    this._lastNextShowerState = raw;
    if (previous === undefined || previous === raw) return;

    const v = computeVals(hass, c, new Date());
    if (v.overrideOn) return;
    if (v.nextShowerIsDefault !== false) return;

    this._svc("homeassistant", "turn_on", { entity_id: c.shower_override_switch });
  }

  private _togglePower(e: Event): void {
    e.stopPropagation();
    const c = this._config;
    if (!c.switch || !this._hass) return;
    const v = computeVals(this._hass, c, new Date());
    this._svc("switch", v.isOn ? "turn_off" : "turn_on", { entity_id: c.switch });
  }

  private _powerKeydown(e: KeyboardEvent): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    this._togglePower(e);
  }

  /** Uses the generic homeassistant.toggle service rather than a
   * domain-specific one — the override entity may be a switch.* or an
   * input_boolean.*, and this dispatches correctly either way. */
  private _toggleOverride(e: Event): void {
    e.stopPropagation();
    const c = this._config;
    if (!c.shower_override_switch) return;
    this._svc("homeassistant", "toggle", { entity_id: c.shower_override_switch });
  }

  private _overrideKeydown(e: KeyboardEvent): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    this._toggleOverride(e);
  }

  private _stepTarget(delta: 1 | -1, e: Event): void {
    e.stopPropagation();
    const c = this._config;
    if (!c.target_temp) return;
    this._svc("input_number", delta > 0 ? "increment" : "decrement", { entity_id: c.target_temp });
  }

  private _onMoreInfoClick(e: Event, entityId?: string): void {
    if (!entityId) return;
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
  }

  /** M3 switch: 52x32 track, a thumb that grows from 16 to 24 (and to 28
   * while pressed) and travels on a spatial spring. Shared by the power
   * toggle and the shower-override row so both read as the same control. */
  private _renderSwitch(on: boolean, label: string, onToggle: (e: Event) => void, onKeydown: (e: KeyboardEvent) => void) {
    return html`
      <div
        class="m3-switch ${on ? "on" : ""}"
        role="switch"
        aria-label=${label}
        aria-checked=${on ? "true" : "false"}
        tabindex="0"
        @click=${onToggle}
        @keydown=${onKeydown}
      >
        <div class="m3-switch-thumb"><ha-icon icon="mdi:check"></ha-icon></div>
      </div>
    `;
  }

  protected render() {
    if (!this._config || !this._hass) {
      return nothing;
    }
    const c = this._config;
    const v = computeVals(this._hass, c, new Date());

    const hasSettings = Boolean(c.target_temp || c.shower_override_switch || c.default_shower_time);
    const hasDetails = Boolean(c.heating_automation || c.efficiency);
    const showOverrideBanner = Boolean(c.shower_override_switch) && v.overrideOn;
    const showProgress = v.isOn && Boolean(c.current_temp || c.target_temp);
    const percent = clamp(v.progressPercent, 0, 100);

    // Next shower only. On/off and heating/cooling are already carried by
    // the switch, the leading icon's colour and shape, and the wave, so
    // repeating them as text just made the line longer without adding
    // anything. Omitted entirely when the override banner below is already
    // showing the same value, which leaves the header a single title line.
    const supportingText =
      c.next_shower && !showOverrideBanner ? `Next shower ${v.nextShowerText ?? "—"}` : null;

    return html`
      <ha-card class=${v.isOn ? "on" : ""}>
        <!-- Own clipping layer, not ha-card::before/::after: the drifting
             transforms would otherwise inflate ha-card's scrollWidth and
             scrollHeight past its client size. See .glow in card.css.ts. -->
        <div class="glow" aria-hidden="true"></div>
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
              <ha-icon icon=${v.isOn ? "mdi:water-boiler" : "mdi:water-boiler-off"}></ha-icon>
            </div>
            <div class="title-text">
              <div class="name m3-title-medium-emphasized">${c.title || "Geyser"}</div>
              ${supportingText ? html`<div class="supporting m3-body-small">${supportingText}</div>` : nothing}
            </div>
            ${c.switch
              ? this._renderSwitch(
                  v.isOn,
                  "Geyser power",
                  (e: Event) => this._togglePower(e),
                  (e: KeyboardEvent) => this._powerKeydown(e),
                )
              : nothing}
          </div>

          ${showOverrideBanner
            ? html`
                <div class="block">
                  <div class="override-banner">
                    <ha-icon class="banner-icon" icon="mdi:alarm"></ha-icon>
                    <span class="override-text m3-label-large"
                      >Shower override${v.nextShowerText ? html` · ${v.nextShowerText}` : nothing}</span
                    >
                    <button
                      class="icon-button"
                      type="button"
                      title="Turn off shower override"
                      aria-label="Turn off shower override"
                      @click=${(e: Event) => this._toggleOverride(e)}
                    >
                      <ha-icon icon="mdi:close"></ha-icon>
                    </button>
                  </div>
                </div>
              `
            : nothing}
          ${showProgress
            ? html`
                <div class="block">
                  <div class="hero">
                    <span class="hero-temp m3-display-small-emphasized">${v.currentTempText ?? "—"}</span>
                    ${v.targetTempText
                      ? html`<span class="hero-target m3-label-medium">Target ${v.targetTempText}</span>`
                      : nothing}
                  </div>
                  <!-- M3E wavy linear progress: wavy active indicator, a 4px
                       gap, the flat remaining track, and a stop indicator
                       marking full scale. The wave flattens while cooling —
                       an animated wave there would imply work in progress
                       that isn't happening. -->
                  <div
                    class="wave ${v.mode === "cooling" ? "flat" : ""}"
                    role="progressbar"
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow=${Math.round(percent)}
                    aria-label="Temperature progress toward target"
                  >
                    <div class="wave-active" style="width:calc(${percent}% - 4px)"></div>
                    <div class="wave-track" style="left:calc(${percent}% + 4px)"></div>
                    ${percent < 99.5 ? html`<div class="wave-stop"></div>` : nothing}
                  </div>
                  ${v.readyByText
                    ? html`<div class="ready-by m3-label-small">Ready by ${v.readyByText}</div>`
                    : nothing}
                </div>
              `
            : nothing}

          <div class="card-body" data-ref="card-body" style="max-height:0">
            ${c.time_to_heat || c.next_shower
              ? html`
                  <div class="section">
                    <div class="stat-grid">
                      ${c.time_to_heat
                        ? html`
                            <button
                              class="stat-card"
                              type="button"
                              @click=${(e: Event) => this._onMoreInfoClick(e, c.time_to_heat)}
                            >
                              <span class="stat-label m3-label-medium"
                                ><ha-icon icon="mdi:timer-outline"></ha-icon><span>Time to heat</span></span
                              >
                              <span class="stat-value m3-title-medium-emphasized">${v.timeToHeatText ?? "—"}</span>
                            </button>
                          `
                        : nothing}
                      ${c.next_shower
                        ? html`
                            <button
                              class="stat-card"
                              type="button"
                              @click=${(e: Event) => this._onMoreInfoClick(e, c.next_shower)}
                            >
                              <span class="stat-label m3-label-medium"
                                ><ha-icon icon="mdi:shower"></ha-icon><span>Next shower</span></span
                              >
                              <span class="stat-value m3-title-medium-emphasized">${v.nextShowerText ?? "—"}</span>
                            </button>
                          `
                        : nothing}
                    </div>
                  </div>
                `
              : nothing}
            ${hasSettings
              ? html`
                  <div class="section">
                    <div class="subsection${this._settingsOpen ? "" : " collapsed"}">
                      <div
                        class="subsection-header m3-label-large-emphasized"
                        tabindex="0"
                        role="button"
                        aria-expanded=${this._settingsOpen ? "true" : "false"}
                        @click=${() => this._toggleSettings()}
                        @keydown=${(e: KeyboardEvent) => this._subsectionKeydown(e, () => this._toggleSettings())}
                      >
                        <span>Settings</span>
                        <span class="icon-button" aria-hidden="true"
                          ><ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon
                        ></span>
                      </div>
                      <div class="subsection-body" data-ref="settings-body" style="max-height:0">
                        <div class="subsection-body-inner">
                          ${c.target_temp
                            ? html`
                                <div class="row">
                                  <span class="m3-body-medium">Target temp</span>
                                  <!-- M3E connected button group: outer corners
                                       full, inner corners small, and a shape
                                       morph on press. -->
                                  <div class="button-group" role="group" aria-label="Target temperature">
                                    <button
                                      class="segment"
                                      type="button"
                                      title="Decrease target temperature"
                                      aria-label="Decrease target temperature"
                                      @click=${(e: Event) => this._stepTarget(-1, e)}
                                    >
                                      <ha-icon icon="mdi:minus"></ha-icon>
                                    </button>
                                    <span class="segment value m3-title-small">${v.targetTempText ?? "—"}</span>
                                    <button
                                      class="segment"
                                      type="button"
                                      title="Increase target temperature"
                                      aria-label="Increase target temperature"
                                      @click=${(e: Event) => this._stepTarget(1, e)}
                                    >
                                      <ha-icon icon="mdi:plus"></ha-icon>
                                    </button>
                                  </div>
                                </div>
                              `
                            : nothing}
                          ${c.shower_override_switch
                            ? html`
                                <div class="row">
                                  <span class="m3-body-medium">Shower override</span>
                                  ${this._renderSwitch(
                                    v.overrideOn,
                                    "Shower override",
                                    (e: Event) => this._toggleOverride(e),
                                    (e: KeyboardEvent) => this._overrideKeydown(e),
                                  )}
                                </div>
                              `
                            : nothing}
                          ${c.default_shower_time
                            ? html`
                                <div class="row">
                                  <span class="m3-body-medium">Default shower time</span>
                                  <button
                                    class="value-button m3-label-large"
                                    type="button"
                                    @click=${(e: Event) => this._onMoreInfoClick(e, c.default_shower_time)}
                                  >
                                    ${v.defaultShowerTimeText ?? "—"}
                                  </button>
                                </div>
                              `
                            : nothing}
                        </div>
                      </div>
                    </div>
                  </div>
                `
              : nothing}
            ${hasDetails
              ? html`
                  <div class="section">
                    <div class="subsection${this._detailsOpen ? "" : " collapsed"}">
                      <div
                        class="subsection-header m3-label-large-emphasized"
                        tabindex="0"
                        role="button"
                        aria-expanded=${this._detailsOpen ? "true" : "false"}
                        @click=${() => this._toggleDetails()}
                        @keydown=${(e: KeyboardEvent) => this._subsectionKeydown(e, () => this._toggleDetails())}
                      >
                        <span>Details</span>
                        <span class="icon-button" aria-hidden="true"
                          ><ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon
                        ></span>
                      </div>
                      <div class="subsection-body" data-ref="details-body" style="max-height:0">
                        <div class="subsection-body-inner">
                          ${c.heating_automation
                            ? html`
                                <div class="row">
                                  <span class="m3-body-medium">Mode</span>
                                  <span class="chip accent m3-label-medium">
                                    <ha-icon icon=${v.mode === "heating" ? "mdi:fire" : "mdi:snowflake"}></ha-icon>
                                    ${v.modeLabel}
                                  </span>
                                </div>
                              `
                            : nothing}
                          ${c.efficiency
                            ? html`
                                <div class="row">
                                  <span class="m3-body-medium">Heating efficiency</span>
                                  <span class="chip m3-label-medium">${v.efficiencyText ?? "—"}</span>
                                </div>
                              `
                            : nothing}
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
}

declare global {
  interface HTMLElementTagNameMap {
    "m3-geyser-status-card": GeyserStatusCard;
  }
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string; preview?: boolean }>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "m3-geyser-status-card",
  name: "M3 Geyser Status Card",
  description: "Geyser power, temperature progress, heating schedule, and shower-time override",
});
