import { LitElement, TemplateResult, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { editorStyles } from "./editor.css";
import { GeyserStatusCardConfig, HomeAssistant } from "./types";

type FormData = Record<string, unknown>;

interface Section {
  key: string;
  title: string;
  hint?: string;
  schema: unknown[];
  /** Which config keys this section's form writes. */
  fields: readonly string[];
  /** The subset holding entity ids, shown as a live readout under the form. */
  entityFields: readonly string[];
  /** Header line while the section is closed. */
  summary: (config: GeyserStatusCardConfig) => string;
}

/** Values the card already assumes when a key is absent. Writing one of these
 * back would only add noise to the YAML. */
const DEFAULTS: Record<string, unknown> = {};

/** A temperature reading can come from a sensor, a `number`, or an
 * `input_number` somebody maintains by hand — all three read the same way. */
const reading = { entity: { filter: { domain: ["sensor", "number", "input_number"] } } };
/** Anything with a state: these are displayed, never written to, so
 * over-filtering here only hides somebody's perfectly good template sensor. */
const anyEntity = { entity: {} };

/** Escape hatch for a form field that isn't simply the config key of the
 * same name. Empty here: every field maps 1:1. */
const FORM_READ: Record<string, (config: Record<string, unknown>) => unknown> = {};
const FORM_WRITE: Record<string, (raw: unknown, next: Record<string, unknown>) => void> = {};

const TOP_FIELDS = ["title"] as const;
const TOP_SCHEMA = [{ name: "title", selector: { text: {} } }];

const LABELS: Record<string, string> = {
  title: "Title",
  switch: "Power switch",
  current_temp: "Current temperature",
  target_temp: "Target temperature",
  time_to_heat: "Time to heat",
  efficiency: "Heating efficiency",
  heating_automation: "Heating/cooling automation",
  next_shower: "Next shower",
  shower_override_switch: "Shower override",
  default_shower_time: "Default shower time",
};

const HELPERS: Record<string, string> = {
  switch:
    "Powers the heating element directly, and becomes the card's main power toggle. Has to be a switch.* — the card calls switch.turn_on/turn_off on it by name.",
  current_temp: "Read-only. Drives the temperature dial and the heating verdict.",
  target_temp:
    "Has to be an input_number.* — the Settings stepper moves it with input_number.increment/decrement, and reads its own step size off the helper's own min/max/step.",
  time_to_heat: "Minutes remaining, or an “H:MM:SS” duration. Read-only.",
  efficiency: "Read-only, shown as a percentage in the details section.",
  heating_automation:
    "Display only — the card never enables or disables it. Enabled reads as heating, disabled as cooling; one automation drives both.",
  next_shower:
    "Doubles as the override time: while the override below is on, this holds the overridden time itself. There is no separate override-time entity.",
  shower_override_switch:
    "A switch.* or input_boolean.*. Turning it off is what an automation elsewhere watches to reset the next shower back to the default.",
  default_shower_time:
    "Shown for reference in Settings, and compared against the next shower by time of day to decide whether it has been overridden.",
};

function wiredSummary(config: GeyserStatusCardConfig, fields: readonly string[]): string {
  const record = config as unknown as Record<string, unknown>;
  const set = fields.filter((f) => typeof record[f] === "string" && record[f] !== "").length;
  if (set === 0) return "nothing wired yet";
  if (set === fields.length) return `all ${fields.length} wired`;
  return `${set} of ${fields.length} wired`;
}

const HEAT_FIELDS = ["switch", "current_temp", "target_temp"] as const;
const STATUS_FIELDS = ["time_to_heat", "efficiency", "heating_automation"] as const;
const SHOWER_FIELDS = ["next_shower", "shower_override_switch", "default_shower_time"] as const;

/**
 * Grouped the way the card itself reads top to bottom: the parts you touch,
 * then the parts it reports, then the shower schedule bolted onto both. Every
 * section reads its entities back live, so wiring `sensor.geyser_temp` rather
 * than `sensor.geyser_temp_2` is a decision you can check without leaving the
 * dialog. The form covers the whole config — nothing here is YAML-only.
 */
const SECTIONS: Section[] = [
  {
    key: "heating",
    title: "Power & temperature",
    hint: "The three the card can't do without — everything below is optional and simply isn't drawn when left blank.",
    fields: HEAT_FIELDS,
    entityFields: HEAT_FIELDS,
    schema: [
      { name: "switch", selector: { entity: { filter: { domain: "switch" } } } },
      { name: "current_temp", selector: reading },
      { name: "target_temp", selector: { entity: { filter: { domain: "input_number" } } } },
    ],
    summary: (config) => wiredSummary(config, HEAT_FIELDS),
  },
  {
    key: "status",
    title: "Status readouts",
    hint: "Display only. The card never writes to any of these.",
    fields: STATUS_FIELDS,
    entityFields: STATUS_FIELDS,
    schema: [
      { name: "time_to_heat", selector: anyEntity },
      { name: "efficiency", selector: reading },
      { name: "heating_automation", selector: { entity: { filter: { domain: "automation" } } } },
    ],
    summary: (config) => wiredSummary(config, STATUS_FIELDS),
  },
  {
    key: "showers",
    title: "Showers",
    hint: "The override switch and the next-shower time are one mechanism: the switch says an override is active, and the next-shower entity is where the overridden time lives.",
    fields: SHOWER_FIELDS,
    entityFields: SHOWER_FIELDS,
    schema: [
      { name: "next_shower", selector: anyEntity },
      {
        name: "shower_override_switch",
        selector: { entity: { filter: { domain: ["switch", "input_boolean"] } } },
      },
      { name: "default_shower_time", selector: anyEntity },
    ],
    summary: (config) => wiredSummary(config, SHOWER_FIELDS),
  },
];

/* ------------------------------------------------------------------- shell */

@customElement("m3-geyser-status-card-editor")
export class GeyserStatusCardEditor extends LitElement {
  static styles = editorStyles;

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: GeyserStatusCardConfig;
  /** Sections are independent rather than an accordion — wiring one usually
   * means checking it against another in the same pass. */
  @state() private _open: Record<string, boolean> = { heating: true };

  setConfig(config: GeyserStatusCardConfig): void {
    this._config = config;
  }

  private _computeLabel = (schema: { name: string; title?: string }): string =>
    LABELS[schema.name] ?? schema.title ?? schema.name;

  private _computeHelper = (schema: { name: string }): string | undefined => HELPERS[schema.name];

  /** Shows the value the card actually uses, so a default the card applies
   * internally isn't presented as an empty field. */
  private _dataFor(fields: readonly string[]): FormData {
    const config = this._config as Record<string, unknown> | undefined;
    const data: FormData = {};
    if (!config) return data;
    for (const key of fields) {
      const read = FORM_READ[key];
      data[key] = read ? read(config) : (config[key] ?? DEFAULTS[key]);
    }
    return data;
  }

  /**
   * Only the keys the emitting form owns are reconciled, so one section can't
   * clobber another's, and keys this form doesn't cover survive untouched.
   *
   * Cleared fields are deleted rather than written back as `""` — emptying a
   * picker should remove it from the YAML, not leave an empty string behind.
   * A value that merely equals the card's own default is dropped too: pinning
   * it makes the YAML lie about being deliberate and freezes the card at
   * whatever the default happened to be the day the editor was opened.
   */
  private _valueChanged(fields: readonly string[], ev: CustomEvent<{ value: FormData }>): void {
    if (!this._config) return;
    ev.stopPropagation();
    const value = ev.detail.value ?? {};
    const next: Record<string, unknown> = { ...this._config };
    for (const key of fields) {
      const raw = value[key];
      const write = FORM_WRITE[key];
      if (write) {
        write(raw, next);
        continue;
      }
      const empty =
        raw === undefined ||
        raw === null ||
        raw === "" ||
        (Array.isArray(raw) && raw.length === 0) ||
        (typeof raw === "number" && !Number.isFinite(raw));
      if (empty || (key in DEFAULTS && raw === DEFAULTS[key])) delete next[key];
      else next[key] = raw;
    }
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: next as unknown as GeyserStatusCardConfig },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _toggle(key: string): void {
    this._open = { ...this._open, [key]: !this._open[key] };
  }

  /** What each wired entity is reporting right now. Picking the right one out
   * of a list of near-identical entity ids is the actual work of these forms,
   * and its current value is the only proof you got it right. */
  private _renderReadout(fields: readonly string[]): TemplateResult | typeof nothing {
    const config = this._config as Record<string, unknown> | undefined;
    const hass = this.hass;
    if (!config || !hass) return nothing;
    const rows = fields
      .map((field) => ({ field, id: config[field] }))
      .filter((row): row is { field: string; id: string } => typeof row.id === "string" && row.id !== "");
    if (rows.length === 0) return nothing;
    return html`
      <div class="readout">
        <div class="readout-head">Reading now</div>
        ${rows.map(({ field, id }) => {
          const entity = hass.states[id];
          const missing = entity === undefined;
          // `unknown` is not a fault to flag: a button.* reads unknown until
          // its first press, and a fresh sensor until its first value. Only a
          // missing entity or an explicitly unavailable one is wrong.
          const unusable = missing || entity.state === "unavailable";
          const unit = entity?.attributes.unit_of_measurement as string | undefined;
          const text = missing ? "not found" : unit ? `${entity.state} ${unit}` : entity.state;
          return html`
            <div class="ro">
              <span class="ro-label">${LABELS[field] ?? field}</span>
              <span class=${unusable ? "chip bad" : "chip"} title=${id}>${text}</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderSection(section: Section): TemplateResult {
    const open = this._open[section.key] === true;
    return html`
      <div class=${open ? "row open" : "row"}>
        <button
          class="row-head"
          type="button"
          aria-expanded=${open ? "true" : "false"}
          @click=${() => this._toggle(section.key)}
        >
          <span class="row-text">
            <div class="row-title">${section.title}</div>
            <div class="row-sub">${section.summary(this._config!)}</div>
          </span>
          <span class="chev">
            <ha-icon icon=${open ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>
          </span>
        </button>
        ${open
          ? html`
              <div class="row-body">
                ${section.hint ? html`<div class="hint">${section.hint}</div>` : nothing}
                <ha-form
                  .hass=${this.hass}
                  .data=${this._dataFor(section.fields)}
                  .schema=${section.schema}
                  .computeLabel=${this._computeLabel}
                  .computeHelper=${this._computeHelper}
                  @value-changed=${(ev: CustomEvent<{ value: FormData }>) =>
                    this._valueChanged(section.fields, ev)}
                ></ha-form>
                ${this._renderReadout(section.entityFields)}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  protected render() {
    if (!this._config || !this.hass) {
      return nothing;
    }
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._dataFor(TOP_FIELDS)}
        .schema=${TOP_SCHEMA}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${(ev: CustomEvent<{ value: FormData }>) =>
          this._valueChanged(TOP_FIELDS, ev)}
      ></ha-form>
      <div class="sections">${SECTIONS.map((section) => this._renderSection(section))}</div>
      
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3-geyser-status-card-editor": GeyserStatusCardEditor;
  }
}
