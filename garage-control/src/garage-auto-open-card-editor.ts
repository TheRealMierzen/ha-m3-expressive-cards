import { LitElement, TemplateResult, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { editorStyles } from "./editor.css";
import { GarageAutoOpenCardConfig, HomeAssistant } from "./types";

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
  summary: (config: GarageAutoOpenCardConfig) => string;
}

/** Values the card already assumes when a key is absent, so the form can show
 * them without persisting them. */
const DEFAULTS: Record<string, unknown> = {
  hold_ms: 600,
};

/** The state an entity is in when its owner is home, unless config says
 * otherwise — see `homeStateMatches` in compute.ts. */
const DEFAULT_HOME_STATE = "home";

const HOME_STATE_SUGGESTIONS = ["home", "on", "true", "open", "present"];

/**
 * "Home" is one idea with two config spellings — `home_state` for a single
 * value and `home_states` for several — so the form offers one multi-value
 * field per scope and picks the tidier spelling on the way out. Without this
 * the list form was reachable only by hand-editing YAML, and the two fields
 * sitting side by side in a form would read as two separate settings.
 */
function readHomeStates(single: string, list: string): (config: Record<string, unknown>) => unknown {
  return (config) => {
    const many = config[list];
    if (Array.isArray(many) && many.length > 0) return many;
    const one = config[single];
    return typeof one === "string" && one !== "" ? [one] : [];
  };
}

function writeHomeStates(
  single: string,
  list: string,
  /** The global field's own default is a real default; a per-side override
   * saying the same thing as the default is a deliberate pin, so only the
   * global one collapses back to nothing. */
  dropDefault: boolean
): (raw: unknown, next: Record<string, unknown>) => void {
  return (raw, next) => {
    const values = Array.isArray(raw)
      ? raw.map((v) => String(v).trim()).filter((v) => v !== "")
      : [];
    delete next[single];
    delete next[list];
    if (values.length === 0) return;
    if (dropDefault && values.length === 1 && values[0] === DEFAULT_HOME_STATE) return;
    if (values.length === 1) next[single] = values[0];
    else next[list] = values;
  };
}

const FORM_READ: Record<string, (config: Record<string, unknown>) => unknown> = {
  home_states: readHomeStates("home_state", "home_states"),
  left_home_states: readHomeStates("left_home_state", "left_home_states"),
  right_home_states: readHomeStates("right_home_state", "right_home_states"),
};

const FORM_WRITE: Record<string, (raw: unknown, next: Record<string, unknown>) => void> = {
  home_states: writeHomeStates("home_state", "home_states", true),
  left_home_states: writeHomeStates("left_home_state", "left_home_states", false),
  right_home_states: writeHomeStates("right_home_state", "right_home_states", false),
};

const homeStateSelector = {
  select: {
    multiple: true,
    custom_value: true,
    options: HOME_STATE_SUGGESTIONS.map((value) => ({ value, label: value })),
  },
};

const TOP_FIELDS = ["title"] as const;
const TOP_SCHEMA = [{ name: "title", selector: { text: {} } }];

const LABELS: Record<string, string> = {
  title: "Title",
  automation: "Auto-open automation",
  hold_ms: "Hold before the door moves",
  home_states: "States that count as home",
  left_entity: "Presence entity",
  left_label: "Label",
  left_cover: "Door",
  left_home_states: "States that count as home",
  right_entity: "Presence entity",
  right_label: "Label",
  right_cover: "Door",
  right_home_states: "States that count as home",
};

const PRESENCE_HELPER =
  "Whoever this side belongs to. Any domain will do — a device_tracker, a person, or an input_boolean you flip yourself.";
const COVER_HELPER =
  "The cover.* this side opens. Leave blank to show presence only, with no door controls at all.";
const LABEL_HELPER = "Shown on the presence pill. Defaults to the side's name.";
const SIDE_HOME_HELPER =
  "Overrides the shared list for this side only — worth it when the two sides speak different vocabularies, like a device_tracker's “home” against an input_boolean's “on”. Leave empty to use the shared list.";

