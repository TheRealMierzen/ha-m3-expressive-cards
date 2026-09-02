import { LitElement, html, nothing, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { COLOR_NAMES } from "./colors";
import { itemKind, resolveItems } from "./compute";
import { whenTests } from "./conditions";
import { editorStyles } from "./editor.css";
import { renderMedallion } from "./medallion";
import { stateOptions } from "./state-options";
import { medallionStyles } from "./medallion.css";
import {
  AnimationTarget,
  AnimationType,
  BadgeConfig,
  HomeAssistant,
  QuickTogglesCardConfig,
  ToggleCondition,
  ToggleItemConfig,
  ToggleStateConfig,
  WhenClause,
  WhenTest,
} from "./types";

const ANIMATIONS: AnimationType[] = [
  "none",
  "sweep",
  "spin",
  "pulse",
  "breathe",
  "bounce",
  "shake",
  "sheen",
  "flash",
];

const TARGETS: AnimationTarget[] = ["glyph", "ring", "plate", "badge"];

type Operator = "active" | "is" | "is_not" | "above" | "below";
type TestKind = "self_on" | "self_off" | "entity";

/** One condition test, as edited in the form. An empty list means "always". */
interface TestFields {
  kind: TestKind;
  entity?: string;
  attribute?: string;
  operator?: Operator;
  /** A number once the comparison is above/below — ha-form's number selector
   * hands back a real number, not a string. */
  value?: string | number;
}

/** A state entry's appearance fields. Its conditions live in their own list
 * of sub-forms, not in here — a state entry can have any number of them. */
interface FlatState {
  icon?: string;
  color?: string;
  animation?: AnimationType;
  animation_target?: AnimationTarget;
  badge_mode: "none" | "dot" | "value";
  badge_color?: string;
  badge_animation?: AnimationType;
  badge_entity?: string;
  badge_attribute?: string;
  badge_round?: number;
  badge_max?: number;
}

function option(value: string, label?: string): { value: string; label: string } {
  return { value, label: label ?? value };
}

function selectSchema(
  name: string,
  values: string[],
  customValue = false,
  labels: Record<string, string> = {}
) {
  return {
    name,
    selector: {
      select: {
        mode: "dropdown",
        custom_value: customValue,
        options: values.map((v) => option(v, labels[v])),
      },
    },
  };
}

const KIND_VALUES = ["self_on", "self_off", "entity"];
const KIND_LABELS: Record<string, string> = {
  self_on: "This toggle is on",
  self_off: "This toggle is off",
  entity: "An entity…",
};
const OPERATOR_VALUES = ["active", "is", "is_not", "above", "below"];
const OPERATOR_LABELS: Record<string, string> = {
  active: "is active",
  is: "is",
  is_not: "is not",
  above: "is above",
  below: "is below",
};
const BADGE_MODES = ["none", "dot", "value"];
const BADGE_MODE_LABELS: Record<string, string> = {
  none: "No badge",
  dot: "Dot",
  value: "Value from an entity",
};

/** Strips keys HA shouldn't persist, so a cleared field disappears from the
 * YAML instead of being written as an empty string. */
function prune<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out as T;
}

/* --------------------------------------------------------- conditions <-> form */

function testToFields(test: WhenTest): TestFields {
  if (test === "on") return { kind: "self_on" };
  if (test === "off") return { kind: "self_off" };
  const fields: TestFields = { kind: "entity", entity: test.entity, attribute: test.attribute };
  if (test.state !== undefined) {
    fields.operator = "is";
    fields.value = String(test.state);
  } else if (test.state_not !== undefined) {
    fields.operator = "is_not";
    fields.value = String(test.state_not);
  } else if (test.above !== undefined) {
    fields.operator = "above";
    fields.value = String(test.above);
  } else if (test.below !== undefined) {
    fields.operator = "below";
    fields.value = String(test.below);
  } else {
    fields.operator = "active";
  }
  return fields;
}

/** null when the test isn't complete enough to store yet — the draft keeps it
 * on screen until it is. */
