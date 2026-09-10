import { LitElement, TemplateResult, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { discover, formatUnit } from "./compute";
import { editorStyles } from "./editor.css";
import { HomeAssistant, SmartIrrigationCardConfig } from "./types";

type FormData = Record<string, unknown>;

/** One row of a section's "Reading now" strip. */
interface ReadoutRow {
  label: string;
  id: string;
  /** Overrides the entity's own state, for a row that reads an attribute
   * rather than a state. */
  value?: string;
}

interface Section {
  key: string;
  title: string;
  hint?: string;
  schema: unknown[];
  /** Which config keys this section's form writes. */
  fields: readonly string[];
  /** Header line while the section is closed. */
  summary: (config: SmartIrrigationCardConfig) => string;
  /** What this section's entities report right now. */
  readout?: (config: SmartIrrigationCardConfig, hass: HomeAssistant) => ReadoutRow[];
}

/** Values the card already assumes when a key is absent. Writing one of these
 * back would only add noise to the YAML — and would freeze the card at
 * whatever the default was the day the editor was opened. */
const DEFAULTS: Record<string, unknown> = {
  show_details: true,
  hold_ms: 600,
};

const anyEntity = { entity: {} };
const buttonEntity = { entity: { filter: { domain: "button" } } };

/** Escape hatch for a form field that isn't simply the config key of the same
 * name. Empty here: every field maps 1:1. */
const FORM_READ: Record<string, (config: Record<string, unknown>) => unknown> = {};
const FORM_WRITE: Record<string, (raw: unknown, next: Record<string, unknown>) => void> = {};

const TOP_FIELDS = ["title"] as const;
const TOP_SCHEMA = [{ name: "title", selector: { text: {} } }];

const LABELS: Record<string, string> = {
  title: "Title",
  zones: "Zones to show",
  next_schedule: "Next watering run",
  refresh_weather: "Refresh weather",
  calculate_all: "Calculate all zones",
  irrigate_all: "Irrigate all zones",
  show_details: "Per-zone details",
  deficit_scale: "Sump depth (mm)",
  hold_ms: "Hold time (ms)",
};

const HELPERS: Record<string, string> = {
  zones:
    "Left empty, every zone the card finds, in zone order. Pick the zones' own duration sensors to show only some of them, or to reorder.",
  next_schedule:
    "Smart Irrigation doesn't schedule anything itself — an automation of yours calls its services — so this is the one thing the card can't find. Point it at a schedule helper (its next event is used), an input_datetime, or any sensor whose state is a timestamp. Left empty, the card simply doesn't show a next run.",
  refresh_weather: "Found automatically. Only set these to override what the card picked, or if your entities were renamed.",
  calculate_all: "Found automatically.",
  irrigate_all: "Found automatically. Only offered on the card when there's more than one zone — with one zone it's the same button as that zone's own.",
  show_details:
    "The expandable section under each zone: ET figures, drainage, water used, the multiplier, and the calculate/reset/irrigate actions.",
  deficit_scale:
    "How many mm of deficit fill the band below the gauge's zero line. Left empty, a quarter of each zone's own maximum bucket, so the scale suits the zone.",
  hold_ms: "How long “Hold to irrigate” has to be held. Set 0 to fire on a plain tap instead.",
};

function wiredSummary(config: SmartIrrigationCardConfig, fields: readonly string[]): string {
  const record = config as unknown as Record<string, unknown>;
  const set = fields.filter((f) => typeof record[f] === "string" && record[f] !== "").length;
  if (set === 0) return "all found automatically";
  return set === fields.length ? `all ${fields.length} set by hand` : `${set} of ${fields.length} set by hand`;
}

const ZONE_FIELDS = ["zones"] as const;
const SCHEDULE_FIELDS = ["next_schedule"] as const;
const BUTTON_FIELDS = ["refresh_weather", "calculate_all", "irrigate_all"] as const;
const DISPLAY_FIELDS = ["show_details", "deficit_scale", "hold_ms"] as const;

/**
 * Grouped by where the values come from, not by where they land on the card.
 *
 * Almost nothing here needs filling in: the card finds the integration's
 * zones and service buttons itself, so the form's real job is to *show that
 * it did* — hence the Zones section's readout, which lists what was found and
 * what each zone's bucket currently reads. The one genuinely manual field is
 * the next run, because the integration has no such entity to find. The form
 * covers the whole config; nothing here is YAML-only.
 */
const SECTIONS: Section[] = [
  {
    key: "zones",
    title: "Zones",
    hint: "The card discovers zones by the zone id the integration puts on its own entities, so renaming an entity in HA doesn't hide it.",
    fields: ZONE_FIELDS,
    schema: [{ name: "zones", selector: { entity: { multiple: true, filter: { domain: "sensor" } } } }],
    summary: (config) =>
      config.zones && config.zones.length > 0
        ? `${config.zones.length} chosen by hand`
        : "every zone found, in zone order",
    // Deliberately not the generic entity readout: what proves this section
    // is right is the *bucket* each zone reports, not the duration sensor's
    // own state, and when the list is empty the useful thing to show is what
    // discovery found rather than nothing at all.
    readout: (config, hass) => {
      const found = discover(hass).zones;
      const ids =
        config.zones && config.zones.length > 0 ? config.zones : found.map((zone) => zone.main);
      return ids.map((id) => {
        const entity = hass.states[id];
        const bucket = entity?.attributes.bucket;
        const max = entity?.attributes.maximum_bucket;
        const unit = formatUnit(entity?.attributes.bucket_unit ?? "mm") || "mm";
        return {
          label: entity?.attributes.friendly_name?.replace(/\s+duration$/i, "") ?? id,
          id,
          value:
            typeof bucket === "number"
              ? `bucket ${bucket.toFixed(1)}${max !== undefined ? ` of ${max}` : ""} ${unit}`
              : undefined,
        };
      });
    },
  },
  {
    key: "schedule",
    title: "Schedule",
    hint: "The only field the card can't fill in for itself.",
    fields: SCHEDULE_FIELDS,
    schema: [{ name: "next_schedule", selector: anyEntity }],
    summary: (config) => (config.next_schedule ? "next run wired" : "no next run shown"),
  },
  {
    key: "buttons",
    title: "Integration buttons",
    hint: "The three service buttons Smart Irrigation creates. Found automatically; these are overrides.",
    fields: BUTTON_FIELDS,
    schema: [
      { name: "refresh_weather", selector: buttonEntity },
      { name: "calculate_all", selector: buttonEntity },
      { name: "irrigate_all", selector: buttonEntity },
    ],
    summary: (config) => wiredSummary(config, BUTTON_FIELDS),
    readout: (config, hass) => {
      const found = discover(hass).globals;
      const record = config as unknown as Record<string, unknown>;
      const pairs: Array<[string, string | undefined]> = [
        ["refresh_weather", (record.refresh_weather as string) ?? found.refreshWeather],
        ["calculate_all", (record.calculate_all as string) ?? found.calculateAll],
        ["irrigate_all", (record.irrigate_all as string) ?? found.irrigateAll],
      ];
      return pairs
        .filter((pair): pair is [string, string] => typeof pair[1] === "string")
        .map(([field, id]) => ({ label: LABELS[field] ?? field, id }));
    },
  },
  {
    key: "display",
    title: "Display",
    fields: DISPLAY_FIELDS,
    schema: [
      { name: "show_details", selector: { boolean: {} } },
      { name: "deficit_scale", selector: { number: { min: 0.5, max: 100, step: 0.5, mode: "box" } } },
      { name: "hold_ms", selector: { number: { min: 0, max: 3000, step: 50, mode: "box" } } },
    ],
    summary: (config) =>
      [
        config.show_details === false ? "details off" : "details on",
        config.deficit_scale ? `sump ${config.deficit_scale}mm` : "sump auto",
        `hold ${config.hold_ms ?? DEFAULTS.hold_ms}ms`,
      ].join(" · "),
  },
];

/* ------------------------------------------------------------------- shell */

@customElement("m3-smart-irrigation-card-editor")
export class SmartIrrigationCardEditor extends LitElement {
  static styles = editorStyles;

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: SmartIrrigationCardConfig;
  /** Sections are independent rather than an accordion — wiring one usually
   * means checking it against another in the same pass. */
  @state() private _open: Record<string, boolean> = { zones: true };

  setConfig(config: SmartIrrigationCardConfig): void {
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
   * Cleared fields are deleted rather than written back as an empty string —
   * emptying a picker should remove it from the YAML. A value that merely
   * equals the card's own default is dropped too: pinning it makes the YAML
   * lie about being deliberate.
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
        detail: { config: next as unknown as SmartIrrigationCardConfig },
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
  private _renderReadout(section: Section): TemplateResult | typeof nothing {
    const config = this._config;
    const hass = this.hass;
    if (!config || !hass || !section.readout) return nothing;
    const rows = section.readout(config, hass);
    if (rows.length === 0) return nothing;
    return html`
      <div class="readout">
        <div class="readout-head">Reading now</div>
        ${rows.map((row) => {
          const entity = hass.states[row.id];
          const missing = entity === undefined;
          // `unknown` is not a fault to flag: a button.* reads unknown until
          // its first press, and a fresh sensor until its first value. Only a
          // missing entity or an explicitly unavailable one is wrong.
          const unusable = missing || entity.state === "unavailable";
          const unit = formatUnit(entity?.attributes.unit_of_measurement);
          const text = missing
            ? "not found"
            : (row.value ?? (unit ? `${entity.state} ${unit}` : entity.state));
          return html`
            <div class="ro">
              <span class="ro-label">${row.label}</span>
              <span class=${unusable ? "chip bad" : "chip"} title=${row.id}>${text}</span>
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
                ${this._renderReadout(section)}
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
        @value-changed=${(ev: CustomEvent<{ value: FormData }>) => this._valueChanged(TOP_FIELDS, ev)}
      ></ha-form>
      <div class="sections">${SECTIONS.map((section) => this._renderSection(section))}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3-smart-irrigation-card-editor": SmartIrrigationCardEditor;
  }
}
