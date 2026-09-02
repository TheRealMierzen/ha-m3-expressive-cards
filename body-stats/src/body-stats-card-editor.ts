import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BodyStatsCardConfig, HomeAssistant } from "./types";

type EditableConfig = Omit<BodyStatsCardConfig, "type">;

const SCHEMA = [
  { name: "title", selector: { text: {} } },
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
  {
    type: "grid",
    name: "",
    schema: [
      { name: "sleep_efficiency_entity", selector: { entity: { domain: "sensor" } } },
      { name: "eyesight_left_entity", selector: { entity: { domain: "sensor" } } },
      { name: "eyesight_right_entity", selector: { entity: { domain: "sensor" } } },
      { name: "resting_hr_entity", selector: { entity: { domain: "sensor" } } },
      { name: "body_fat_entity", selector: { entity: { domain: "sensor" } } },
      { name: "visceral_fat_entity", selector: { entity: { domain: "sensor" } } },
      { name: "muscle_mass_entity", selector: { entity: { domain: "sensor" } } },
      { name: "bone_mass_entity", selector: { entity: { domain: "sensor" } } },
      { name: "weight_entity", selector: { entity: { domain: "sensor" } } },
      { name: "bmi_entity", selector: { entity: { domain: "sensor" } } },
      { name: "water_entity", selector: { entity: { domain: "sensor" } } },
      { name: "protein_entity", selector: { entity: { domain: "sensor" } } },
    ],
  },
] as const;

const LABELS: Record<string, string> = {
  title: "Title",
  sex: "Sex",
  age: "Age",
  sleep_efficiency_entity: "Sleep efficiency % (head/brain)",
  eyesight_left_entity: "Left eye acuity (eyes)",
  eyesight_right_entity: "Right eye acuity (eyes)",
  resting_hr_entity: "Resting heart rate (chest pin)",
  body_fat_entity: "Body fat % (torso)",
  visceral_fat_entity: "Visceral fat (belly badge, sub reason for torso)",
  muscle_mass_entity: "Muscle mass (both arms)",
  bone_mass_entity: "Bone mass (both legs)",
  weight_entity: "Weight (header chip)",
  bmi_entity: "BMI (header chip, sole color driver — see helper text)",
  water_entity: "Body water % (left elbow badge)",
  protein_entity: "Protein % (right elbow badge, sub reason for arms)",
};

const EYE_HELPER =
  "Modeled on a standard Snellen eye test — the entity should hold just the denominator (20 for 20/20 vision, 40 for 20/40), lower is better. Adjust compute.ts if your sensor reports a different scale. Drawn as the eyes, colored on its own — doesn't affect the head region's color.";

const HELPERS: Record<string, string> = {
  sex: "Sharpens the researched thresholds for body fat, muscle mass, bone mass, and body water — those bands genuinely differ by sex. Leave unset to use a blended unisex band for all four.",
  age: "Only sharpens the muscle mass band, from an all-ages envelope down to the exact age-bracketed range. Leave unset to use the envelope.",
  eyesight_left_entity: EYE_HELPER,
  eyesight_right_entity: EYE_HELPER,
  visceral_fat_entity: "Combines with body fat to color the torso — whichever reads worse wins.",
  water_entity: "Mirrors protein's spot on the opposite elbow for visual symmetry only — doesn't affect the arms' color.",
  protein_entity: "Combines with muscle mass to color the arms — whichever reads worse wins.",
  bmi_entity: "Colors the header chip on its own — weight has no health verdict of its own (a fixed target weight isn't meaningful without height), so it mirrors BMI's rather than being judged independently.",
};

/** Covers all fields via HA's generic `ha-form`. Most fields are entity
 * pickers or a title string; sex/age are the two exceptions — they
 * sharpen the researched good/ok/bad bands in compute.ts (which are
 * otherwise fixed, not configurable per-field) rather than pointing at
 * an entity themselves. */
@customElement("body-stats-card-editor")
export class BodyStatsCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: BodyStatsCardConfig;

  setConfig(config: BodyStatsCardConfig): void {
    this._config = config;
  }

  private get _data(): EditableConfig {
    const c = this._config;
    return {
      title: c?.title,
      sex: c?.sex,
      age: c?.age,
      sleep_efficiency_entity: c?.sleep_efficiency_entity,
      eyesight_left_entity: c?.eyesight_left_entity,
      eyesight_right_entity: c?.eyesight_right_entity,
      resting_hr_entity: c?.resting_hr_entity,
      body_fat_entity: c?.body_fat_entity,
      visceral_fat_entity: c?.visceral_fat_entity,
      muscle_mass_entity: c?.muscle_mass_entity,
      bone_mass_entity: c?.bone_mass_entity,
      weight_entity: c?.weight_entity,
      bmi_entity: c?.bmi_entity,
      water_entity: c?.water_entity,
      protein_entity: c?.protein_entity,
    };
  }

  private _computeLabel = (schema: { name: string }): string => LABELS[schema.name] ?? schema.name;

  private _computeHelper = (schema: { name: string }): string | undefined => HELPERS[schema.name];

  private _valueChanged(ev: CustomEvent<{ value: EditableConfig }>): void {
    if (!this._config) return;
    const newConfig: BodyStatsCardConfig = {
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
    "body-stats-card-editor": BodyStatsCardEditor;
  }
}
