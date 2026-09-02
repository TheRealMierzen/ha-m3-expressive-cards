import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { GeyserStatusCardConfig, HomeAssistant } from "./types";

type EditableConfig = Omit<GeyserStatusCardConfig, "type">;

const SCHEMA = [
  { name: "title", selector: { text: {} } },
  { name: "switch", selector: { entity: { domain: "switch" } } },
  { name: "current_temp", selector: { entity: {} } },
  { name: "target_temp", selector: { entity: { domain: "input_number" } } },
  { name: "time_to_heat", selector: { entity: {} } },
  { name: "next_shower", selector: { entity: {} } },
  { name: "heating_automation", selector: { entity: { domain: "automation" } } },
  { name: "efficiency", selector: { entity: {} } },
  { name: "shower_override_switch", selector: { entity: { domain: ["switch", "input_boolean"] } } },
  { name: "default_shower_time", selector: { entity: {} } },
] as const;

const LABELS: Record<string, string> = {
  title: "Title",
  switch: "Power switch",
  current_temp: "Current temperature sensor",
  target_temp: "Target temperature helper",
  time_to_heat: "Time-to-heat sensor",
  next_shower: "Next scheduled shower",
  heating_automation: "Heating/cooling automation",
  efficiency: "Heating efficiency sensor",
  shower_override_switch: "Shower override toggle",
  default_shower_time: "Default shower time",
};

const HELPERS: Record<string, string> = {
  switch: "Powers the heating element directly. Shown as the main power toggle.",
  heating_automation: "Display only — enabled means heating, disabled means cooling.",
  shower_override_switch:
    "A switch.* or input_boolean.* — when on, next_shower itself holds the overridden time (there's no separate override-time entity).",
  default_shower_time: "What next_shower gets reset to when the override switch turns off. Shown for reference only.",
};

/** Covers every field via HA's generic `ha-form` — the config surface here
 * is small enough not to need a basic/advanced split. */
@customElement("geyser-status-card-editor")
export class GeyserStatusCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: GeyserStatusCardConfig;

  setConfig(config: GeyserStatusCardConfig): void {
    this._config = config;
  }

  private get _data(): EditableConfig {
    return {
      title: this._config?.title,
      switch: this._config?.switch,
      current_temp: this._config?.current_temp,
      target_temp: this._config?.target_temp,
      time_to_heat: this._config?.time_to_heat,
      next_shower: this._config?.next_shower,
      heating_automation: this._config?.heating_automation,
      efficiency: this._config?.efficiency,
      shower_override_switch: this._config?.shower_override_switch,
      default_shower_time: this._config?.default_shower_time,
    };
  }

  private _computeLabel = (schema: { name: string }): string => LABELS[schema.name] ?? schema.name;

  private _computeHelper = (schema: { name: string }): string | undefined => HELPERS[schema.name];

  private _valueChanged(ev: CustomEvent<{ value: EditableConfig }>): void {
    if (!this._config) return;
    const newConfig: GeyserStatusCardConfig = {
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
    "geyser-status-card-editor": GeyserStatusCardEditor;
  }
}