function fieldsToTest(fields: TestFields): WhenTest | null {
  if (fields.kind === "self_on") return "on";
  if (fields.kind === "self_off") return "off";
  const cond: ToggleCondition = {};
  if (fields.entity) cond.entity = fields.entity;
  if (fields.attribute) cond.attribute = fields.attribute;
  const value = fields.value ?? "";
  switch (fields.operator) {
    case "is":
      if (value !== "") cond.state = value;
      break;
    case "is_not":
      if (value !== "") cond.state_not = value;
      break;
    case "above":
      if (value !== "" && Number.isFinite(Number(value))) cond.above = Number(value);
      break;
    case "below":
      if (value !== "" && Number.isFinite(Number(value))) cond.below = Number(value);
      break;
    default:
      break;
  }
  return Object.keys(cond).length > 0 ? cond : null;
}

function whenToFields(when: WhenClause | undefined): TestFields[] {
  return whenTests(when).map(testToFields);
}

/** Collapses back to the tidiest shape: nothing, a single test, or a list. */
function fieldsToWhen(list: TestFields[]): WhenClause | undefined {
  const tests = list.map(fieldsToTest).filter((t): t is WhenTest => t !== null);
  if (tests.length === 0) return undefined;
  if (tests.length === 1) return tests[0];
  return tests;
}

const OPERATOR_TEXT: Record<Operator, string> = {
  active: "is active",
  is: "is",
  is_not: "is not",
  above: ">",
  below: "<",
};

function testSummary(test: WhenTest): string {
  if (test === "on") return "toggle is on";
  if (test === "off") return "toggle is off";
  const subject = (test.entity ?? "self") + (test.attribute ? `.${test.attribute}` : "");
  if (test.state !== undefined) return `${subject} ${OPERATOR_TEXT.is} ${test.state}`;
  if (test.state_not !== undefined) return `${subject} ${OPERATOR_TEXT.is_not} ${test.state_not}`;
  if (test.above !== undefined) return `${subject} ${OPERATOR_TEXT.above} ${test.above}`;
  if (test.below !== undefined) return `${subject} ${OPERATOR_TEXT.below} ${test.below}`;
  return `${subject} ${OPERATOR_TEXT.active}`;
}

function whenSummary(when: WhenClause | undefined): string {
  const tests = whenTests(when);
  if (tests.length === 0) return "always";
  return tests.map(testSummary).join(" and ");
}

/* -------------------------------------------------------- appearance <-> form */

function badgeMode(badge: ToggleStateConfig["badge"]): "none" | "dot" | "value" {
  if (badge === undefined || badge === false) return "none";
  if (badge === true) return "dot";
  return badge.entity !== undefined || badge.attribute !== undefined ? "value" : "dot";
}

function flattenState(entry: ToggleStateConfig): FlatState {
  const badge = typeof entry.badge === "object" && entry.badge !== null ? entry.badge : undefined;
  return {
    icon: entry.icon,
    color: entry.color,
    animation: entry.animation,
    animation_target: entry.animation_target,
    badge_mode: badgeMode(entry.badge),
    badge_color: badge?.color,
    badge_animation: badge?.animation,
    badge_entity: badge?.entity,
    badge_attribute: badge?.attribute,
    badge_round: badge?.round,
    badge_max: badge?.max,
  };
}

function unflattenState(flat: FlatState, previous: ToggleStateConfig): ToggleStateConfig {
  const next: ToggleStateConfig = {
    icon: flat.icon,
    color: flat.color,
    animation: flat.animation,
    animation_target: flat.animation_target,
  };

  if (flat.badge_mode === "dot" || flat.badge_mode === "value") {
    const badge: BadgeConfig = {};
    if (flat.badge_color) badge.color = flat.badge_color;
    if (flat.badge_animation && flat.badge_animation !== "none") badge.animation = flat.badge_animation;
    if (flat.badge_mode === "value") {
      if (flat.badge_entity) badge.entity = flat.badge_entity;
      if (flat.badge_attribute) badge.attribute = flat.badge_attribute;
      if (typeof flat.badge_round === "number") badge.round = flat.badge_round;
      if (typeof flat.badge_max === "number") badge.max = flat.badge_max;
    }
    // A bare dot with no options of its own is just `true` — shorter YAML,
    // and it round-trips to the same thing.
    next.badge = Object.keys(badge).length > 0 ? badge : true;
  }

  // Conditions and numeric glow are edited elsewhere / in YAML; carry them.
  if (previous.when !== undefined) next.when = previous.when;
  if (previous.glow !== undefined) next.glow = previous.glow;

  return prune(next as Record<string, unknown>) as ToggleStateConfig;
}

