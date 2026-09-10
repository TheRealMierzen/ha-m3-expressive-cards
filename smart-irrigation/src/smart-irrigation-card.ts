import { LitElement, TemplateResult, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./smart-irrigation-card-editor";
import { cardStyles } from "./card.css";
import { CardVals, Discovery, ZoneVals, clamp, computeVals, discover } from "./compute";
import { HomeAssistant, SmartIrrigationCardConfig } from "./types";

const DEFAULT_CONFIG: Partial<SmartIrrigationCardConfig> = {
  title: "Irrigation",
  show_details: true,
  hold_ms: 600,
};

/** How often the "14 h ago" / "in 9 h" labels are recomputed. Every value on
 * this card is either a reading that arrives with its own state update or an
 * age measured in hours, so a minute is far more often than it needs. */
const TICK_MS = 60_000;

/** Hold-state key for the all-zones button. Not an entity id, so it can
 * never collide with a zone's own main sensor. */
const ALL_ZONES_KEY = "__all__";

/** Only re-renders when one of the entities this card actually reads changes,
 * not on every unrelated hass update elsewhere in the system. Built from the
 * *discovered* entity set rather than from the config, since almost all of
 * the card's inputs are found rather than configured. */
function entitySignature(hass: HomeAssistant, config: SmartIrrigationCardConfig, discovery: Discovery): string {
  const ids: Array<string | undefined> = [config.next_schedule];
  for (const zone of discovery.zones) {
    // Every value in the zone object is either the zone id or an entity id.
    for (const value of Object.values(zone)) {
      if (typeof value === "string") ids.push(value);
    }
  }
  for (const value of Object.values(discovery.globals)) ids.push(value);
  return ids
    .map((id) => {
      if (typeof id !== "string" || id === "") return "";
      const e = hass.states[id];
      // A zone's whole model lives in its main sensor's attributes, so the
      // state alone would miss a bucket that moved while the duration stayed
      // at 0 — which is most of what this card draws.
      return e ? `${id}:${e.state}:${e.attributes.bucket ?? ""}:${e.attributes.last_calculated ?? ""}` : `${id}:_`;
    })
    .join("|");
}

@customElement("m3-smart-irrigation-card")
export class SmartIrrigationCard extends LitElement {
  static styles = cardStyles;

  private _hass?: HomeAssistant;
  private _lastSignature = "";

  /** Discovery walks every entity in the system, so its result is cached and
   * only rebuilt when the entity set itself could have changed: a different
   * number of entities, or one the card had resolved having gone away. A
   * state *value* changing never invalidates it. */
  private _discovery: Discovery = { zones: [], globals: {} };
  private _discoveryStateCount = -1;

  @state() private _config!: SmartIrrigationCardConfig;
  /** Which zones have their details section expanded, keyed by main sensor. */
  @state() private _open: Record<string, boolean> = {};
  @state() private _now = new Date();
  /** The zone whose "hold to irrigate" is currently being held. */
  @state() private _holding?: string;

  private _tickTimer?: ReturnType<typeof setInterval>;
  private _holdTimer?: ReturnType<typeof setTimeout>;

  connectedCallback(): void {
    super.connectedCallback();
    this._tickTimer = setInterval(() => {
      this._now = new Date();
    }, TICK_MS);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._tickTimer !== undefined) {
      clearInterval(this._tickTimer);
      this._tickTimer = undefined;
    }
    // A card removed mid-hold must not still have a timer queued to open a
    // valve.
    this._cancelHold();
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    // Reflects HA's actual theme setting, not the OS-level
    // prefers-color-scheme media feature — those two can disagree (HA dark
    // theme + light OS, or vice versa), and the card should follow HA.
    this.setAttribute("data-theme", hass.themes?.darkMode ? "dark" : "light");
    if (!this._config) return;
    this._syncDiscovery(hass);
    const signature = entitySignature(hass, this._config, this._discovery);
    if (signature === this._lastSignature) return;
    this._lastSignature = signature;
    this.requestUpdate();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  private _syncDiscovery(hass: HomeAssistant): void {
    const count = Object.keys(hass.states).length;
    const resolvedGone = this._discovery.zones.some((zone) => hass.states[zone.main] === undefined);
    if (count === this._discoveryStateCount && !resolvedGone) return;
    this._discoveryStateCount = count;
    this._discovery = discover(hass);
    // A rediscovered set can change what the signature covers, so force the
    // next comparison to miss rather than holding a stale render.
    this._lastSignature = "";
  }

  setConfig(config: SmartIrrigationCardConfig): void {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._lastSignature = "";
    this._discoveryStateCount = -1;
    this._open = {};
    this._syncedBodies = new WeakSet();
    this._cancelHold();
  }

  static getStubConfig(): SmartIrrigationCardConfig {
    // Zones are discovered, so the stub genuinely needs nothing else — the
    // card renders its real content the moment it is added.
    return { type: "custom:m3-smart-irrigation-card", title: "Irrigation" };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("m3-smart-irrigation-card-editor");
  }

  /* ------------------------------------------------- collapsible details */

  /** Bodies whose max-height has already been snapped to their state. A
   * newly-mounted body (first render, a config reset, a zone appearing) has
   * to be set with no animation; the toggle path animates explicitly and
   * must not be fought here. A WeakSet rather than one field per section
   * because the number of sections is the number of zones. */
  private _syncedBodies = new WeakSet<HTMLElement>();
  /** Teardown for the expand/collapse currently running on a body, so a new
   * toggle can cancel it instead of racing it. */
  private _expandCleanups = new WeakMap<HTMLElement, () => void>();

  protected updated(): void {
    for (const body of this.renderRoot.querySelectorAll<HTMLElement>("[data-details-for]")) {
      if (this._syncedBodies.has(body)) continue;
      this._syncedBodies.add(body);
      body.style.maxHeight = this._open[body.dataset.detailsFor ?? ""] ? "none" : "0";
    }
  }

  private _prefersReducedMotion(): boolean {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  private _animateExpand(el: HTMLElement, open: boolean): void {
    // Spammed toggles: tear down the previous run first. Its transitionend
    // listener would otherwise still be armed and fire at the end of *this*
    // animation, snapping max-height back to the superseded target.
    this._expandCleanups.get(el)?.();

    if (this._prefersReducedMotion()) {
      el.style.maxHeight = open ? "none" : "0";
      return;
    }

    // Animate from the height that is on screen right now — mid-flight that
    // is somewhere between 0 and the content height — so an interrupted
    // section continues from where it is instead of snapping first.
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

  private _toggleDetails(key: string): void {
    const open = !this._open[key];
    this._open = { ...this._open, [key]: open };
    void this.updateComplete.then(() => {
      const el = this.renderRoot.querySelector<HTMLElement>(`[data-details-for="${key}"]`);
      if (el) this._animateExpand(el, open);
    });
  }

  private _detailsKeydown(e: KeyboardEvent, key: string): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    this._toggleDetails(key);
  }

  /* ------------------------------------------------------------ services */

  private _press(e: Event, entityId?: string): void {
    e.stopPropagation();
    if (!entityId) return;
    this._hass?.callService("button", "press", { entity_id: entityId });
  }

  /** The multiplier is a `number.*` entity, and the number domain has no
   * increment/decrement service — `set_value` is the only way to move it, so
   * this is the one place the card computes a value rather than asking HA to.
   * The entity's own min/max/step are used, and the result is clamped and
   * re-rounded to the step so a float step can't accumulate drift. */
  private _stepMultiplier(zone: ZoneVals, direction: 1 | -1, e: Event): void {
    e.stopPropagation();
    const entityId = zone.entities.multiplier;
    if (!entityId || zone.multiplier == null) return;
    const step = zone.multiplierStep > 0 ? zone.multiplierStep : 0.1;
    const raw = zone.multiplier + direction * step;
    const snapped = Math.round(raw / step) * step;
    const value = Number(clamp(snapped, zone.multiplierMin, zone.multiplierMax).toFixed(4));
    if (value === zone.multiplier) return;
    this._hass?.callService("number", "set_value", { entity_id: entityId, value });
  }

  private _onMoreInfoClick(e: Event, entityId?: string): void {
    if (!entityId) return;
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } }));
  }

  /* -------------------------------------------------------- hold to run */

  private _cancelHold(): void {
    if (this._holdTimer !== undefined) {
      clearTimeout(this._holdTimer);
      this._holdTimer = undefined;
    }
    this._holding = undefined;
  }

  /** Arms the hold. `key` is what the fill renders against, so the per-zone
   * and all-zones buttons can't both look held at once. */
  private _armHold(key: string, entityId: string | undefined): void {
    if (!entityId) return;
    const holdMs = this._config.hold_ms ?? 0;
    if (holdMs <= 0) {
      // A zero-length hold has to bypass the timer entirely: setTimeout(0)
      // is a macrotask, and the pointerup ending the same tap cancels it
      // first, so it would never fire.
      this._hass?.callService("button", "press", { entity_id: entityId });
      return;
    }
    this._holding = key;
    this._holdTimer = setTimeout(() => {
      this._holdTimer = undefined;
      this._holding = undefined;
      this._hass?.callService("button", "press", { entity_id: entityId });
    }, holdMs);
  }

  private _startHold(e: PointerEvent, key: string, entityId: string | undefined): void {
    e.stopPropagation();
    if (!entityId) return;
    // Capture the pointer, or a finger that slides off the button never
    // delivers its pointerup and the timer stays armed.
    const target = e.currentTarget as HTMLElement;
    if (e.pointerId !== undefined && target.setPointerCapture) {
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        // A synthetic event with no live pointer; the timer path is
        // unaffected.
      }
    }
    this._armHold(key, entityId);
  }

  private _holdKeydown(e: KeyboardEvent, key: string, entityId: string | undefined): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    // Auto-repeat re-fires keydown; without this the hold would restart on
    // every repeat and never complete.
    if (e.repeat || this._holding === key) return;
    this._armHold(key, entityId);
  }

  /* -------------------------------------------------------------- render */

  private _renderIconButton(
    icon: string,
    label: string,
    entityId: string | undefined,
    extraClass = ""
  ): TemplateResult | typeof nothing {
    if (!entityId) return nothing;
    return html`
      <button
        class="icon-button ${extraClass}"
        type="button"
        title=${label}
        aria-label=${label}
        @click=${(e: Event) => this._press(e, entityId)}
      >
        <ha-icon icon=${icon}></ha-icon>
      </button>
    `;
  }

  private _renderStat(
    icon: string,
    label: string,
    value: string,
    sub: string | null,
    entityId?: string
  ): TemplateResult {
    const body = html`
      <span class="stat-label m3-label-medium"><ha-icon icon=${icon}></ha-icon><span>${label}</span></span>
      <span class="stat-value m3-title-small">${value}</span>
      ${sub ? html`<span class="stat-sub m3-label-small">${sub}</span>` : nothing}
    `;
    return entityId
      ? html`<button class="stat" type="button" @click=${(e: Event) => this._onMoreInfoClick(e, entityId)}>
          ${body}
        </button>`
      : html`<div class="stat">${body}</div>`;
  }

  /** The bucket. See card.css.ts for what the geometry means. */
  private _renderGauge(zone: ZoneVals): TemplateResult {
    const style = `--zero:${zone.zeroPercent.toFixed(2)}%;--surplus:${zone.surplusPercent.toFixed(
      2
    )}%;--deficit:${zone.deficitPercent.toFixed(2)}%`;
    const label = zone.bucketText
      ? `Bucket ${zone.bucketText}${zone.maximumBucketText ? ` of ${zone.maximumBucketText}` : ""}`
      : "Bucket level unknown";
    return html`
      <div class="gauge-wrap" style=${style}>
        <div class="gauge-axis m3-label-small" aria-hidden="true">
          <span class="tick top">${zone.maximumBucket != null ? zone.maximumBucket : ""}</span>
          <span class="tick zero">0</span>
          <span class="tick bottom">−${Math.round(zone.deficitScale * 10) / 10}</span>
        </div>
        <div
          class="gauge"
          role="img"
          aria-label=${label}
          @click=${(e: Event) => this._onMoreInfoClick(e, zone.entities.bucket)}
        >
          <div class="vessel">
            <div class="sump" aria-hidden="true"></div>
            <div class="zero-line" aria-hidden="true"></div>
            ${zone.surplusPercent > 0
              ? html`<div class="fill fill-surplus"><div class="crest"></div></div>`
              : nothing}
            ${zone.deficitPercent > 0 ? html`<div class="fill fill-deficit"></div>` : nothing}
            ${zone.deficitBeyondScale
              ? html`<div class="beyond" aria-hidden="true"><ha-icon icon="mdi:chevron-double-down"></ha-icon></div>`
              : nothing}
            <div class="rim" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    `;
  }

  private _renderVerdict(zone: ZoneVals): TemplateResult {
    const icon =
      zone.verdict === "watering"
        ? "mdi:sprinkler-variant"
        : zone.verdict === "needs-water"
          ? "mdi:water-alert"
          : zone.verdict === "disabled"
            ? "mdi:pause-circle-outline"
            : zone.verdict === "ok"
              ? "mdi:check-circle-outline"
              : "mdi:help-circle-outline";
    // The sub-line is what the verdict is actually worth: how long the run
    // would be and roughly how much water that is. "No water needed" says
    // what the bucket is instead.
    const sub =
      zone.verdict === "needs-water" || zone.verdict === "watering"
        ? [zone.durationText, zone.litresText, zone.capped ? `capped at ${zone.maxDurationText}` : null]
            .filter(Boolean)
            .join(" · ")
        : zone.verdict === "ok" || zone.verdict === "disabled"
          ? `Bucket ${zone.bucketText ?? "—"}${zone.deficitPercent > 0 ? " below capacity" : ""}`
          : null;
    return html`
      <div class="verdict ${zone.verdict}">
        <ha-icon class="verdict-icon" icon=${icon}></ha-icon>
        <div class="verdict-text">
          <div class="verdict-line m3-label-large-emphasized">${zone.verdictLabel}</div>
          ${sub ? html`<div class="verdict-sub m3-body-small">${sub}</div>` : nothing}
        </div>
      </div>
    `;
  }

  private _renderDetail(label: string, value: string | null, entityId?: string): TemplateResult | typeof nothing {
    if (value == null) return nothing;
    const body = html`
      <span class="detail-label m3-label-small">${label}</span>
      <span class="detail-value m3-label-large">${value}</span>
    `;
    return entityId
      ? html`<button class="detail" type="button" @click=${(e: Event) => this._onMoreInfoClick(e, entityId)}>
          ${body}
        </button>`
      : html`<div class="detail">${body}</div>`;
  }

  private _renderDetails(zone: ZoneVals): TemplateResult {
    const e = zone.entities;
    const weather =
      zone.dataPoints != null || zone.lastCalculatedRelative
        ? [zone.dataPoints != null ? `${zone.dataPoints} points` : null, zone.lastCalculatedRelative]
            .filter(Boolean)
            .join(" · ")
        : null;
    const zoneSize = [zone.sizeText, zone.throughputText].filter(Boolean).join(" · ") || null;
    const lastRun = zone.lastIrrigationText
      ? `${zone.lastIrrigationText}${zone.lastIrrigationRelative ? ` · ${zone.lastIrrigationRelative}` : ""}`
      : null;

    return html`
      <div class="details-body" data-details-for=${e.main} style="max-height:0">
        <div class="details-inner">
          <div class="detail-grid">
            ${this._renderDetail(
              "Bucket",
              zone.bucketText != null && zone.maximumBucketText != null
                ? `${zone.bucketText} of ${zone.maximumBucketText}`
                : zone.bucketText,
              e.bucket
            )}
            ${this._renderDetail("Last run", lastRun, e.lastIrrigation)}
            ${this._renderDetail("Applied ET", zone.etValueText, e.etValue)}
            ${this._renderDetail("Daily ET deficiency", zone.etDeficiencyText, e.etDeficiency)}
            ${this._renderDetail("Reference ET", zone.etoText)}
            ${this._renderDetail("Drainage", zone.drainageText, e.currentDrainage)}
            ${this._renderDetail("Water used", zone.waterUsedText, e.waterUsed)}
            ${this._renderDetail("Weather data", weather)}
            ${this._renderDetail("Mode", zone.modeLabel)}
            ${this._renderDetail("Zone", zoneSize)}
            ${this._renderDetail("Run cap", zone.maxDurationText)}
          </div>

          ${e.multiplier
            ? html`
                <div class="detail-row">
                  <span class="m3-body-medium">Multiplier</span>
                  <!-- M3E connected button group: outer corners full, inner
                       corners square, and a shape morph on press. -->
                  <div class="button-group" role="group" aria-label="Duration multiplier">
                    <button
                      class="segment"
                      type="button"
                      title="Decrease multiplier"
                      aria-label="Decrease multiplier"
                      @click=${(ev: Event) => this._stepMultiplier(zone, -1, ev)}
                    >
                      <ha-icon icon="mdi:minus"></ha-icon>
                    </button>
                    <span class="segment value m3-title-small">${zone.multiplierText ?? "—"}</span>
                    <button
                      class="segment"
                      type="button"
                      title="Increase multiplier"
                      aria-label="Increase multiplier"
                      @click=${(ev: Event) => this._stepMultiplier(zone, 1, ev)}
                    >
                      <ha-icon icon="mdi:plus"></ha-icon>
                    </button>
                  </div>
                </div>
              `
            : nothing}
          ${e.calculate || e.resetBucket || e.resetUsage
            ? html`
                <div class="actions">
                  ${e.calculate
                    ? html`<button class="pill m3-label-large" type="button" @click=${(ev: Event) =>
                        this._press(ev, e.calculate)}>
                        <ha-icon icon="mdi:calculator"></ha-icon><span>Calculate</span>
                      </button>`
                    : nothing}
                  ${e.resetBucket
                    ? html`<button class="pill m3-label-large" type="button" @click=${(ev: Event) =>
                        this._press(ev, e.resetBucket)}>
                        <ha-icon icon="mdi:bucket-outline"></ha-icon><span>Reset bucket</span>
                      </button>`
                    : nothing}
                  ${e.resetUsage
                    ? html`<button class="pill m3-label-large" type="button" @click=${(ev: Event) =>
                        this._press(ev, e.resetUsage)}>
                        <ha-icon icon="mdi:restart"></ha-icon><span>Reset water used</span>
                      </button>`
                    : nothing}
                </div>
              `
            : nothing}
          ${e.irrigateNow ? this._renderHold(e.main, e.irrigateNow, "mdi:sprinkler", "", zone.name) : nothing}
        </div>
      </div>
    `;
  }

  /** Starting a run is the only control on this card with a physical
   * consequence, so a tap does nothing and it has to be held. */
  private _renderHold(key: string, entityId: string, icon: string, suffix: string, what: string): TemplateResult {
    const holdMs = this._config.hold_ms ?? 600;
    const verb = holdMs > 0 ? "Hold to irrigate" : "Irrigate";
    return html`
      <button
        class="hold ${this._holding === key ? "holding" : ""} m3-label-large-emphasized"
        type="button"
        style=${`--hold-ms:${holdMs}ms`}
        aria-label=${`${verb} ${what}`}
        @pointerdown=${(ev: PointerEvent) => this._startHold(ev, key, entityId)}
        @pointerup=${() => this._cancelHold()}
        @pointercancel=${() => this._cancelHold()}
        @lostpointercapture=${() => this._cancelHold()}
        @blur=${() => this._cancelHold()}
        @keydown=${(ev: KeyboardEvent) => this._holdKeydown(ev, key, entityId)}
        @keyup=${() => this._cancelHold()}
        @click=${(ev: Event) => ev.preventDefault()}
      >
        <span class="hold-fill" aria-hidden="true"></span>
        <ha-icon icon=${icon}></ha-icon>
        <span class="hold-label">${suffix ? `${verb} ${suffix}` : verb}</span>
      </button>
    `;
  }

  private _renderZone(zone: ZoneVals, showDetails: boolean): TemplateResult {
    const key = zone.entities.main;
    const open = this._open[key] === true;
    const hasDetails = showDetails && zone.available;
    return html`
      <div class="zone ${zone.verdict}${open ? "" : " collapsed"}">
        <div class="zone-head">
          <div class="zone-name m3-title-medium-emphasized">${zone.name}</div>
          ${zone.modeLabel && zone.mode !== "automatic"
            ? html`<span class="chip chip-quiet m3-label-small">${zone.modeLabel}</span>`
            : nothing}
          ${hasDetails
            ? html`
                <span
                  class="icon-button small"
                  role="button"
                  tabindex="0"
                  aria-expanded=${open ? "true" : "false"}
                  aria-label=${`Toggle ${zone.name} details`}
                  @click=${() => this._toggleDetails(key)}
                  @keydown=${(ev: KeyboardEvent) => this._detailsKeydown(ev, key)}
                >
                  <ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon>
                </span>
              `
            : nothing}
        </div>

        <div class="zone-body">
          ${this._renderGauge(zone)}
          <div class="zone-info">
            ${this._renderVerdict(zone)}
            <div class="facts m3-body-small">
              ${zone.lastIrrigationRelative
                ? html`<div class="fact">
                    <ha-icon icon="mdi:history"></ha-icon><span>Watered ${zone.lastIrrigationRelative}</span>
                  </div>`
                : nothing}
              ${zone.waterUsedText
                ? html`<div class="fact">
                    <ha-icon icon="mdi:water"></ha-icon><span>${zone.waterUsedText} used</span>
                  </div>`
                : nothing}
            </div>
          </div>
        </div>

        ${hasDetails ? this._renderDetails(zone) : nothing}
      </div>
    `;
  }

  protected render() {
    if (!this._config || !this._hass) {
      return nothing;
    }
    const c = this._config;
    const v: CardVals = computeVals(this._hass, c, this._discovery, this._now);

    const cardClass = [v.anyWatering ? "watering" : "", !v.anyWatering && v.needCount > 0 ? "thirsty" : ""]
      .filter(Boolean)
      .join(" ");
    const headerIcon = v.anyWatering
      ? "mdi:sprinkler-variant"
      : v.needCount > 0
        ? "mdi:water-alert"
        : "mdi:sprinkler";

    // "Irrigate all zones" is only offered when there is more than one zone
    // to irrigate — with a single zone it is the same button as the one in
    // that zone's own actions.
    const showIrrigateAll = v.zones.length > 1 && Boolean(v.globals.irrigateAll);

    return html`
      <ha-card class=${cardClass}>
        <!-- Own clipping layer, not ha-card::before/::after: the drifting
             transforms would otherwise inflate ha-card's scrollWidth and
             scrollHeight past its client size. See .glow in card.css.ts. -->
        <div class="glow" aria-hidden="true"></div>
        <div class="wrap">
          <div class="header">
            <div class="leading-icon"><ha-icon icon=${headerIcon}></ha-icon></div>
            <div class="title-text">
              <div class="name m3-title-medium-emphasized">${c.title || "Irrigation"}</div>
              ${v.empty ? nothing : html`<div class="supporting m3-body-small">${v.summary}</div>`}
            </div>
            <div class="header-actions">
              ${this._renderIconButton("mdi:weather-cloudy-arrow-right", "Refresh weather", v.globals.refreshWeather)}
              ${this._renderIconButton("mdi:calculator-variant", "Calculate all zones", v.globals.calculateAll)}
            </div>
          </div>

          ${v.problems.map(
            (problem) => html`
              <div class="block">
                <div class="problem-banner">
                  <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
                  <div class="problem-text">
                    <div class="m3-label-large-emphasized">${problem.name} reported a problem</div>
                    ${problem.reason ? html`<div class="m3-body-small">${problem.reason}</div>` : nothing}
                  </div>
                </div>
              </div>
            `
          )}
          ${v.empty
            ? html`
                <div class="empty-note m3-body-medium">
                  No Smart Irrigation zones found. The card looks for the integration's own zone sensors, so check
                  that Smart Irrigation is set up and has at least one zone — or name the zone sensors yourself in the
                  card's Zones section.
                </div>
              `
            : html`
                ${c.next_schedule || v.lastRun
                  ? html`
                      <div class="block strip">
                        ${c.next_schedule
                          ? this._renderStat(
                              "mdi:calendar-clock",
                              "Next run",
                              v.nextRunText ?? v.nextRunRaw ?? "—",
                              v.nextRunRelative,
                              c.next_schedule
                            )
                          : nothing}
                        ${v.lastRun
                          ? this._renderStat(
                              "mdi:history",
                              "Last run",
                              v.lastRunText ?? "—",
                              [v.lastRunRelative, v.lastRunZone].filter(Boolean).join(" · ") || null
                            )
                          : nothing}
                      </div>
                    `
                  : nothing}

                <div class="block zones">
                  ${v.zones.map((zone) => this._renderZone(zone, c.show_details !== false))}
                </div>

                ${showIrrigateAll && v.globals.irrigateAll
                  ? html`
                      <div class="block">
                        ${this._renderHold(
                          ALL_ZONES_KEY,
                          v.globals.irrigateAll,
                          "mdi:sprinkler-variant",
                          "all zones",
                          "all zones"
                        )}
                      </div>
                    `
                  : nothing}
              `}
        </div>
      </ha-card>
    `;
  }

}

declare global {
  interface HTMLElementTagNameMap {
    "m3-smart-irrigation-card": SmartIrrigationCard;
  }
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string; preview?: boolean }>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "m3-smart-irrigation-card",
  name: "M3 Smart Irrigation Card",
  description: "Smart Irrigation zones as bucket gauges, with the watering verdict, next run and last run",
});
