import { LitElement, TemplateResult, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { editorStyles } from "./editor.css";
import { paletteColor } from "./palette";
import {
  EntityConfigOverride,
  HomeAssistant,
  ScheduleTimelineCardConfig,
} from "./types";

type FormData = Record<string, unknown>;

/** How a lane is treated, as one choice rather than two entity multi-selects
 * sitting at opposite ends of the form. */
type Visibility = "shown" | "hidden" | "excluded";

/** A lane's own fields, flattened for its sub-form. */
interface LaneFields {
  visibility: Visibility;
  label?: string;
  icon?: string;
  color?: string;
}

const TOP_SCHEMA = [
  { name: "title", selector: { text: {} } },
  {
    name: "short_block_minutes",
    selector: { number: { mode: "box", min: 1, step: 1, unit_of_measurement: "min" } },
  },
];

const TOP_FIELDS = ["title", "short_block_minutes"] as const;

const LABELS: Record<string, string> = {
  title: "Title",
  short_block_minutes: "Short blocks are dots below",
  visibility: "This lane",
  label: "Label",
  icon: "Icon",
  color: "Colour",
};

const HELPERS: Record<string, string> = {
  short_block_minutes:
    "A block shorter than this is drawn as a compact dot instead of a bar, which keeps a five-minute trigger from disappearing entirely.",
  visibility:
    "Hidden still counts as a lane — it just starts folded away behind the filter chips, and one tap brings it back. Excluded is treated as though the helper didn't exist at all.",
  label: "Overrides the helper's friendly name on this card only.",
  icon: "Overrides the helper's own icon. Leave empty to use whatever the helper carries.",
  color: "Overrides the palette colour assigned by position. A hex value, or any CSS colour.",
};

const VISIBILITY_SCHEMA = {
  name: "visibility",
  selector: {
    select: {
      mode: "dropdown",
      options: [
        { value: "shown", label: "Shown" },
        { value: "hidden", label: "Hidden until toggled on" },
        { value: "excluded", label: "Excluded entirely" },
      ],
    },
  },
};

const LANE_SCHEMA = [
  VISIBILITY_SCHEMA,
  { name: "label", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  { name: "color", selector: { text: {} } },
];

function laneSummary(fields: LaneFields, overridden: boolean): string {
  const parts: string[] = [];
  if (fields.visibility === "hidden") parts.push("hidden until toggled on");
  else if (fields.visibility === "excluded") parts.push("excluded");
  if (overridden) {
    const custom: string[] = [];
    if (fields.label) custom.push("label");
    if (fields.icon) custom.push("icon");
    if (fields.color) custom.push("colour");
    if (custom.length > 0) parts.push(`custom ${custom.join(", ")}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "shown, nothing overridden";
}

/** Strips the keys that carry no information, so a lane that only pins its
 * order stays a bare `- entity: schedule.x` in the YAML. */
function pruneOverride(override: EntityConfigOverride): EntityConfigOverride {
  const out: EntityConfigOverride = { entity: override.entity };
  if (override.label) out.label = override.label;
  if (override.icon) out.icon = override.icon;
  if (override.color) out.color = override.color;
  return out;
}

/**
 * A lane per row, in the order the card draws them.
 *
 * Everything about one schedule helper — whether it shows, what it's called,
 * its icon, its colour, where it sits — used to live in three places: two
 * entity multi-selects at opposite ends of the form and an `entities` list
 * that had no form at all and could only be hand-written in YAML. Grouping by
 * lane is how somebody actually thinks about this card, and it's what makes
 * ordering and the colour overrides reachable without the code editor.
 */
@customElement("m3-schedule-timeline-card-editor")
export class ScheduleTimelineCardEditor extends LitElement {
  static styles = editorStyles;

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: ScheduleTimelineCardConfig;
  @state() private _openLane: string | null = null;

  setConfig(config: ScheduleTimelineCardConfig): void {
    this._config = config;
  }

  private _computeLabel = (schema: { name: string; title?: string }): string =>
    LABELS[schema.name] ?? schema.title ?? schema.name;

  private _computeHelper = (schema: { name: string }): string | undefined => HELPERS[schema.name];

  private _emit(next: ScheduleTimelineCardConfig): void {
    this._config = next;
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config: next }, bubbles: true, composed: true })
    );
  }

  /* ------------------------------------------------------------------ lanes */

  /**
   * Every `schedule.*` helper, in the order the card lays them out: the ones
   * pinned by `entities` first, then the rest by friendly name. Excluded
   * lanes are dropped by the card but kept here — an excluded lane you can't
   * see is an excluded lane you can't un-exclude.
   */
  private get _laneIds(): string[] {
    const hass = this.hass;
    const config = this._config;
    if (!hass || !config) return [];
    const all = Object.keys(hass.states).filter((id) => id.startsWith("schedule."));
    const name = (id: string): string => hass.states[id]?.attributes.friendly_name ?? id;
    const pinned = (config.entities ?? [])
      .map((entry) => entry.entity)
      .filter((id) => all.includes(id));
    const rest = all
      .filter((id) => !pinned.includes(id))
      .sort((a, b) => name(a).localeCompare(name(b)));
    return [...pinned, ...rest];
  }

  /**
   * The order auto-discovery would produce on its own: every schedule helper
   * by friendly name. An `entities` list in exactly this order is saying
   * nothing about ordering, which is what makes it safe to drop once its last
   * override goes.
   */
  private get _naturalOrder(): string[] {
    const hass = this.hass;
    if (!hass) return [];
    const name = (id: string): string => hass.states[id]?.attributes.friendly_name ?? id;
    return Object.keys(hass.states)
      .filter((id) => id.startsWith("schedule."))
      .sort((a, b) => name(a).localeCompare(name(b)));
  }

  /** The palette colour a lane would get if it didn't override one — matches
   * `resolveEntities`, which numbers from the visible lanes only. */
  private _resolvedColor(entityId: string, override?: EntityConfigOverride): string {
    if (override?.color) return override.color;
    const excluded = new Set(this._config?.exclude_entities ?? []);
    const visible = this._laneIds.filter((id) => !excluded.has(id));
    const index = visible.indexOf(entityId);
    return paletteColor(index < 0 ? 0 : index, this.hass?.themes?.darkMode !== false);
  }

  private _fieldsFor(entityId: string): LaneFields {
    const config = this._config;
    const override = (config?.entities ?? []).find((entry) => entry.entity === entityId);
    const excluded = (config?.exclude_entities ?? []).includes(entityId);
    const hidden = (config?.default_hidden ?? []).includes(entityId);
    return {
      visibility: excluded ? "excluded" : hidden ? "hidden" : "shown",
      label: override?.label,
      icon: override?.icon,
      color: override?.color,
    };
  }

  private _laneChanged(entityId: string, ev: CustomEvent<{ value: FormData }>): void {
    const config = this._config;
    if (!config) return;
    ev.stopPropagation();
    const value = (ev.detail.value ?? {}) as unknown as LaneFields;
    const next: ScheduleTimelineCardConfig = { ...config };

    const withoutId = (list: string[] | undefined): string[] =>
      (list ?? []).filter((id) => id !== entityId);

    const excluded = withoutId(next.exclude_entities);
    const hidden = withoutId(next.default_hidden);
    if (value.visibility === "excluded") excluded.push(entityId);
    if (value.visibility === "hidden") hidden.push(entityId);
    if (excluded.length > 0) next.exclude_entities = excluded;
    else delete next.exclude_entities;
    if (hidden.length > 0) next.default_hidden = hidden;
    else delete next.default_hidden;

    // An `entities` entry that says nothing is only worth keeping while the
    // list is pinning an order — otherwise it just pins the order by accident.
    const existing = next.entities ?? [];
    const patched: EntityConfigOverride = pruneOverride({
      entity: entityId,
      label: value.label,
      icon: value.icon,
      color: value.color,
    });
    const hasOverride = Object.keys(patched).length > 1;
    const isPinned = existing.some((entry) => entry.entity === entityId);
    let entities: EntityConfigOverride[];
    if (isPinned) {
      entities = existing.map((entry) => (entry.entity === entityId ? patched : entry));
      // An entry with nothing left in it isn't harmless: `entities` is
      // positional, so a leftover would go on pinning its lane to the top
      // after the override that created it is gone. Clean it up — but only in
      // a list that isn't itself an ordering. A complete list is what the
      // arrows write, so that one is left alone unless it happens to be in
      // discovery's own order, in which case it says nothing either.
      const natural = this._naturalOrder;
      const complete = entities.length === natural.length;
      const sameAsNatural =
        complete && entities.every((entry, i) => entry.entity === natural[i]);
      const allBare = entities.every((entry) => Object.keys(entry).length === 1);
      if (!complete && Object.keys(patched).length === 1) {
        entities = entities.filter((entry) => entry.entity !== entityId);
      } else if (sameAsNatural && allBare) {
        entities = [];
      }
    } else if (hasOverride) {
      entities = [...existing, patched];
    } else {
      entities = existing;
    }
    if (entities.length > 0) next.entities = entities;
    else delete next.entities;

    this._emit(next);
  }

  /**
   * Moving a lane pins the order of *all* of them. That's what an order is:
   * `entities` is positional, so a half-filled list would leave the unlisted
   * lanes drifting around alphabetically underneath the ones you placed.
   */
  private _moveLane(entityId: string, delta: -1 | 1): void {
    const config = this._config;
    if (!config) return;
    const ids = this._laneIds;
    const from = ids.indexOf(entityId);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    const reordered = [...ids];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    const byId = new Map((config.entities ?? []).map((entry) => [entry.entity, entry]));
    this._emit({
      ...config,
      entities: reordered.map((id) => byId.get(id) ?? { entity: id }),
    });
  }

  private _iconButton(
    icon: string,
    label: string,
    handler: () => void,
    disabled = false
  ): TemplateResult {
    return html`
      <button
        class="icon-btn"
        type="button"
        title=${label}
        aria-label=${label}
        ?disabled=${disabled}
        @click=${(e: Event) => {
          e.stopPropagation();
          handler();
        }}
      >
        <ha-icon icon=${icon}></ha-icon>
      </button>
    `;
  }

  private _renderLane(entityId: string, index: number, total: number): TemplateResult {
    const open = this._openLane === entityId;
    const fields = this._fieldsFor(entityId);
    const override = (this._config?.entities ?? []).find((entry) => entry.entity === entityId);
    const state = this.hass?.states[entityId];
    const name = fields.label ?? state?.attributes.friendly_name ?? entityId;
    return html`
      <div class=${open ? "row open" : "row"}>
        <div class="row-head" @click=${() => (this._openLane = open ? null : entityId)}>
          <span class="swatch" style=${`background:${this._resolvedColor(entityId, override)}`}></span>
          <span class="row-text">
            <div class="row-title">${name}</div>
            <div class="row-sub">${laneSummary(fields, override !== undefined)}</div>
          </span>
          <span class="row-actions">
            ${this._iconButton("mdi:arrow-up", "Move up", () => this._moveLane(entityId, -1), index === 0)}
            ${this._iconButton(
              "mdi:arrow-down",
              "Move down",
              () => this._moveLane(entityId, 1),
              index === total - 1
            )}
          </span>
          <span class="chev">
            <ha-icon icon=${open ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>
          </span>
        </div>
        ${open
          ? html`
              <div class="row-body">
                <div class="ro">
                  <span class="ro-label">Entity</span>
                  <span class="chip" title=${entityId}>${entityId}</span>
                </div>
                <ha-form
                  .hass=${this.hass}
                  .data=${fields}
                  .schema=${LANE_SCHEMA}
                  .computeLabel=${this._computeLabel}
                  .computeHelper=${this._computeHelper}
                  @value-changed=${(ev: CustomEvent<{ value: FormData }>) =>
                    this._laneChanged(entityId, ev)}
                ></ha-form>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  /* ----------------------------------------------------------------- global */

  private get _topData(): FormData {
    return {
      title: this._config?.title,
      short_block_minutes: this._config?.short_block_minutes,
    };
  }

  private _topChanged(ev: CustomEvent<{ value: FormData }>): void {
    const config = this._config;
    if (!config) return;
    ev.stopPropagation();
    const value = ev.detail.value ?? {};
    const next: Record<string, unknown> = { ...config };
    for (const key of TOP_FIELDS) {
      const raw = value[key];
      const empty =
        raw === undefined ||
        raw === null ||
        raw === "" ||
        (typeof raw === "number" && !Number.isFinite(raw));
      if (empty) delete next[key];
      else next[key] = raw;
    }
    this._emit(next as unknown as ScheduleTimelineCardConfig);
  }

  protected render() {
    if (!this._config || !this.hass) {
      return nothing;
    }
    const ids = this._laneIds;
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._topData}
        .schema=${TOP_SCHEMA}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._topChanged}
      ></ha-form>

      <div class="section-head">Lanes</div>
      <div class="hint">
        Every schedule helper is picked up on its own — there's no list to add them to. Reordering
        one pins the order of all of them.
      </div>
      ${ids.length === 0
        ? html`<div class="empty">No schedule helpers found. Create one under Settings →
            Devices &amp; services → Helpers, and it'll appear here.</div>`
        : html`<div class="sections">
            ${ids.map((id, index) => this._renderLane(id, index, ids.length))}
          </div>`}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3-schedule-timeline-card-editor": ScheduleTimelineCardEditor;
  }
}
