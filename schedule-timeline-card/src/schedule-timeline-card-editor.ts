import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant, ScheduleTimelineCardConfig } from "./types";

type EditableConfig = Pick<
  ScheduleTimelineCardConfig,
  "title" | "short_block_minutes" | "exclude_entities" | "default_hidden"
>;

const SCHEMA = [
  { name: "title", selector: { text: {} } },
  { name: "short_block_minutes", selector: { number: { mode: "box", min: 1, step: 1 } } },
  { name: "exclude_entities", selector: { entity: { multiple: true, filter: { domain: "schedule" } } } },
  { name: "default_hidden", selector: { entity: { multiple: true, filter: { domain: "schedule" } } } },
] as const;

const LABELS: Record<string, string> = {
  title: "Title",
  short_block_minutes: "Short block threshold (minutes)",
  exclude_entities: "Entities to exclude",
  default_hidden: "Lanes hidden by default",
};

const HELPERS: Record<string, string> = {
  short_block_minutes:
    "Blocks shorter than this render as a compact dot instead of a bar.",
  exclude_entities:
    "Never shown, and not offered as a lane to toggle on — as if the helper didn't exist.",
  default_hidden:
    "Still shown as a lane, just hidden until you toggle it back on with the filter chips.",
};

/**
 * Covers the flat top-level fields via HA's generic `ha-form`. The
 * `entities` list (per-entity color/icon/label overrides) has no row here —
 * editing that still requires the card's built-in YAML/code-editor view.
 */
@customElement("schedule-timeline-card-editor")
export class ScheduleTimelineCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: ScheduleTimelineCardConfig;

  setConfig(config: ScheduleTimelineCardConfig): void {
    this._config = config;
  }

  private get _data(): EditableConfig {
    return {
      title: this._config?.title,
      short_block_minutes: this._config?.short_block_minutes,
      exclude_entities: this._config?.exclude_entities ?? [],
      default_hidden: this._config?.default_hidden ?? [],
    };
  }

  private _computeLabel = (schema: { name: string }): string => LABELS[schema.name] ?? schema.name;

  private _computeHelper = (schema: { name: string }): string | undefined => HELPERS[schema.name];

  private _valueChanged(ev: CustomEvent<{ value: EditableConfig }>): void {
    if (!this._config) return;
    const newConfig: ScheduleTimelineCardConfig = {
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
    "schedule-timeline-card-editor": ScheduleTimelineCardEditor;
  }
}
