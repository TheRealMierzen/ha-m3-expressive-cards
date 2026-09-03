import { LitElement, html, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import "./garage-auto-open-card-editor";
import { cardStyles } from "./card.css";
import { ComputedDoor, computeVals, doorGlyph } from "./compute";
import { GarageAutoOpenCardConfig, HomeAssistant } from "./types";

const DEFAULT_CONFIG: Partial<GarageAutoOpenCardConfig> = {
  title: "Auto garage",
};

/** How long Open/Close is held before the door moves, unless `hold_ms` says
 * otherwise. Long enough that a mis-tap can't open the garage while you're
 * out, short enough not to feel like a punishment when you meant it. */
const DEFAULT_HOLD_MS = 600;

type DoorAction = "open" | "close" | "stop";

/** Only re-renders when one of the entities this card actually reads
 * changes, not on every unrelated hass update elsewhere in the system. */
function entitySignature(hass: HomeAssistant, entityIds: string[]): string {
  return entityIds
    .map((id) => {
      const e = hass.states[id];
      if (!e) return `${id}:_`;
      // current_position is in here because a cover's position keeps
      // changing mid-travel while its state stays "opening" — without it
      // the readout freezes at the percentage it had when travel started.
      return [
        id,
        e.state,
        e.attributes.last_triggered ?? "",
        e.attributes.last_triggered_at ?? "",
        e.attributes.current_position ?? "",
        e.attributes.supported_features ?? "",
      ].join(":");
    })
    .join("|");
}

@customElement("m3-garage-auto-open-card")
export class GarageAutoOpenCard extends LitElement {
  static styles = cardStyles;

  private _hass?: HomeAssistant;
  private _lastSignature = "";

  @state() private _config!: GarageAutoOpenCardConfig;
  @state() private _mainOpen = false;
  /** Key ("left:open", "right:close") of the segment being held right now,
   * or "" for none. Drives the fill animation and nothing else. */
  @state() private _holding = "";

  private _holdTimer?: number;

  @query('[data-ref="section"]') private _sectionEl?: HTMLElement;
  private _syncedSectionEl?: HTMLElement;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    // Reflects HA's actual theme setting, not the OS-level
    // prefers-color-scheme media feature — those two can disagree (HA dark
    // theme + light OS, or vice versa), and the card should follow HA.
    this.setAttribute("data-theme", hass.themes?.darkMode ? "dark" : "light");
    if (!this._config) return;
    const signature = entitySignature(hass, this._entityIds());
    if (signature !== this._lastSignature) {
      this._lastSignature = signature;
      this.requestUpdate();
    }
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  private _entityIds(): string[] {
    return [
      this._config?.automation,
      this._config?.left_entity,
      this._config?.right_entity,
      this._config?.left_cover,
      this._config?.right_cover,
    ].filter(
      (id): id is string => typeof id === "string" && id !== ""
    );
  }

  setConfig(config: GarageAutoOpenCardConfig): void {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._mainOpen = false;
    this._lastSignature = "";
    this._cancelHold();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // A card removed mid-hold (dashboard edit, view switch) must not have a
    // timer still queued to open a garage door after it's gone.
    this._cancelHold();
  }

  static getStubConfig(): GarageAutoOpenCardConfig {
    return { type: "custom:m3-garage-auto-open-card", title: "Auto garage" };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("m3-garage-auto-open-card-editor");
  }

  // No getCardSize()/getGridOptions() override: the card's rendered
  // height changes with _mainOpen (an internal toggle HA has no visibility
  // into), so any static or state-derived row estimate either leaves a
  // gap (oversized) or lags behind the expand/collapse animation (HA only
  // re-reads these at intermittent triggers, not continuously) — omitting
  // them lets HA's sections view auto-size the grid cell to actual
  // content instead, matching the original card's behavior.

  protected updated(): void {
    // A newly-mounted section (only happens once, at first render, since
    // the section now always exists structurally) needs its max-height
    // snapped to the current open/closed state with no animation —
    // _toggleOpen animates explicitly and must not be fought here.
    const section = this._sectionEl;
    if (section && section !== this._syncedSectionEl) {
      this._syncedSectionEl = section;
      section.style.maxHeight = this._mainOpen ? "none" : "0";
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

  private _toggleOpen(): void {
    this._mainOpen = !this._mainOpen;
    void this.updateComplete.then(() => {
      if (this._sectionEl) this._animateExpand(this._sectionEl, this._mainOpen);
    });
  }

  private _headerKeydown(e: KeyboardEvent): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    this._toggleOpen();
  }

  private _setAutomation(turnOn: boolean, e: Event): void {
    e.stopPropagation();
    const automation = this._config.automation;
    if (!automation) return;
    this._hass?.callService("automation", turnOn ? "turn_on" : "turn_off", { entity_id: automation });
  }

  /** The M3 switch is a div with role="switch", so Enter/Space have to be
   * wired by hand — the <button> pair it replaced got that for free. */
  private _switchKeydown(e: KeyboardEvent, turnOn: boolean): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    this._setAutomation(turnOn, e);
  }

  /* ------------------------------------------------------------ door hold */

  private _holdMs(): number {
    const raw = this._config?.hold_ms;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return DEFAULT_HOLD_MS;
    return raw;
  }

  private _cancelHold(): void {
    if (this._holdTimer !== undefined) {
      clearTimeout(this._holdTimer);
      this._holdTimer = undefined;
    }
    this._holding = "";
  }

  /** HA's own haptic channel — a no-op anywhere the companion app isn't
   * listening, which is why it's fired blind rather than feature-detected. */
  private _haptic(kind: string): void {
    this.dispatchEvent(new CustomEvent("haptic", { detail: kind, bubbles: true, composed: true }));
  }

  private _callCover(door: ComputedDoor, service: "open_cover" | "close_cover" | "stop_cover"): void {
    this._hass?.callService("cover", service, { entity_id: door.entityId });
  }

  /** Starts the press-and-hold on a directional segment. With `hold_ms: 0`
   * this degrades to a plain tap — the timer just fires on the next tick. */
  private _startHold(e: Event, key: string, door: ComputedDoor, service: "open_cover" | "close_cover"): void {
    e.stopPropagation();
    e.preventDefault();
    if (this._holding === key) return; // key auto-repeat re-fires keydown
    this._cancelHold();

    // hold_ms: 0 means "act on the tap". It has to fire here rather than
    // through a zero-length timer: the timer is a macrotask, and the
    // pointerup that ends the very same tap cancels it first, so the door
    // would never move.
    if (this._holdMs() <= 0) {
      this._callCover(door, service);
      this._haptic("success");
      return;
    }

    this._holding = key;
    this._haptic("selection");

    // Pointer capture keeps the matching pointerup on this element even if
    // the finger slides off it, so a hold can always be aborted by lifting
    // — without it, releasing outside the button leaves the timer armed.
    const target = e.currentTarget as HTMLElement | null;
    if (target && "setPointerCapture" in target && (e as PointerEvent).pointerId !== undefined) {
      try {
        target.setPointerCapture((e as PointerEvent).pointerId);
      } catch {
        /* not a pointer event, or the pointer is already gone */
      }
    }

    this._holdTimer = window.setTimeout(() => {
      this._holdTimer = undefined;
      this._holding = "";
      this._callCover(door, service);
      this._haptic("success");
    }, this._holdMs());
  }

  private _endHold(e: Event): void {
    e.stopPropagation();
    this._cancelHold();
  }

  private _holdKeydown(e: KeyboardEvent, key: string, door: ComputedDoor, service: "open_cover" | "close_cover"): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    this._startHold(e, key, door, service);
  }

  private _holdKeyup(e: KeyboardEvent): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    this._endHold(e);
  }

  /** Stop is a plain tap, not a hold. The hold exists to stop an accidental
   * touch from *starting* a door moving; halting one that's already moving
   * is the safe direction, and making it slow would be the actual hazard. */
  private _stopDoor(e: Event, door: ComputedDoor): void {
    e.stopPropagation();
    this._cancelHold();
    this._callCover(door, "stop_cover");
    this._haptic("warning");
  }

  protected render() {
    if (!this._config || !this._hass) {
      return nothing;
    }
    const c = this._config;
    const v = computeVals(this._hass, c);
    const hasAuto = Boolean(c.automation);

    return html`
      <ha-card class=${v.autoEnabled ? "armed" : ""}>
        <div class="wrap">
          <div
            class="header"
            tabindex="0"
            role="button"
            aria-expanded=${this._mainOpen ? "true" : "false"}
            aria-label="Toggle card"
            @click=${() => this._toggleOpen()}
            @keydown=${(e: KeyboardEvent) => this._headerKeydown(e)}
          >
            <div class="leading-icon">
              <ha-icon icon=${v.autoEnabled ? "mdi:garage-open-variant" : "mdi:garage-variant"}></ha-icon>
            </div>
            <div class="title title-text">
              <div class="name m3-title-medium-emphasized">${c.title || "Garage Auto Open"}</div>
              <div class="subtitle m3-body-small">
                <span class="mono">Last: ${v.lastTriggeredText}</span>
              </div>
            </div>
            ${hasAuto
              ? html`
                  <div class="header-actions">
                    <div class="header-status">
                      ${this._renderDoorChip("L", v.leftDoor)}
                      ${this._renderDoorChip("R", v.rightDoor)}
                      ${!v.leftHome
                        ? html`<span class="chip away m3-label-small"><span class="k">L</span><span>Away</span></span>`
                        : nothing}
                      ${!v.rightHome
                        ? html`<span class="chip away m3-label-small"><span class="k">R</span><span>Away</span></span>`
                        : nothing}
                    </div>
                    <div
                      class="m3-switch ${v.autoEnabled ? "on" : ""}"
                      role="switch"
                      aria-label="Auto-open automation"
                      aria-checked=${v.autoEnabled ? "true" : "false"}
                      tabindex="0"
                      title=${v.autoEnabled ? "Disable auto-open automation" : "Enable auto-open automation"}
                      @click=${(e: Event) => this._setAutomation(!v.autoEnabled, e)}
                      @keydown=${(e: KeyboardEvent) => this._switchKeydown(e, !v.autoEnabled)}
                    >
                      <div class="m3-switch-thumb"><ha-icon icon="mdi:check"></ha-icon></div>
                    </div>
                  </div>
                `
              : nothing}
          </div>

          <div class="section" data-ref="section" style="max-height:0">
            <div class="section-inner">
              <div class="section-title m3-label-large-emphasized">
                <ha-icon icon="mdi:garage-variant"></ha-icon><span>Garages</span>
              </div>
              <div class="garage-grid">
                ${this._renderPill("left", c.left_label ?? "Left", v.leftHome, v.leftText, v.leftDoor)}
                ${this._renderPill("right", c.right_label ?? "Right", v.rightHome, v.rightText, v.rightDoor)}
              </div>
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }

  /** Only worth a header chip while the card is collapsed if the door isn't
   * simply shut — a closed garage is the unremarkable case.
   *
   * The state is a glyph rather than a word on purpose: worst case this row
   * carries four chips (two doors, two people) next to the switch, and two
   * spelled-out door states pushed the card title into an ellipsis. The
   * word survives in the tooltip and the accessible label. */
  private _renderDoorChip(side: string, door: ComputedDoor | null) {
    if (!door) return nothing;
    if (door.state === "closed" || door.state === "unknown") return nothing;
    const cls = door.moving ? "moving" : door.available ? "open" : "off";
    const icon =
      door.state === "opening"
        ? "mdi:arrow-up"
        : door.state === "closing"
        ? "mdi:arrow-down"
        : door.available
        ? "mdi:garage-open-variant"
        : "mdi:garage-alert-variant";
    const text = `${side} door: ${door.text}`;
    return html`<span class="chip door ${cls} m3-label-small" title=${text} aria-label=${text}
      ><span class="k">${side}</span><ha-icon class="chip-ic" icon=${icon}></ha-icon
    ></span>`;
  }

  private _renderPill(side: string, label: string, isHome: boolean, text: string, door: ComputedDoor | null) {
    return html`
      <div class="garage-pill ${isHome ? "home" : "away"}">
        <ha-icon class="pill-bg-icon" icon=${doorGlyph(door)}></ha-icon>
        <div class="pill-head">
          <div class="pill-left">
            <div class="pill-dot"></div>
            <div class="pill-main">
              <div class="pill-label m3-title-small">${label}</div>
            </div>
          </div>
          <div class="pill-badge m3-label-small">${text}</div>
        </div>
        ${door ? this._renderDoor(side, label, door) : nothing}
      </div>
    `;
  }

  /** Which controls a door is actually offering right now.
   *
   * One at a time, not three with two greyed out: at any given moment a
   * garage door has exactly one sensible next move, and a permanent row of
   * mostly-disabled buttons is a picture of a control rather than a control.
   * The single exception is an unknown state, where there is genuinely
   * nothing to infer from and guessing a direction would move a real door
   * the wrong way. */
  private _doorActions(door: ComputedDoor): DoorAction[] {
    if (!door.available) return [];
    if (door.moving) {
      if (door.canStop) return ["stop"];
      // No STOP support: sending it the other way is the only control left,
      // and it is what a physical opener's single button does anyway.
      if (door.state === "opening") return door.canClose ? ["close"] : [];
      return door.canOpen ? ["open"] : [];
    }
    if (door.state === "unknown") {
      return [
        ...(door.canOpen ? (["open"] as DoorAction[]) : []),
        ...(door.canClose ? (["close"] as DoorAction[]) : []),
      ];
    }
    if (door.state === "open") return door.canClose ? ["close"] : [];
    return door.canOpen ? ["open"] : [];
  }

  private _renderDoor(side: string, label: string, door: ComputedDoor) {
    const actions = this._doorActions(door);
    // A lone control has the whole tile width to spell out what it does, so
    // it carries a word and — where a hold is required — says so. That
    // retires the separate "Hold to move" hint, which had to caveat itself
    // whenever the visible button was Stop (a tap, never a hold).
    const labelled = actions.length === 1;
    return html`
      <div class="door-controls">
        <div class="door-state ${door.moving ? "moving" : door.state} m3-label-medium">
          <ha-icon
            icon=${door.state === "opening"
              ? "mdi:arrow-up"
              : door.state === "closing"
              ? "mdi:arrow-down"
              : door.state === "open"
              ? "mdi:garage-open-variant"
              : "mdi:garage-variant"}
          ></ha-icon>
          <span>${door.text}</span>
        </div>
        <div class="button-group" role="group" aria-label="${label} door">
          ${actions.length === 0
            ? html`
                <button class="segment" disabled aria-label=${`${label} door unavailable`}>
                  <ha-icon icon="mdi:garage-alert-variant"></ha-icon>
                  <span class="seg-label">Unavailable</span>
                </button>
              `
            : actions.map((action) =>
                action === "stop"
                  ? html`
                      <button
                        class="segment stop"
                        title=${`Stop the ${label} door`}
                        aria-label=${`Stop the ${label} door`}
                        @click=${(e: Event) => this._stopDoor(e, door)}
                      >
                        <ha-icon icon="mdi:stop"></ha-icon>
                        ${labelled ? html`<span class="seg-label">Stop</span>` : nothing}
                      </button>
                    `
                  : this._renderHoldSegment(side, label, door, action, labelled)
              )}
        </div>
      </div>
    `;
  }

  private _renderHoldSegment(
    side: string,
    label: string,
    door: ComputedDoor,
    action: "open" | "close",
    labelled: boolean
  ) {
    const key = `${side}:${action}`;
    const holding = this._holding === key;
    const service = action === "open" ? "open_cover" : "close_cover";
    const holdMs = this._holdMs();
    const verb = action === "open" ? "Open" : "Close";
    const text = holdMs > 0 ? `Hold to ${action}` : verb;
    return html`
      <button
        class="segment dir ${action} ${holding ? "holding" : ""}"
        style=${`--hold-ms:${holdMs}ms`}
        title=${`${text} the ${label} door`}
        aria-label=${`${text} the ${label} door`}
        @pointerdown=${(e: PointerEvent) => this._startHold(e, key, door, service)}
        @pointerup=${(e: Event) => this._endHold(e)}
        @pointercancel=${(e: Event) => this._endHold(e)}
        @lostpointercapture=${(e: Event) => this._endHold(e)}
        @keydown=${(e: KeyboardEvent) => this._holdKeydown(e, key, door, service)}
        @keyup=${(e: KeyboardEvent) => this._holdKeyup(e)}
        @blur=${(e: Event) => this._endHold(e)}
        @contextmenu=${(e: Event) => e.preventDefault()}
        @click=${(e: Event) => {
          // The hold already fired (or was aborted) by now; a click here is
          // either the tail of that gesture or the one keyboards synthesise
          // after Enter. Either way it must not act a second time.
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <span class="seg-fill"></span>
        <ha-icon icon=${action === "open" ? "mdi:arrow-up" : "mdi:arrow-down"}></ha-icon>
        ${labelled ? html`<span class="seg-label">${text}</span>` : nothing}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3-garage-auto-open-card": GarageAutoOpenCard;
  }
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string; preview?: boolean }>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "m3-garage-auto-open-card",
  name: "M3 Garage Auto Open Card",
  description: "Auto-open automation status, left/right home/away, and hold-to-move garage door controls",
});
