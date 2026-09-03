import { LitElement, TemplateResult, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { editorStyles } from "./editor.css";
import { BodyStatsCardConfig, HomeAssistant } from "./types";

/** Every key the form owns. Anything else in the config is carried through
 * untouched, so a YAML-only option can't be destroyed by opening the form. */
const EDITED_KEYS = [
  "title",
  "sex",
  "age",
  "weight_entity",
  "bmi_entity",
  "body_fat_entity",
  "visceral_fat_entity",
  "muscle_mass_entity",
  "bone_mass_entity",
  "water_entity",
  "protein_entity",
  "resting_hr_entity",
  "sleep_efficiency_entity",
  "eyesight_left_entity",
  "eyesight_right_entity",
] as const;

type EditableKey = (typeof EDITED_KEYS)[number];
type FormData = Partial<Record<string, unknown>>;

/** A body metric can be a plain sensor, a `number` from an integration, or an
 * `input_number` somebody types into by hand — all three read the same way
 * here, so none of them should be filtered out of the picker. */
const metric = {
  entity: { filter: { domain: ["sensor", "number", "input_number"] } },
};

interface Section {
  key: string;
  title: string;
  hint?: string;
  schema: unknown[];
  /** Which config keys this section's form writes. */
  fields: EditableKey[];
  /** The subset holding entity ids, shown as a live readout under the form. */
  entityFields: EditableKey[];
  /** Header line when the section is closed. */
  summary: (config: BodyStatsCardConfig) => string;
}

const LABELS: Record<string, string> = {
  title: "Title",
  sex: "Sex",
  age: "Age",
  weight_entity: "Weight",
  bmi_entity: "BMI",
  body_fat_entity: "Body fat %",
  visceral_fat_entity: "Visceral fat",
  muscle_mass_entity: "Muscle mass",
  bone_mass_entity: "Bone mass",
  water_entity: "Body water %",
  protein_entity: "Protein %",
  resting_hr_entity: "Resting heart rate",
  sleep_efficiency_entity: "Sleep efficiency %",
  eyesight_left_entity: "Left eye",
  eyesight_right_entity: "Right eye",
};

const EYE_HELPER =
  "A Snellen denominator — 20 for 20/20 vision, 40 for 20/40 — so lower is better. Drawn as the eyes and coloured on its own; it deliberately doesn't affect the head's colour. Edit compute.ts if your sensor reports logMAR or diopters instead.";

const HELPERS: Record<string, string> = {
  weight_entity:
    "A chip in the header. It takes BMI's colour rather than being judged on its own — a fixed target weight means nothing without a height to go with it.",
  bmi_entity: "Colours the header's weight chip.",
  body_fat_entity: "Colours the torso, together with visceral fat.",
  visceral_fat_entity:
    "A badge on the belly, and the torso's second opinion — whichever of the two reads worse wins.",
  muscle_mass_entity: "Colours both arms. One sensor mirrored, not a left/right split.",
  bone_mass_entity: "Colours both legs, where the long bones are.",
  water_entity:
    "A badge on the left elbow, mirroring protein for symmetry only — hydration has no honest link to the arm, so it doesn't feed the arms' colour.",
  protein_entity:
    "A badge on the right elbow, and the arms' second opinion alongside muscle mass — protein is muscle's raw material.",
  resting_hr_entity: "A pin on the chest, judged on its own rather than as part of a region.",
  sleep_efficiency_entity: "Colours the head.",
  eyesight_left_entity: EYE_HELPER,
  eyesight_right_entity: EYE_HELPER,
  sex: "Sharpens the researched bands for body fat, muscle mass, bone mass and body water, which genuinely differ by sex. Leave unset for a blended unisex band on all four.",
  age: "Sharpens the muscle-mass band alone, from an all-ages envelope down to the exact age bracket. Leave unset to keep the envelope.",
};

function wiredSummary(config: BodyStatsCardConfig, fields: EditableKey[]): string {
  const set = fields.filter((f) => typeof config[f] === "string" && config[f] !== "").length;
  if (set === 0) return "nothing wired yet";
  return `${set} of ${fields.length} wired`;
}

const SCALE_FIELDS: EditableKey[] = [
  "weight_entity",
  "bmi_entity",
  "body_fat_entity",
  "visceral_fat_entity",
  "muscle_mass_entity",
  "bone_mass_entity",
  "water_entity",
  "protein_entity",
];

const WEARABLE_FIELDS: EditableKey[] = ["resting_hr_entity", "sleep_efficiency_entity"];
const EYE_FIELDS: EditableKey[] = ["eyesight_left_entity", "eyesight_right_entity"];

/**
 * Grouped by where the numbers come from — a scale, a wearable, an eye test —
 * rather than by where they land on the body, because a scale's twelve
 * near-identically named sensors is the actual problem to be solved here.
 * Every section reads back what its entities report right now, so picking
 * `sensor.body_fat` over `sensor.body_fat_2` is a decision you can check
 * without leaving the dialog.
 */
const SECTIONS: Section[] = [
  {
    key: "scale",
    title: "Smart scale",
    hint: "The eight body-composition figures. Anything left blank is simply not drawn — the body renders fine with a partial set.",
    fields: SCALE_FIELDS,
    entityFields: SCALE_FIELDS,
    schema: SCALE_FIELDS.map((name) => ({ name, selector: metric })),
    summary: (config) => wiredSummary(config, SCALE_FIELDS),
  },
  {
    key: "wearable",
    title: "Wearable",
    fields: WEARABLE_FIELDS,
    entityFields: WEARABLE_FIELDS,
    schema: WEARABLE_FIELDS.map((name) => ({ name, selector: metric })),
    summary: (config) => wiredSummary(config, WEARABLE_FIELDS),
  },
  {
    key: "eyes",
    title: "Eyesight",
    hint: "The one genuinely left/right measurement on the card — every other paired body part is one sensor mirrored.",
    fields: EYE_FIELDS,
    entityFields: EYE_FIELDS,
    schema: EYE_FIELDS.map((name) => ({ name, selector: metric })),
    summary: (config) => wiredSummary(config, EYE_FIELDS),
  },
  {
    key: "about",
    title: "About you",
    hint: "Neither is required. Both only narrow the healthy bands the colours are judged against — they're never displayed.",
    fields: ["sex", "age"],
    entityFields: [],
    schema: [
      {
        type: "grid",
        name: "",
        schema: [
          {
            name: "sex",
            selector: {
              select: {
                mode: "dropdown",
                options: [
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                ],
              },
            },
          },
          { name: "age", selector: { number: { min: 1, max: 120, mode: "box" } } },
        ],
      },
    ],
    summary: (config) => {
      const parts: string[] = [];
      if (config.sex) parts.push(config.sex === "male" ? "male" : "female");
      if (typeof config.age === "number") parts.push(`age ${config.age}`);
      return parts.length > 0 ? parts.join(" · ") : "unisex, all-ages bands";
    },
  },
];

const TITLE_SCHEMA = [{ name: "title", selector: { text: {} } }];

@customElement("body-stats-card-editor")
export class BodyStatsCardEditor extends LitElement {
  static styles = editorStyles;

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: BodyStatsCardConfig;
  /** Sections are independent rather than an accordion — wiring a scale
   * usually means checking it against the wearable in the same pass. */
  @state() private _open: Record<string, boolean> = { scale: true };

  setConfig(config: BodyStatsCardConfig): void {
    this._config = config;
  }

  private _computeLabel = (schema: { name: string; title?: string }): string =>
    LABELS[schema.name] ?? schema.title ?? schema.name;

  private _computeHelper = (schema: { name: string }): string | undefined => HELPERS[schema.name];

  private _dataFor(fields: EditableKey[]): FormData {
    const config = this._config;
    const data: FormData = {};
    if (!config) return data;
    for (const key of fields) data[key] = config[key];
    return data;
  }

  /**
   * Only the keys the emitting form owns are reconciled, so one section can't
   * clobber another's. Cleared fields are deleted rather than written back as
   * `""` — emptying a picker should remove it from the YAML, not leave an
   * empty string behind for the card to skip over.
   */
  private _valueChanged(fields: EditableKey[], ev: CustomEvent<{ value: FormData }>): void {
    if (!this._config) return;
    ev.stopPropagation();
    const value = ev.detail.value ?? {};
    const next: Record<string, unknown> = { ...this._config };
    for (const key of fields) {
      const raw = value[key];
      const empty =
        raw === undefined ||
        raw === null ||
        raw === "" ||
        (typeof raw === "number" && !Number.isFinite(raw));
      if (empty) delete next[key];
      else next[key] = raw;
    }
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: next as unknown as BodyStatsCardConfig },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _toggle(key: string): void {
    this._open = { ...this._open, [key]: !this._open[key] };
  }

  /** What each wired entity is reporting right now — the only way to tell
   * two identically named scale sensors apart. */
  private _renderReadout(fields: EditableKey[]): TemplateResult | typeof nothing {
    const config = this._config;
    const hass = this.hass;
    if (!config || !hass) return nothing;
    const rows = fields
      .map((field) => ({ field, id: config[field] }))
      .filter((row): row is { field: EditableKey; id: string } => typeof row.id === "string" && row.id !== "");
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
          const unit = entity?.attributes.unit_of_measurement;
          const text = missing
            ? "not found"
            : unit
              ? `${entity.state} ${unit}`
              : entity.state;
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
        .data=${this._dataFor(["title"])}
        .schema=${TITLE_SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${(ev: CustomEvent<{ value: FormData }>) => this._valueChanged(["title"], ev)}
      ></ha-form>
      <div class="sections">${SECTIONS.map((section) => this._renderSection(section))}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "body-stats-card-editor": BodyStatsCardEditor;
  }
}
