import { LitElement, TemplateResult, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { editorStyles } from "./editor.css";
import { HomeAssistant, IrrigationScheduleCardConfig } from "./types";

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
  summary: (config: IrrigationScheduleCardConfig) => string;
}

/** Values the card already assumes when a key is absent. Writing one of these
 * back would only add noise to the YAML. */
const DEFAULTS: Record<string, unknown> = {};

/** Escape hatch for a form field that isn't simply the config key of the
 * same name. Empty here: every field maps 1:1. */
const FORM_READ: Record<string, (config: Record<string, unknown>) => unknown> = {};
const FORM_WRITE: Record<string, (raw: unknown, next: Record<string, unknown>) => void> = {};

const TOP_FIELDS = ["title"] as const;
const TOP_SCHEMA = [{ name: "title", selector: { text: {} } }];

const LABELS: Record<string, string> = {
  title: "Title",
  valve: "Valve switch",
  timer: "Countdown timer",
  duration: "Run duration (minutes)",
  automation: "Scheduling automation",
  should_water: "“Water today” decision",
  start_time: "Scheduled start",
  stop_time: "Scheduled stop",
};

const HELPERS: Record<string, string> = {
  valve:
    "The switch the water actually runs through. Has to be a switch.* — the card calls switch.turn_on/turn_off on it by name. Toggling it from the card always starts or cancels the timer below in the same breath; it is never flipped on its own.",
  timer:
    "Started with the current duration whenever the valve is opened from this card, and cancelled when it's closed. Leave blank to toggle the valve with no countdown.",
  duration:
    "An input_number.* holding minutes. Read when the timer is started, and editable from the card's schedule section.",
  automation:
    "The automation that decides and runs the watering. The card's auto/manual switch enables and disables it.",
  should_water:
    "Whatever the automation writes today's water-or-skip decision into — usually an input_boolean.*. Read-only here.",
  start_time: "A time-only input_datetime.*, “HH:MM:SS”. Editable from the card.",
  stop_time: "A time-only input_datetime.*, and the end of the window the automation may water in.",
};

function wiredSummary(config: IrrigationScheduleCardConfig, fields: readonly string[]): string {
  const record = config as unknown as Record<string, unknown>;
  const set = fields.filter((f) => typeof record[f] === "string" && record[f] !== "").length;
  if (set === 0) return "nothing wired yet";
  if (set === fields.length) return `all ${fields.length} wired`;
  return `${set} of ${fields.length} wired`;
}

const HARDWARE_FIELDS = ["valve", "timer", "duration"] as const;
const SCHEDULE_FIELDS = ["automation", "should_water", "start_time", "stop_time"] as const;

/**
 * Split the way the plumbing is: the three entities the card writes to, then
 * the four it reads to describe today's plan. Each section reads its entities
 * back live, so a mis-picked helper shows up here rather than the first time
 * the valve doesn't open. The form covers the whole config.
 */
const SECTIONS: Section[] = [
  {
    key: "hardware",
    title: "Valve & timer",
    hint: "The parts the card can actually operate.",
    fields: HARDWARE_FIELDS,
    entityFields: HARDWARE_FIELDS,
    schema: [
      { name: "valve", selector: { entity: { filter: { domain: "switch" } } } },
      { name: "timer", selector: { entity: { filter: { domain: "timer" } } } },
      { name: "duration", selector: { entity: { filter: { domain: "input_number" } } } },
    ],
    summary: (config) => wiredSummary(config, HARDWARE_FIELDS),
  },
  {
    key: "schedule",
    title: "Schedule",
    hint: "What the automation has decided for today, and the window it may water in.",
    fields: SCHEDULE_FIELDS,
    entityFields: SCHEDULE_FIELDS,
    schema: [
      { name: "automation", selector: { entity: { filter: { domain: "automation" } } } },
      {
        name: "should_water",
        selector: { entity: { filter: { domain: ["input_boolean", "binary_sensor", "sensor"] } } },
      },
      { name: "start_time", selector: { entity: { filter: { domain: "input_datetime" } } } },
      { name: "stop_time", selector: { entity: { filter: { domain: "input_datetime" } } } },
    ],
    summary: (config) => wiredSummary(config, SCHEDULE_FIELDS),
  },
];

/* ------------------------------------------------------------------- shell */

@customElement("irrigation-schedule-card-editor")
export class IrrigationScheduleCardEditor extends LitElement {
  static styles = editorStyles;

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: IrrigationScheduleCardConfig;
  /** Sections are independent rather than an accordion — wiring one usually
   * means checking it against another in the same pass. */
  @state() private _open: Record<string, boolean> = { hardware: true };

  setConfig(config: IrrigationScheduleCardConfig): void {
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
        detail: { config: next as unknown as IrrigationScheduleCardConfig },
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
    "irrigation-schedule-card-editor": IrrigationScheduleCardEditor;
  }
}