const HELPERS: Record<string, string> = {
  automation: "The automation the card's main switch enables and disables.",
  hold_ms:
    "Open and Close have to be held this long before the door moves, so a stray tap can't. Set 0 to act on a plain tap instead. Stop always fires immediately, held or not.",
  home_states:
    "Any one of these means home. Leave empty for the default, “home”. Both sides use this list unless they override it below.",
  left_entity: PRESENCE_HELPER,
  right_entity: PRESENCE_HELPER,
  left_cover: COVER_HELPER,
  right_cover: COVER_HELPER,
  left_label: LABEL_HELPER,
  right_label: LABEL_HELPER,
  left_home_states: SIDE_HOME_HELPER,
  right_home_states: SIDE_HOME_HELPER,
};

const LEFT_FIELDS = ["left_entity", "left_label", "left_cover", "left_home_states"] as const;
const RIGHT_FIELDS = ["right_entity", "right_label", "right_cover", "right_home_states"] as const;
const SHARED_FIELDS = ["automation", "hold_ms", "home_states"] as const;

function sideSummary(entity?: string, cover?: string, label?: string): string {
  if (!entity && !cover) return "nothing wired yet";
  const parts = [label ?? "unnamed"];
  parts.push(entity ? "presence" : "no presence");
  parts.push(cover ? "door controls" : "presence only");
  return parts.join(" · ");
}

/**
 * One section per garage door, because that's the unit somebody actually
 * configures — four fields that belong together, twice, rather than eight
 * `left_*`/`right_*` fields interleaved down one list. Each side reads its
 * entities back live, so "is this the correct tracker" is answerable here.
 * The form now covers the whole config, list-valued home states included.
 */
const SECTIONS: Section[] = [
  {
    key: "left",
    title: "Left side",
    fields: LEFT_FIELDS,
    entityFields: ["left_entity", "left_cover"],
    schema: [
      { name: "left_entity", selector: { entity: {} } },
      { name: "left_label", selector: { text: {} } },
      { name: "left_cover", selector: { entity: { filter: { domain: "cover" } } } },
      { name: "left_home_states", selector: homeStateSelector },
    ],
    summary: (config) =>
      sideSummary(config.left_entity, config.left_cover, config.left_label),
  },
  {
    key: "right",
    title: "Right side",
    fields: RIGHT_FIELDS,
    entityFields: ["right_entity", "right_cover"],
    schema: [
      { name: "right_entity", selector: { entity: {} } },
      { name: "right_label", selector: { text: {} } },
      { name: "right_cover", selector: { entity: { filter: { domain: "cover" } } } },
      { name: "right_home_states", selector: homeStateSelector },
    ],
    summary: (config) =>
      sideSummary(config.right_entity, config.right_cover, config.right_label),
  },
  {
    key: "shared",
    title: "Automation & behaviour",
    hint: "Settings both sides share.",
    fields: SHARED_FIELDS,
    entityFields: ["automation"],
    schema: [
      { name: "automation", selector: { entity: { filter: { domain: "automation" } } } },
      {
        name: "hold_ms",
        selector: {
          number: { min: 0, max: 3000, step: 100, mode: "box", unit_of_measurement: "ms" },
        },
      },
      { name: "home_states", selector: homeStateSelector },
    ],
    summary: (config) => {
      const hold = config.hold_ms ?? 600;
      const holdText = hold === 0 ? "acts on tap" : `hold ${hold}ms`;
      const states = config.home_states ?? (config.home_state ? [config.home_state] : ["home"]);
      return `${holdText} · home = ${states.join(", ")}`;
    },
  },
];

/* ------------------------------------------------------------------- shell */

@customElement("m3-garage-auto-open-card-editor")
export class GarageAutoOpenCardEditor extends LitElement {
  static styles = editorStyles;

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: GarageAutoOpenCardConfig;
  /** Sections are independent rather than an accordion — wiring one usually
   * means checking it against another in the same pass. */
  @state() private _open: Record<string, boolean> = { left: true };

  setConfig(config: GarageAutoOpenCardConfig): void {
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
        detail: { config: next as unknown as GarageAutoOpenCardConfig },
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
    "m3-garage-auto-open-card-editor": GarageAutoOpenCardEditor;
  }
}
