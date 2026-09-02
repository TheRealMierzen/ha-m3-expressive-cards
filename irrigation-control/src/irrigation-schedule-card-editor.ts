import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant, IrrigationScheduleCardConfig } from "./types";

type EditableConfig = Pick<
  IrrigationScheduleCardConfig,
  "title" | "automation" | "should_water" | "start_time" | "stop_time" | "duration" | "timer" | "valve"
>;

const SCHEMA = [
  { name: "title", selector: { text: {} } },
  { name: "automation", selector: { entity: { domain: "automation" } } },
  { name: "should_water", selector: { entity: {} } },
  { name: "start_time", selector: { entity: { domain: "input_datetime" } } },
  { name: "stop_time", selector: { entity: { domain: "input_datetime" } } },
  { name: "duration", selector: { entity: { domain: "input_number" } } },
  { name: "timer", selector: { entity: { domain: "timer" } } },
  { name: "valve", selector: { entity: { domain: "switch" } } },
] as const;

const LABELS: Record<string, string> = {
  title: "Title",
  automation: "AI scheduling automation",
  should_water: "\"Should water today\" helper",
  start_time: "Scheduled start time",
  stop_time: "Scheduled stop time",
  duration: "Duration (minutes) helper",
  timer: "Countdown timer",
  valve: "Valve switch",
};

const HELPERS: Record<string, string> = {
  should_water: "input_boolean (or similar) the automation sets to decide whether to water today.",
  timer: "Started/cancelled automatically whenever the valve is toggled from this card, using the current duration value.",
  valve: "Manual toggle from this card always pairs with starting or cancelling the timer above — never toggled alone.",
};

/** Covers all fields via HA's generic `ha-form` — the config surface here
 * is small enough not to need a basic/advanced split. */
@customElement("irrigation-schedule-card-editor")
export class IrrigationScheduleCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: IrrigationScheduleCardConfig;

  setConfig(config: IrrigationScheduleCardConfig): void {
    this._config = config;
  }

  private get _data(): EditableConfig {
    return {
      title: this._config?.title,
      automation: this._config?.automation,
      should_water: this._config?.should_water,
      start_time: this._config?.start_time,
      stop_time: this._config?.stop_time,
      duration: this._config?.duration,
      timer: this._config?.timer,
      valve: this._config?.valve,
    };
  }

  private _computeLabel = (schema: { name: string }): string => LABELS[schema.name] ?? schema.name;

  private _computeHelper = (schema: { name: string }): string | undefined => HELPERS[schema.name];

  private _valueChanged(ev: CustomEvent<{ value: EditableConfig }>): void {
    if (!this._config) return;
    const newConfig: IrrigationScheduleCardConfig = {
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
    "irrigation-schedule-card-editor": IrrigationScheduleCardEditor;
  }
}