function effectSummary(entry: ToggleStateConfig): string {
  const parts: string[] = [];
  if (entry.animation && entry.animation !== "none") {
    parts.push(entry.animation_target ? `${entry.animation} ${entry.animation_target}` : entry.animation);
  } else if (entry.animation === "none") {
    parts.push("no animation");
  }
  if (entry.color) parts.push(entry.color);
  if (entry.icon) parts.push(entry.icon);
  const mode = badgeMode(entry.badge);
  if (mode === "value") parts.push("value badge");
  else if (mode === "dot") parts.push("badge");
  if (entry.glow !== undefined) parts.push("glow");
  return parts.length > 0 ? parts.join(" · ") : "no change";
}

const GLOBAL_SCHEMA = [
  { name: "title", selector: { text: {} } },
  selectSchema("size", ["sm", "md", "lg"]),
  selectSchema("align", ["even", "start", "center", "space-between", "space-evenly"], false, {
    even: "Even columns (default)",
    start: "Left",
    center: "Centred",
    "space-between": "Spread to edges",
    "space-evenly": "Even gaps",
  }),
  { name: "columns", selector: { number: { mode: "box", min: 1, max: 12, step: 1 } } },
] as const;

const LABELS: Record<string, string> = {
  title: "Title",
  size: "Medallion size",
  align: "Row alignment",
  columns: "Fixed columns",
  entity: "Entity",
  name: "Name (tooltip / screen readers)",
  icon: "Icon",
  color: "Colour",
  tap_action: "Tap action",
  hold_action: "Hold action",
  momentary: "Momentary (flash, don't latch)",
  confirm: "Require a confirming second tap",
  kind: "Test",
  attribute: "Attribute (optional)",
  operator: "Comparison",
  value: "Value",
  animation: "Animation",
  animation_target: "Animation layer",
  badge_mode: "Badge",
  badge_color: "Badge colour",
  badge_animation: "Badge animation",
  badge_entity: "Badge entity",
  badge_attribute: "Badge attribute",
  badge_round: "Decimal places",
  badge_max: "Cap at",
};

const HELPERS: Record<string, string> = {
  columns: "Leave empty to fit as many even columns as the card is wide.",
  align:
    "Even columns divides each row into equal cells; even gaps spreads a partial last row across the full width instead.",
  name: "Never drawn on the card — it's the tooltip and the accessible name.",
  color: "A palette name (blue, cyan, amber, …), a hex value, or a var(--your-token).",
  momentary: "For scripts and scenes: presses flash once instead of staying on.",
  attribute: "Test an attribute of that entity instead of its state.",
  value: "Suggestions come from the selected entity — you can still type anything.",
  animation_target: "Which layer moves. Leave empty for the animation's natural layer.",
  badge_mode: "A dot is the quietest way to show a second condition; a value shows a number on the rim.",
  badge_entity: "Leave empty to read the toggle's own entity.",
  badge_max: "Values above this show as “N+”, so the badge stays two or three characters.",
};

@customElement("quick-toggles-card-editor")
export class QuickTogglesCardEditor extends LitElement {
  static styles = [medallionStyles, editorStyles];

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: QuickTogglesCardConfig;
  @state() private _openToggle: number | null = null;
  @state() private _openState: string | null = null;
  /**
   * In-progress edits, keyed by the form's own path.
   *
   * A half-finished condition isn't representable in the config — picking
   * "an entity…" before naming one produces nothing to store, so re-deriving
   * the form from config alone snapped the selection back and the entity
   * field vanished before it could be filled in. Same for a value badge with
   * no entity yet. Drafts hold those choices until they can be persisted.
   * Keys are positional, so any reorder or delete clears them.
   */
  @state() private _drafts: Record<string, Record<string, unknown>> = {};
  /**
   * In-progress condition *lists*, keyed by the list's path.
   *
   * Per-field drafts aren't enough here: a freshly added test has no entity
   * yet, so it can't be stored, so a list re-derived from config came back
   * one row shorter and the new row disappeared the instant it was added.
   * The draft owns the list while it's being edited; config gets the tests
   * that are complete enough to persist.
   */
  @state() private _listDrafts: Record<string, TestFields[]> = {};

