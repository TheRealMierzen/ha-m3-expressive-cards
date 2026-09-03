import { LitElement, TemplateResult, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { editorStyles } from "./editor.css";
import { GymTrackerCardConfig, HomeAssistant } from "./types";

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
  summary: (config: GymTrackerCardConfig) => string;
}

/** Values the card already assumes when a key is absent, so the form can show
 * them without persisting them. */
const DEFAULTS: Record<string, unknown> = {
  currency: "R",
  good_threshold: 80,
  ok_threshold: 50,
};

/** Escape hatch for a form field that isn't simply the config key of the
 * same name. Empty here: every field maps 1:1. */
const FORM_READ: Record<string, (config: Record<string, unknown>) => unknown> = {};
const FORM_WRITE: Record<string, (raw: unknown, next: Record<string, unknown>) => void> = {};

const TOP_FIELDS = ["title"] as const;
const TOP_SCHEMA = [{ name: "title", selector: { text: {} } }];

const LABELS: Record<string, string> = {
  title: "Title",
  actual_counter: "Visits logged",
  target_counter: "Visit target",
  adherence_sensor: "Adherence %",
  monthly_cost_entity: "Monthly membership cost",
  daily_cost_entity: "Cost per day",
  money_wasted_entity: "Money wasted",
  currency: "Currency symbol",
  good_threshold: "“Good” at or above",
  ok_threshold: "“OK” at or above",
};

const HELPERS: Record<string, string> = {
  actual_counter:
    "A counter.* incremented once per visit. Has to be a counter — the card's stepper uses counter.increment/decrement.",
  target_counter:
    "A counter.* accumulating the visits you *should* have made — normally driven by an automation ticking it on every non-holiday weekday. The card's Settings section adds a manual ±1 stepper for the exceptions that automation can't know about, like travel.",
  adherence_sensor:
    "Expected as a plain 0–100 number; the card clamps and rounds it for display rather than recomputing it.",
  monthly_cost_entity:
    "An input_number.*, and the one cost figure the card writes to: Settings takes either a monthly or an annual amount via the /mo · /yr toggle and stores the monthly equivalent with input_number.set_value.",
  daily_cost_entity: "Pre-computed elsewhere; the card only displays it.",
  money_wasted_entity:
    "Cost attributable to missed visits, accumulated over the year. Pre-computed elsewhere; the card only displays it.",
  currency: "Prefixed to every cost figure. Defaults to R.",
  good_threshold: "Adherence at or above this reads as good — the ring and badges go green. Defaults to 80.",
  ok_threshold:
    "Between this and “good” reads as OK; below it the ring and badges read as needing attention. Defaults to 50, and should stay below the “good” figure.",
};

function wiredSummary(config: GymTrackerCardConfig, fields: readonly string[]): string {
  const record = config as unknown as Record<string, unknown>;
  const set = fields.filter((f) => typeof record[f] === "string" && record[f] !== "").length;
  if (set === 0) return "nothing wired yet";
  if (set === fields.length) return `all ${fields.length} wired`;
  return `${set} of ${fields.length} wired`;
}

const VISIT_FIELDS = ["actual_counter", "target_counter", "adherence_sensor"] as const;
const COST_ENTITY_FIELDS = [
  "monthly_cost_entity",
  "daily_cost_entity",
  "money_wasted_entity",
] as const;
const COST_FIELDS = [...COST_ENTITY_FIELDS, "currency"] as const;
const BAND_FIELDS = ["good_threshold", "ok_threshold"] as const;

/**
 * Visits, then money, then the two numbers that decide what counts as doing
 * well — which is also the order the card reads in. The entity sections read
 * their entities back live, so a mis-picked counter is visible here rather
 * than after the next stepper press moves the wrong one.
 */
const SECTIONS: Section[] = [
  {
    key: "visits",
    title: "Visits",
    hint: "Logged against target. Adherence is read, not derived — the card trusts the sensor.",
    fields: VISIT_FIELDS,
    entityFields: VISIT_FIELDS,
    schema: [
      { name: "actual_counter", selector: { entity: { filter: { domain: "counter" } } } },
      { name: "target_counter", selector: { entity: { filter: { domain: "counter" } } } },
      {
        name: "adherence_sensor",
        selector: { entity: { filter: { domain: ["sensor", "number", "input_number"] } } },
      },
    ],
    summary: (config) => wiredSummary(config, VISIT_FIELDS),
  },
  {
    key: "cost",
    title: "Cost",
    hint: "Only the monthly figure is editable from the card; the other two are read-only displays.",
    fields: COST_FIELDS,
    entityFields: COST_ENTITY_FIELDS,
    schema: [
      { name: "monthly_cost_entity", selector: { entity: { filter: { domain: "input_number" } } } },
      {
        name: "daily_cost_entity",
        selector: { entity: { filter: { domain: ["number", "sensor", "input_number"] } } },
      },
      {
        name: "money_wasted_entity",
        selector: { entity: { filter: { domain: ["number", "sensor", "input_number"] } } },
      },
      { name: "currency", selector: { text: {} } },
    ],
    summary: (config) => wiredSummary(config, COST_ENTITY_FIELDS),
  },
  {
    key: "bands",
    title: "Adherence bands",
    hint: "Where the ring changes colour. Leave both alone unless the defaults read wrong for you.",
    fields: BAND_FIELDS,
    entityFields: [],
    schema: [
      {
        type: "grid",
        name: "",
        schema: [
          { name: "good_threshold", selector: { number: { min: 0, max: 100, mode: "box", unit_of_measurement: "%" } } },
          { name: "ok_threshold", selector: { number: { min: 0, max: 100, mode: "box", unit_of_measurement: "%" } } },
        ],
      },
    ],
    summary: (config) => {
      const good = config.good_threshold ?? 80;
      const ok = config.ok_threshold ?? 50;
      const suffix = ok >= good ? " — “OK” is not below “good”" : "";
      return `good ≥ ${good}% · ok ≥ ${ok}%${suffix}`;
    },
  },
];

/* ------------------------------------------------------------------- shell */

@customElement("gym-tracker-card-editor")
export class GymTrackerCardEditor extends LitElement {
  static styles = editorStyles;

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: GymTrackerCardConfig;
  /** Sections are independent rather than an accordion — wiring one usually
   * means checking it against another in the same pass. */
  @state() private _open: Record<string, boolean> = { visits: true };

  setConfig(config: GymTrackerCardConfig): void {
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
        detail: { config: next as unknown as GymTrackerCardConfig },
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
    "gym-tracker-card-editor": GymTrackerCardEditor;
  }
}
