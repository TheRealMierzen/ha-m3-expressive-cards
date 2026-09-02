import { LitElement, html, nothing, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "./quick-toggles-card-editor";
import { cardStyles } from "./card.css";
import { medallionStyles } from "./medallion.css";
import { configuredToggleCount, renderSignature, resolveItems, splitService } from "./compute";
import { isOnState } from "./conditions";
import { renderMedallion } from "./medallion";
import {
  ActionConfig,
  ActionName,
  ActionSpec,
  HomeAssistant,
  QuickTogglesCardConfig,
  ResolvedItem,
  ResolvedToggle,
  ToggleItemConfig,
} from "./types";

const DEFAULT_CONFIG: Partial<QuickTogglesCardConfig> = {
  size: "md",
  // Every row divides the card's width evenly instead of bunching at the
  // left edge.
  align: "even",
  columns: "auto",
};

/** How long an optimistic flip is trusted before falling back to whatever
 * HA actually reports — long enough for a slow round-trip, short enough that
 * a failed service call doesn't leave a permanently lying medallion. */
const PENDING_TTL_MS = 4000;
const HOLD_MS = 500;
const CONFIRM_MS = 2000;
const FLASH_MS = 700;

function normalizeAction(spec: ActionSpec | undefined, fallback: ActionName): ActionConfig {
  if (spec === undefined) return { action: fallback };
  if (typeof spec === "string") return { action: spec };
  return spec;
}

@customElement("quick-toggles-card")
export class QuickTogglesCard extends LitElement {
  static styles = [medallionStyles, cardStyles];

  /** Set by HA while the dashboard is in edit mode. A card that hides itself
   * because every toggle is currently hidden would otherwise be impossible to
   * select and edit — the same escape hatch HA's own conditional card uses. */
  @property({ type: Boolean }) public editMode = false;

  private _hass?: HomeAssistant;
  private _lastSignature = "";

  @state() private _config!: QuickTogglesCardConfig;
  @state() private _pending: Record<string, boolean> = {};
  @state() private _armedIndex: number | null = null;
  @state() private _flashIndex: number | null = null;
  @state() private _pressingIndex: number | null = null;
  @state() private _reducedMotion = false;

  private _pendingTimers = new Map<string, number>();
  private _armedTimer?: number;
  private _flashTimer?: number;
  private _holdTimer?: number;
  private _holdFired = false;
  private _motionQuery?: MediaQueryList;
  private _onMotionChange = (): void => {
    this._reducedMotion = Boolean(this._motionQuery?.matches);
  };

  connectedCallback(): void {
    super.connectedCallback();
    if (typeof matchMedia === "function") {
      this._motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
      this._reducedMotion = this._motionQuery.matches;
      this._motionQuery.addEventListener("change", this._onMotionChange);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._motionQuery?.removeEventListener("change", this._onMotionChange);
    for (const timer of this._pendingTimers.values()) clearTimeout(timer);
    this._pendingTimers.clear();
    clearTimeout(this._armedTimer);
    clearTimeout(this._flashTimer);
    clearTimeout(this._holdTimer);
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    // HA's own theme setting, not prefers-color-scheme — the OS theme and
    // HA's theme toggle can disagree, and the card should follow HA.
    this.setAttribute("data-theme", hass.themes?.darkMode ? "dark" : "light");
    if (!this._config) return;
    this._reconcilePending(hass);
    const signature = renderSignature(hass, this._config);
    if (signature === this._lastSignature) return;
    this._lastSignature = signature;
    this.requestUpdate();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  setConfig(config: QuickTogglesCardConfig): void {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    if (config.toggles !== undefined && !Array.isArray(config.toggles)) {
      throw new Error("`toggles` must be a list");
    }
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._lastSignature = "";
    this._clearPending();
    this._armedIndex = null;
    this._flashIndex = null;
    this._pressingIndex = null;
  }

  static getStubConfig(): QuickTogglesCardConfig {
    return { type: "custom:quick-toggles-card", title: "Quick toggles", toggles: [] };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("quick-toggles-card-editor");
  }

  /* ----------------------------------------------------- optimistic state */

  /** Drops an optimistic flip as soon as HA reports the state it predicted. */
  private _reconcilePending(hass: HomeAssistant): void {
    const ids = Object.keys(this._pending);
    if (ids.length === 0) return;
    let changed = false;
    const next = { ...this._pending };
    for (const id of ids) {
      const entity = hass.states[id];
      if (!entity) continue;
      if (isOnState(entity.state) === next[id]) {
        delete next[id];
        this._clearPendingTimer(id);
        changed = true;
      }
    }
    if (changed) this._pending = next;
  }

  private _clearPendingTimer(id: string): void {
    const timer = this._pendingTimers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this._pendingTimers.delete(id);
    }
  }

  private _clearPending(): void {
    for (const timer of this._pendingTimers.values()) clearTimeout(timer);
    this._pendingTimers.clear();
    this._pending = {};
  }

  private _setPending(id: string, value: boolean): void {
    this._clearPendingTimer(id);
    this._pending = { ...this._pending, [id]: value };
    this._pendingTimers.set(
      id,
      window.setTimeout(() => {
        this._pendingTimers.delete(id);
        const next = { ...this._pending };
        delete next[id];
        this._pending = next;
      }, PENDING_TTL_MS)
    );
  }

  private _flash(index: number): void {
    clearTimeout(this._flashTimer);
    // Restart the CSS animation on a repeated press: the class has to leave
    // the DOM for a frame or the keyframes won't replay.
    this._flashIndex = null;
    void this.updateComplete.then(() => {
      this._flashIndex = index;
      this._flashTimer = window.setTimeout(() => {
        this._flashIndex = null;
      }, FLASH_MS);
    });
  }

  private _arm(index: number): void {
    clearTimeout(this._armedTimer);
    this._armedIndex = index;
    this._armedTimer = window.setTimeout(() => {
      this._armedIndex = null;
    }, CONFIRM_MS);
  }

  private _disarm(): void {
    clearTimeout(this._armedTimer);
    this._armedIndex = null;
  }

  /* ------------------------------------------------------------ interaction */

  private _fireAction(item: ToggleItemConfig, resolved: ResolvedToggle, spec: ActionConfig): void {
    const hass = this._hass;
    if (!hass) return;

    switch (spec.action) {
      case "none":
        return;

      case "more-info": {
        if (!item.entity) return;
        this.dispatchEvent(
          new CustomEvent("hass-more-info", {
            bubbles: true,
            composed: true,
            detail: { entityId: item.entity },
          })
        );
        return;
      }

      case "call-service": {
        const parts = splitService(spec.service);
        if (!parts) return;
        const data: Record<string, unknown> = { ...(spec.service_data ?? {}) };
        if (data.entity_id === undefined && item.entity) data.entity_id = item.entity;
        hass.callService(parts[0], parts[1], data);
        return;
      }

      case "toggle":
      default: {
        if (!item.entity) return;
        // Domain-agnostic on purpose: the same code works whether the entity
        // is a switch.*, an input_boolean.* or anything else toggleable.
        hass.callService("homeassistant", "toggle", { entity_id: item.entity });
        if (!resolved.momentary) this._setPending(item.entity, !resolved.on);
        return;
      }
    }
  }

  private _activate(index: number, resolved: ResolvedToggle, hold: boolean): void {
    const item = this._config.toggles?.[index];
    if (!item) return;

    const spec = hold
      ? normalizeAction(item.hold_action, "more-info")
      : normalizeAction(item.tap_action, "toggle");

    // Hold deliberately bypasses `confirm` — more-info is non-destructive,
    // and needing two holds to inspect an entity would be absurd.
    if (!hold && item.confirm === true && this._armedIndex !== index) {
      this._arm(index);
      return;
    }
    this._disarm();

    if (resolved.momentary && !hold) this._flash(index);
    this._fireAction(item, resolved, spec);
  }

  private _onPointerDown(e: PointerEvent, index: number, resolved: ResolvedToggle): void {
    if (e.button !== undefined && e.button !== 0) return;
    // Keeps pointerup/cancel coming to this element even if the finger
    // slides off the medallion mid-hold.
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    this._pressingIndex = index;
    this._holdFired = false;
    clearTimeout(this._holdTimer);
    this._holdTimer = window.setTimeout(() => {
      this._holdFired = true;
      this._pressingIndex = null;
      this._activate(index, resolved, true);
    }, HOLD_MS);
  }

  private _onPointerUp(index: number, resolved: ResolvedToggle): void {
    clearTimeout(this._holdTimer);
    this._pressingIndex = null;
    if (this._holdFired) {
      this._holdFired = false;
      return;
    }
    this._activate(index, resolved, false);
  }

  private _onPointerCancel(): void {
    clearTimeout(this._holdTimer);
    this._pressingIndex = null;
    this._holdFired = false;
  }

  private _onKeydown(e: KeyboardEvent, index: number, resolved: ResolvedToggle): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    this._activate(index, resolved, false);
  }

  /* ---------------------------------------------------------------- render */

  private _renderItem(item: ResolvedItem): TemplateResult {
    if (item.kind === "divider") {
      return html`<div class="divider" aria-hidden="true"></div>`;
    }
    const config = this._config.toggles?.[item.index];
    const latching = !item.momentary && config?.tap_action !== "more-info";
    const title = item.armed ? `${item.label} — tap again to confirm` : item.label;

    return html`
      <button
        class="slot"
        type="button"
        title=${title}
        aria-label=${title}
        aria-pressed=${latching ? String(item.on) : nothing}
        @pointerdown=${(e: PointerEvent) => this._onPointerDown(e, item.index, item)}
        @pointerup=${() => this._onPointerUp(item.index, item)}
        @pointercancel=${() => this._onPointerCancel()}
        @keydown=${(e: KeyboardEvent) => this._onKeydown(e, item.index, item)}
      >
        ${renderMedallion(item, this._pressingIndex === item.index)}
      </button>
    `;
  }

  protected render() {
    if (!this._config || !this._hass) {
      return nothing;
    }
    const config = this._config;
    const items = resolveItems(this._hass, config, {
      pending: this._pending,
      armedIndex: this._armedIndex,
      flashIndex: this._flashIndex,
      reducedMotion: this._reducedMotion,
    });

    const columns = typeof config.columns === "number" && config.columns > 0 ? config.columns : null;
    const rowClasses = [
      "row",
      `size-${config.size ?? "md"}`,
      columns ? "grid" : `align-${config.align ?? "even"}`,
    ].join(" ");

    const visibleToggles = items.some((item) => item.kind === "toggle");
    const configured = configuredToggleCount(config) > 0;
    // Everything hidden by its own visibility rule: collapse the whole card
    // rather than leaving an empty panel on the dashboard. An unconfigured
    // card still renders, so it can be found and set up in the editor.
    const hideCard = configured && !visibleToggles && !this.editMode;
    this.toggleAttribute("hidden", hideCard);
    if (hideCard) return nothing;

    return html`
      <ha-card>
        <div class=${config.title ? "wrap" : "wrap no-title"}>
          ${config.title ? html`<div class="title m3-title-small">${config.title}</div>` : nothing}
          ${visibleToggles
            ? html`
                <div class=${rowClasses} style=${columns ? `--qt-columns:${columns}` : nothing}>
                  ${items.map((item) => this._renderItem(item))}
                </div>
              `
            : html`<div class="title m3-body-small" style="margin:0;opacity:.55">
                No toggles configured yet — add one in the card editor.
              </div>`}
        </div>
      </ha-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "quick-toggles-card": QuickTogglesCard;
  }
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string; preview?: boolean }>;
  }
}

// Without this the card works via YAML but never appears in "Add Card".
window.customCards = window.customCards ?? [];
window.customCards.push({
  type: "quick-toggles-card",
  name: "Quick Toggles",
  description:
    "A row of icon-only toggle medallions, with per-toggle icons, colours and condition-driven animations.",
});
