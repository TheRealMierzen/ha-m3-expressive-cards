import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { GymTrackerCardConfig, HomeAssistant } from "./types";

type EditableConfig = Pick<
  GymTrackerCardConfig,
  | "title"
  | "actual_counter"
  | "target_counter"
  | "adherence_sensor"
  | "monthly_cost_entity"
  | "daily_cost_entity"
  | "money_wasted_entity"
  | "currency"
  | "good_threshold"
  | "ok_threshold"
>;

const SCHEMA = [
  { name: "title", selector: { text: {} } },
  { name: "actual_counter", selector: { entity: { domain: "counter" } } },
  { name: "target_counter", selector: { entity: { domain: "counter" } } },
  { name: "adherence_sensor", selector: { entity: { domain: "sensor" } } },
  { name: "monthly_cost_entity", selector: { entity: { domain: "input_number" } } },
  { name: "daily_cost_entity", selector: { entity: { domain: "number" } } },
  { name: "money_wasted_entity", selector: { entity: { domain: "number" } } },
  { name: "currency", selector: { text: {} } },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "good_threshold", selector: { number: { min: 0, max: 100, mode: "box" } } },
      { name: "ok_threshold", selector: { number: { min: 0, max: 100, mode: "box" } } },
    ],
  },
] as const;

const LABELS: Record<string, string> = {
  title: "Title",
  actual_counter: "Visits logged (counter)",
  target_counter: "Visit target (counter)",
  adherence_sensor: "Adherence % sensor",
  monthly_cost_entity: "Monthly membership cost",
  daily_cost_entity: "Daily cost",
  money_wasted_entity: "Money wasted",
  currency: "Currency symbol",
  good_threshold: "\"Good\" adherence at/above (%)",
  ok_threshold: "\"OK\" adherence at/above (%)",
};

const HELPERS: Record<string, string> = {
  target_counter:
    "Expected to be driven by an automation that increments it on every weekday that isn't a holiday, accumulating across the year. The card's Settings section also exposes a manual ±1-day stepper for exceptions (e.g. travel).",
  adherence_sensor: "Expected as a 0-100 value; the card clamps and rounds it for display.",
  monthly_cost_entity:
    "Editable from the card's Settings section — enter either a monthly or an annual figure via the /mo //yr toggle, and it's converted and written back as a monthly value.",
  daily_cost_entity: "Monthly cost divided across the period — pre-computed elsewhere, this card only displays it.",
  money_wasted_entity: "Cost attributable to missed visits, accumulated for the year — pre-computed elsewhere, this card only displays it.",
  good_threshold: "Defaults to 80.",
  ok_threshold: "Defaults to 50. Below this the ring/badges read as needing attention.",
};

/** Covers all fields via HA's generic `ha-form` — the config surface here
 * is small enough not to need a basic/advanced split. */
@customElement("gym-tracker-card-editor")
export class GymTrackerCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: GymTrackerCardConfig;

  setConfig(config: GymTrackerCardConfig): void {
    this._config = config;
  }

  private get _data(): EditableConfig {
    return {
      title: this._config?.title,
      actual_counter: this._config?.actual_counter,
      target_counter: this._config?.target_counter,
      adherence_sensor: this._config?.adherence_sensor,
      monthly_cost_entity: this._config?.monthly_cost_entity,
      daily_cost_entity: this._config?.daily_cost_entity,
      money_wasted_entity: this._config?.money_wasted_entity,
      currency: this._config?.currency,
      good_threshold: this._config?.good_threshold,
      ok_threshold: this._config?.ok_threshold,
    };
  }

  private _computeLabel = (schema: { name: string }): string => LABELS[schema.name] ?? schema.name;

  private _computeHelper = (schema: { name: string }): string | undefined => HELPERS[schema.name];

  private _valueChanged(ev: CustomEvent<{ value: EditableConfig }>): void {
    if (!this._config) return;
    const newConfig: GymTrackerCardConfig = {
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
    "gym-tracker-card-editor": GymTrackerCardEditor;
  }
}
