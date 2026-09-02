import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { GarageAutoOpenCardConfig, HomeAssistant } from "./types";

type EditableConfig = Pick<
  GarageAutoOpenCardConfig,
  | "title"
  | "automation"
  | "left_entity"
  | "right_entity"
  | "left_cover"
  | "right_cover"
  | "hold_ms"
  | "left_label"
  | "right_label"
  | "home_state"
  | "left_home_state"
  | "right_home_state"
>;

const SCHEMA = [
  { name: "title", selector: { text: {} } },
  { name: "automation", selector: { entity: { domain: "automation" } } },
  { name: "left_entity", selector: { entity: {} } },
  { name: "right_entity", selector: { entity: {} } },
  { name: "left_cover", selector: { entity: { domain: "cover" } } },
  { name: "right_cover", selector: { entity: { domain: "cover" } } },
  {
    name: "hold_ms",
    selector: { number: { min: 0, max: 3000, step: 100, mode: "box", unit_of_measurement: "ms" } },
  },
  { name: "left_label", selector: { text: {} } },
  { name: "right_label", selector: { text: {} } },
  { name: "home_state", selector: { text: {} } },
  { name: "left_home_state", selector: { text: {} } },
  { name: "right_home_state", selector: { text: {} } },
] as const;

const LABELS: Record<string, string> = {
  title: "Title",
  automation: "Auto-open automation",
  left_entity: "Left garage entity",
  right_entity: "Right garage entity",
  left_cover: "Left door (cover)",
  right_cover: "Right door (cover)",
  hold_ms: "Hold duration",
  left_label: "Left label",
  right_label: "Right label",
  home_state: "\"Home\" state value",
  left_home_state: "Left entity's \"home\" state override",
  right_home_state: "Right entity's \"home\" state override",
};

const HELPERS: Record<string, string> = {
  left_cover: "The cover entity for the left garage door. Leave blank to show presence only, with no door controls.",
  right_cover: "The cover entity for the right garage door. Leave blank to show presence only, with no door controls.",
  hold_ms:
    "How long Open/Close must be held before the door moves (default 600ms). Set 0 to move on a plain tap instead. Stop always fires immediately.",
  home_state: "The entity state that counts as \"home\" (e.g. home, on). Defaults to \"home\". Used by both sides unless overridden below.",
  left_home_state: "Overrides the value above for the left entity only — useful when left_entity and right_entity have different state vocabularies (e.g. device_tracker's \"home\" vs an input_boolean's \"on\"). Leave blank to use the default.",
  right_home_state: "Overrides the value above for the right entity only. Leave blank to use the default.",
};

/**
 * Covers the common fields via HA's generic `ha-form`, including a
 * per-entity "home" state override for each side. The list-valued
 * overrides (home_states/left_home_states/right_home_states — multiple
 * acceptable "home" values at once) have no row here — those still
 * require the card dialog's YAML/code-editor view.
 */
@customElement("garage-auto-open-card-editor")
export class GarageAutoOpenCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: GarageAutoOpenCardConfig;

  setConfig(config: GarageAutoOpenCardConfig): void {
    this._config = config;
  }

  private get _data(): EditableConfig {
    return {
      title: this._config?.title,
      automation: this._config?.automation,
      left_entity: this._config?.left_entity,
      right_entity: this._config?.right_entity,
      left_cover: this._config?.left_cover,
      right_cover: this._config?.right_cover,
      hold_ms: this._config?.hold_ms,
      left_label: this._config?.left_label,
      right_label: this._config?.right_label,
      home_state: this._config?.home_state,
      left_home_state: this._config?.left_home_state,
      right_home_state: this._config?.right_home_state,
    };
  }

  private _computeLabel = (schema: { name: string }): string => LABELS[schema.name] ?? schema.name;

  private _computeHelper = (schema: { name: string }): string | undefined => HELPERS[schema.name];

  private _valueChanged(ev: CustomEvent<{ value: EditableConfig }>): void {
    if (!this._config) return;
    const newConfig: GarageAutoOpenCardConfig = {
      ...this._config,
      ...ev.detail.value,
    };
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: newConfig },
        bubbles: true,
        composed: true,
      })
    );
  }

  protected render() {
    if (!this._config || !this.hass) {
      return nothing;
    }
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._data}
        .schema=${SCHEMA}
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
    "garage-auto-open-card-editor": GarageAutoOpenCardEditor;
  }
}