  setConfig(config: QuickTogglesCardConfig): void {
    this._config = config;
  }

  protected willUpdate(): void {
    // The previews use the same medallion CSS as the card, including its
    // light-theme overrides, so the editor host needs the same attribute.
    if (this.hass) {
      this.setAttribute("data-theme", this.hass.themes?.darkMode ? "dark" : "light");
    }
  }

  private get _toggles(): ToggleItemConfig[] {
    return this._config?.toggles ?? [];
  }

  private _emit(config: QuickTogglesCardConfig): void {
    this._config = config;
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true })
    );
  }

  private _emitToggles(toggles: ToggleItemConfig[]): void {
    if (!this._config) return;
    this._emit({ ...this._config, toggles });
  }

  private _computeLabel = (schema: { name: string }): string => LABELS[schema.name] ?? schema.name;
  private _computeHelper = (schema: { name: string }): string | undefined => HELPERS[schema.name];

  private _clearDrafts(): void {
    if (Object.keys(this._drafts).length > 0) this._drafts = {};
    if (Object.keys(this._listDrafts).length > 0) this._listDrafts = {};
  }

  private _draft(key: string, value: Record<string, unknown>): void {
    this._drafts = { ...this._drafts, [key]: value };
  }

  /* ------------------------------------------------------------ global form */

  private _globalChanged(ev: CustomEvent<{ value: Record<string, unknown> }>): void {
    if (!this._config) return;
    const value = ev.detail.value;
    const next: QuickTogglesCardConfig = {
      ...this._config,
      title: (value.title as string) || undefined,
      size: (value.size as QuickTogglesCardConfig["size"]) || undefined,
      align: (value.align as QuickTogglesCardConfig["align"]) || undefined,
      columns: typeof value.columns === "number" ? value.columns : "auto",
    };
    if (next.title === undefined) delete next.title;
    // Never write a value that only equals the card's own default. Pinning it
    // makes the YAML lie about being deliberate, and freezes the card at
    // whatever the default happened to be the day the editor was opened —
    // which is exactly how a card ended up stuck on align: start after the
    // default changed to even.
    if (next.size === undefined || next.size === "md") delete next.size;
    if (next.align === undefined || next.align === "even") delete next.align;
    this._emit(next);
  }

  /* -------------------------------------------------------- toggle mutation */

  private _addToggle(): void {
    const toggles = [...this._toggles, { entity: "" } as ToggleItemConfig];
    this._clearDrafts();
    this._openToggle = toggles.length - 1;
    this._emitToggles(toggles);
  }

  private _addDivider(): void {
    this._emitToggles([...this._toggles, { type: "divider" }]);
  }

  private _removeToggle(index: number): void {
    this._clearDrafts();
    const toggles = this._toggles.filter((_, i) => i !== index);
    if (this._openToggle === index) this._openToggle = null;
    else if (this._openToggle !== null && this._openToggle > index) this._openToggle -= 1;
    this._emitToggles(toggles);
  }

  private _moveToggle(index: number, delta: -1 | 1): void {
    this._clearDrafts();
    const target = index + delta;
    const toggles = [...this._toggles];
    if (target < 0 || target >= toggles.length) return;
    [toggles[index], toggles[target]] = [toggles[target], toggles[index]];
    if (this._openToggle === index) this._openToggle = target;
    else if (this._openToggle === target) this._openToggle = index;
    this._emitToggles(toggles);
  }

  private _updateToggle(index: number, patch: ToggleItemConfig): void {
    const toggles = [...this._toggles];
    toggles[index] = patch;
    this._emitToggles(toggles);
  }

  private _toggleChanged(index: number, ev: CustomEvent<{ value: Record<string, unknown> }>): void {
    const item = this._toggles[index];
    const value = ev.detail.value;
    const next: ToggleItemConfig = {
      ...item,
      entity: (value.entity as string) || undefined,
      name: (value.name as string) || undefined,
      icon: (value.icon as string) || undefined,
      color: (value.color as string) || undefined,
      momentary: value.momentary === true ? true : undefined,
      confirm: value.confirm === true ? true : undefined,
    };
    // Object-form actions are YAML-only; leave whatever is there untouched.
    if (typeof item.tap_action !== "object") {
      next.tap_action = (value.tap_action as ToggleItemConfig["tap_action"]) || undefined;
    }
    if (typeof item.hold_action !== "object") {
      next.hold_action = (value.hold_action as ToggleItemConfig["hold_action"]) || undefined;
    }
    const pruned = prune(next as Record<string, unknown>) as ToggleItemConfig;
    if (item.states && item.states.length > 0) pruned.states = item.states;
    if (item.visible !== undefined) pruned.visible = item.visible;
    this._updateToggle(index, pruned);
  }

  private _setVisible(index: number, tests: TestFields[]): void {
    const item = { ...this._toggles[index] };
    const when = fieldsToWhen(tests);
    if (when !== undefined) item.visible = when;
    else delete item.visible;
    this._updateToggle(index, item);
  }

  /* --------------------------------------------------------- state mutation */

  private _statesOf(index: number): ToggleStateConfig[] {
    return this._toggles[index]?.states ?? [];
  }

  private _emitStates(index: number, states: ToggleStateConfig[]): void {
    const item = { ...this._toggles[index] };
    if (states.length > 0) item.states = states;
    else delete item.states;
    this._updateToggle(index, item);
  }

  private _addState(index: number): void {
    const states = [...this._statesOf(index), {} as ToggleStateConfig];
    this._clearDrafts();
    this._openState = `${index}:${states.length - 1}`;
    this._emitStates(index, states);
  }

  private _removeState(index: number, stateIndex: number): void {
    this._openState = null;
    this._clearDrafts();
    this._emitStates(
      index,
      this._statesOf(index).filter((_, i) => i !== stateIndex)
    );
  }

  private _moveState(index: number, stateIndex: number, delta: -1 | 1): void {
    const states = [...this._statesOf(index)];
    const target = stateIndex + delta;
    if (target < 0 || target >= states.length) return;
    [states[stateIndex], states[target]] = [states[target], states[stateIndex]];
    this._clearDrafts();
    this._openState = `${index}:${target}`;
    this._emitStates(index, states);
  }

  private _stateChanged(
    index: number,
    stateIndex: number,
    ev: CustomEvent<{ value: Record<string, unknown> }>
  ): void {
    const states = [...this._statesOf(index)];
    const previous = states[stateIndex] ?? {};
    const flat = ev.detail.value as unknown as FlatState;
    this._draft(`s${index}:${stateIndex}`, {
      badge_mode: flat.badge_mode,
      badge_entity: flat.badge_entity,
      badge_attribute: flat.badge_attribute,
    });
    states[stateIndex] = unflattenState(flat, previous);
    this._emitStates(index, states);
  }

  private _setStateWhen(index: number, stateIndex: number, tests: TestFields[]): void {
    const states = [...this._statesOf(index)];
    const entry = { ...(states[stateIndex] ?? {}) };
    const when = fieldsToWhen(tests);
    if (when !== undefined) entry.when = when;
    else delete entry.when;
    states[stateIndex] = entry;
    this._emitStates(index, states);
  }

  /* ---------------------------------------------------------------- render */

  private _previewFor(item: ToggleItemConfig): TemplateResult | typeof nothing {
    if (!this.hass) return nothing;
    const resolved = resolveItems(
      this.hass,
      // Previews ignore the visibility rule on purpose: a row you are editing
      // must stay on screen even when its own condition says to hide it.
      { type: "custom:quick-toggles-card", toggles: [{ ...item, visible: undefined }] },
      { pending: {}, armedIndex: null, flashIndex: null, reducedMotion: false }
    )[0];
    if (!resolved || resolved.kind !== "toggle") return nothing;
    return renderMedallion(resolved);
  }

  private _iconButton(
    icon: string,
    label: string,
    handler: () => void,
    opts: { disabled?: boolean; danger?: boolean } = {}
  ): TemplateResult {
    return html`
      <button
        class=${opts.danger ? "icon-btn danger" : "icon-btn"}
        type="button"
        title=${label}
        aria-label=${label}
        ?disabled=${opts.disabled === true}
        @click=${(e: Event) => {
          e.stopPropagation();
          handler();
        }}
      >
        <ha-icon icon=${icon}></ha-icon>
      </button>
    `;
  }

  private _testSchema(fields: TestFields) {
    const schema: unknown[] = [selectSchema("kind", KIND_VALUES, false, KIND_LABELS)];
    if (fields.kind !== "entity") return schema;

    schema.push({ name: "entity", selector: { entity: {} } });
    schema.push({ name: "attribute", selector: { text: {} } });
    schema.push(selectSchema("operator", OPERATOR_VALUES, false, OPERATOR_LABELS));
    if (!fields.operator || fields.operator === "active") return schema;

    if (fields.operator === "above" || fields.operator === "below") {
      // A numeric comparison wants a number, not a list of states.
      schema.push({ name: "value", selector: { number: { mode: "box", step: "any" } } });
      return schema;
    }

    // Offer what the chosen entity can actually be. custom_value keeps the
    // field free-text: this inference can't be complete, and a template
    // sensor's states aren't knowable from the entity registry at all.
    const options = stateOptions(this.hass, fields.entity, fields.attribute);
    schema.push(
      options.length > 0
        ? selectSchema("value", options, true)
        : { name: "value", selector: { text: {} } }
    );
    return schema;
  }

  /**
   * The shared condition-list widget, used for both a state entry's `when`
   * and a toggle's `visible`. Tests are ANDed, and AND is commutative — so
   * unlike the state entries themselves, these rows have no reorder buttons:
   * their order genuinely doesn't matter.
   */
  private _renderTests(
    keyPrefix: string,
    fromConfig: TestFields[],
    write: (tests: TestFields[]) => void,
    opts: { label: string; hint: string; emptyText: string }
  ): TemplateResult {
    const tests = this._listDrafts[keyPrefix] ?? fromConfig;
    const onChange = (next: TestFields[]): void => {
      this._listDrafts = { ...this._listDrafts, [keyPrefix]: next };
      write(next);
    };
    return html`
      <div class="sub-head">${opts.label}<span class="spacer"></span></div>
      <div class="hint">${opts.hint}</div>
      ${tests.length === 0
        ? html`<div class="cond-empty">${opts.emptyText}</div>`
        : tests.map((test, i) => {
            return html`
              <div class="trow">
                <div class="trow-head">
                  ${i > 0 ? html`<span class="and">and</span>` : nothing}
                  <span class="effect">Test ${i + 1}</span>
                  ${this._iconButton(
                    "mdi:close",
                    "Remove test",
                    () => onChange(tests.filter((_, j) => j !== i)),
                    { danger: true }
                  )}
                </div>
                <ha-form
                  .hass=${this.hass}
                  .data=${test}
                  .schema=${this._testSchema(test)}
                  .computeLabel=${this._computeLabel}
                  .computeHelper=${this._computeHelper}
                  @value-changed=${(e: CustomEvent<{ value: Record<string, unknown> }>) => {
                    const updated = e.detail.value as unknown as TestFields;
                    onChange(tests.map((t, j) => (j === i ? updated : t)));
                  }}
                ></ha-form>
              </div>
            `;
          })}
      <div class="add-row">
        <button
          class="text-btn"
          type="button"
          @click=${() => onChange([...tests, { kind: "entity", operator: "is" }])}
        >
          <ha-icon icon="mdi:plus"></ha-icon>Add test
        </button>
      </div>
    `;
  }

  private _stateSchema(flat: FlatState) {
    const schema: unknown[] = [
      { name: "icon", selector: { icon: {} } },
      selectSchema("color", COLOR_NAMES, true),
      selectSchema("animation", ANIMATIONS),
    ];
    if (flat.animation && flat.animation !== "none") {
      schema.push(selectSchema("animation_target", TARGETS));
    }
    schema.push(selectSchema("badge_mode", BADGE_MODES, false, BADGE_MODE_LABELS));
    if (flat.badge_mode !== "none") {
      schema.push(selectSchema("badge_color", COLOR_NAMES, true));
      schema.push(selectSchema("badge_animation", ANIMATIONS));
    }
    if (flat.badge_mode === "value") {
      schema.push({ name: "badge_entity", selector: { entity: {} } });
      schema.push({ name: "badge_attribute", selector: { text: {} } });
      schema.push({ name: "badge_round", selector: { number: { mode: "box", min: 0, max: 3, step: 1 } } });
      schema.push({ name: "badge_max", selector: { number: { mode: "box", min: 1, step: 1 } } });
    }
    return schema;
  }

  private _renderState(index: number, stateIndex: number, entry: ToggleStateConfig): TemplateResult {
    const key = `${index}:${stateIndex}`;
    const open = this._openState === key;
    const flat = { ...flattenState(entry), ...(this._drafts[`s${key}`] ?? {}) } as FlatState;
    const states = this._statesOf(index);

    return html`
      <div class="srow">
        <div
          class="srow-head"
          role="button"
          tabindex="0"
          @click=${() => {
            this._openState = open ? null : key;
          }}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            this._openState = open ? null : key;
          }}
        >
          <span class="chip">${whenSummary(entry.when)}</span>
          <span class="arrow">&rarr;</span>
          <span class="effect">${effectSummary(entry)}</span>
          <span class="row-actions">
            ${this._iconButton("mdi:arrow-up", "Move up", () => this._moveState(index, stateIndex, -1), {
              disabled: stateIndex === 0,
            })}
            ${this._iconButton("mdi:arrow-down", "Move down", () => this._moveState(index, stateIndex, 1), {
              disabled: stateIndex === states.length - 1,
            })}
            ${this._iconButton("mdi:delete-outline", "Delete condition", () => this._removeState(index, stateIndex), {
              danger: true,
            })}
          </span>
        </div>
        ${open
          ? html`
              <div class="srow-body">
                ${this._renderTests(
                  `w${key}`,
                  whenToFields(entry.when),
                  (tests) => this._setStateWhen(index, stateIndex, tests),
                  {
                    label: "Applies when",
                    hint: "Every test must hold. Order doesn't matter here — it's the order of the entries above that decides which one wins a field.",
                    emptyText: "Always — this entry's appearance applies unconditionally.",
                  }
                )}
                <div class="sub-head">Appearance<span class="spacer"></span></div>
                <ha-form
                  .hass=${this.hass}
                  .data=${flat}
                  .schema=${this._stateSchema(flat)}
                  .computeLabel=${this._computeLabel}
                  .computeHelper=${this._computeHelper}
                  @value-changed=${(e: CustomEvent<{ value: Record<string, unknown> }>) =>
                    this._stateChanged(index, stateIndex, e)}
                ></ha-form>
                ${typeof entry.glow === "number"
                  ? html`<div class="notice">Glow is set numerically (${entry.glow}) in YAML and is left as-is.</div>`
                  : nothing}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private _toggleSchema(item: ToggleItemConfig) {
    const schema: unknown[] = [
      { name: "entity", selector: { entity: {} } },
      { name: "name", selector: { text: {} } },
      { name: "icon", selector: { icon: {} } },
      selectSchema("color", COLOR_NAMES, true),
    ];
    if (typeof item.tap_action !== "object") {
      schema.push(selectSchema("tap_action", ["toggle", "more-info", "none"]));
    }
    if (typeof item.hold_action !== "object") {
      schema.push(selectSchema("hold_action", ["more-info", "toggle", "none"]));
    }
    schema.push({ name: "momentary", selector: { boolean: {} } });
    schema.push({ name: "confirm", selector: { boolean: {} } });
    return schema;
  }

  private _renderToggleRow(item: ToggleItemConfig, index: number): TemplateResult {
    const open = this._openToggle === index;
    const isDivider = itemKind(item) === "divider";
    const states = item.states ?? [];
    const friendly = item.entity ? this.hass?.states[item.entity]?.attributes.friendly_name : undefined;
    const title = isDivider ? "Divider" : item.name || friendly || item.entity || "New toggle";
    const subtitle = isDivider
      ? "A gap in the row"
      : [
          item.entity,
          states.length > 0 ? `${states.length} condition${states.length === 1 ? "" : "s"}` : null,
          item.visible !== undefined ? `shown when ${whenSummary(item.visible)}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || "No entity yet";

    const flatData: Record<string, unknown> = {
      entity: item.entity ?? "",
      name: item.name ?? "",
      icon: item.icon ?? "",
      color: item.color ?? "",
      momentary: item.momentary === true,
      confirm: item.confirm === true,
    };
    if (typeof item.tap_action !== "object") flatData.tap_action = (item.tap_action as string) ?? "toggle";
    if (typeof item.hold_action !== "object") flatData.hold_action = (item.hold_action as string) ?? "more-info";

    return html`
      <div class=${open ? "row open" : "row"}>
        <div
          class="row-head"
          role="button"
          tabindex="0"
          @click=${() => {
            this._openToggle = open ? null : index;
          }}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            this._openToggle = open ? null : index;
          }}
        >
          <div class="preview">
            ${isDivider ? html`<div class="divider"></div>` : this._previewFor(item)}
          </div>
          <div class="row-text">
            <div class="row-title">${title}</div>
            <div class="row-sub">${subtitle}</div>
          </div>
          <div class="row-actions">
            ${this._iconButton("mdi:arrow-up", "Move up", () => this._moveToggle(index, -1), {
              disabled: index === 0,
            })}
            ${this._iconButton("mdi:arrow-down", "Move down", () => this._moveToggle(index, 1), {
              disabled: index === this._toggles.length - 1,
            })}
            ${this._iconButton("mdi:delete-outline", "Delete", () => this._removeToggle(index), {
              danger: true,
            })}
            ${this._iconButton(open ? "mdi:chevron-up" : "mdi:chevron-down", open ? "Collapse" : "Expand", () => {
              this._openToggle = open ? null : index;
            })}
          </div>
        </div>
        ${open && !isDivider
          ? html`
              <div class="row-body">
                <ha-form
                  .hass=${this.hass}
                  .data=${flatData}
                  .schema=${this._toggleSchema(item)}
                  .computeLabel=${this._computeLabel}
                  .computeHelper=${this._computeHelper}
                  @value-changed=${(e: CustomEvent<{ value: Record<string, unknown> }>) =>
                    this._toggleChanged(index, e)}
                ></ha-form>
                ${typeof item.tap_action === "object" || typeof item.hold_action === "object"
                  ? html`<div class="notice">
                      This toggle uses a service-call action defined in YAML; those fields are
                      hidden here so they aren't overwritten.
                    </div>`
                  : nothing}

                ${this._renderTests(
                  `v${index}`,
                  whenToFields(item.visible),
                  (tests) => this._setVisible(index, tests),
                  {
                    label: "Visible when",
                    hint: "Hides the toggle entirely unless every test holds. A test naming an entity that doesn't exist keeps the toggle visible, so a typo can't make a control vanish.",
                    emptyText: "Always shown.",
                  }
                )}

                <div class="sub-head">Conditional states<span class="spacer"></span></div>
                <div class="hint">
                  Evaluated top-down, and earliest wins <em>per field</em> — so a condition only
                  has to say what's different (&ldquo;also spin the glyph&rdquo;), and inherits the
                  rest from the toggle above.
                </div>
                ${states.map((entry, stateIndex) => this._renderState(index, stateIndex, entry))}
                <div class="add-row">
                  <button class="text-btn" type="button" @click=${() => this._addState(index)}>
                    <ha-icon icon="mdi:plus"></ha-icon>Add conditional state
                  </button>
                </div>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  protected render() {
    if (!this._config) return nothing;

    const globalData = {
      title: this._config.title ?? "",
      size: this._config.size ?? "md",
      align: this._config.align ?? "even",
      columns: typeof this._config.columns === "number" ? this._config.columns : undefined,
    };

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${globalData}
        .schema=${GLOBAL_SCHEMA}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${(e: CustomEvent<{ value: Record<string, unknown> }>) => this._globalChanged(e)}
      ></ha-form>

      <div class="section">
        <div class="section-head">Toggles</div>
        ${this._toggles.length === 0
          ? html`<div class="empty">No toggles yet. Add the first one below.</div>`
          : html`<div class="list">
              ${this._toggles.map((item, index) => this._renderToggleRow(item, index))}
            </div>`}
        <div class="add-row">
          <button class="text-btn" type="button" @click=${() => this._addToggle()}>
            <ha-icon icon="mdi:plus"></ha-icon>Add toggle
          </button>
          <button class="text-btn" type="button" @click=${() => this._addDivider()}>
            <ha-icon icon="mdi:minus"></ha-icon>Add divider
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "quick-toggles-card-editor": QuickTogglesCardEditor;
  }
}
