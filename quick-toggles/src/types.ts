/** A minimal slice of Home Assistant's entity type, just what this card reads. */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    icon?: string;
    [key: string]: unknown;
  };
}

/** A minimal slice of Home Assistant's Hass type, just what this card reads. */
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  themes?: { darkMode?: boolean };
  callService(domain: string, service: string, serviceData?: Record<string, unknown>): void;
}

/* ------------------------------------------------------------------ config */

export type AnimationType =
  | "none"
  | "sweep"
  | "spin"
  | "pulse"
  | "breathe"
  | "bounce"
  | "shake"
  | "sheen"
  | "flash";

/** The four independently animatable layers of a medallion. */
export type AnimationTarget = "glyph" | "ring" | "plate" | "badge";

/**
 * One test against an entity. Multiple keys in a single condition are ANDed
 * (`{entity, attribute, above}` = "that attribute is above N"). `entity`
 * defaults to the toggle's own entity when omitted.
 */
export interface ToggleCondition {
  entity?: string;
  /** Test an attribute instead of the state. */
  attribute?: string;
  state?: string | number | boolean;
  state_not?: string | number | boolean;
  above?: number;
  below?: number;
}

/** One test: a condition, or the toggle's own optimistic on/off state. */
export type WhenTest = "on" | "off" | ToggleCondition;

/**
 * `on` / `off` are shorthand for the toggle's own entity (and are evaluated
 * against the optimistic state, so appearance flips the instant you tap).
 * An array means every test must hold — and the array may mix the shorthand
 * with entity conditions, so "this toggle is on AND the vacuum is cleaning"
 * is expressible.
 */
export type WhenClause = WhenTest | WhenTest[];

export interface BadgeConfig {
  color?: string;
  animation?: AnimationType;
  /**
   * Show a value in the badge instead of a plain dot — a battery level, a
   * count, a temperature. Defaults to the toggle's own entity.
   */
  entity?: string;
  /** Read an attribute instead of the state. */
  attribute?: string;
  /** Decimal places for numeric values. Default 0. */
  round?: number;
  /** Values above this render as "N+", keeping the pill to two or three
   * characters the way a notification badge does. */
  max?: number;
}

/**
 * A conditional appearance override. Fields left out fall through to the
 * next matching entry, then to the toggle's base config — see
 * `resolveItems()`.
 */
export interface ToggleStateConfig {
  /** Omitted means "always matches" — useful as an unconditional override. */
  when?: WhenClause;
  icon?: string;
  color?: string;
  animation?: AnimationType;
  animation_target?: AnimationTarget;
  badge?: boolean | BadgeConfig;
  glow?: boolean | number;
}

export type ActionName = "toggle" | "more-info" | "call-service" | "none";

export interface ActionConfig {
  action: ActionName;
  /** "domain.service", for action: call-service. */
  service?: string;
  service_data?: Record<string, unknown>;
}

/** Either the bare action name or the full object form. */
export type ActionSpec = ActionName | ActionConfig;

export interface ToggleItemConfig {
  /** "divider" renders a spacer instead of a medallion; takes no other keys. */
  type?: "toggle" | "divider";
  entity?: string;
  /** Accessible label and native tooltip only — never drawn on the card. */
  name?: string;
  icon?: string;
  color?: string;
  /** Flashes on press instead of latching — for scripts and scenes. */
  momentary?: boolean;
  /** Requires a second tap within 2s before the action fires. */
  confirm?: boolean;
  tap_action?: ActionSpec;
  hold_action?: ActionSpec;
  states?: ToggleStateConfig[];
  /**
   * Show this toggle only while the condition holds. Same shape as a
   * `states` condition, but a condition naming an entity that doesn't exist
   * evaluates to *visible* here rather than hidden — a typo shouldn't quietly
   * delete a control from the dashboard.
   */
  visible?: WhenClause;
}

export type CardSize = "sm" | "md" | "lg";
export type CardAlign = "even" | "start" | "center" | "space-between" | "space-evenly";

export interface QuickTogglesCardConfig {
  type: string;
  title?: string;
  size?: CardSize;
  align?: CardAlign;
  /** "auto" wraps via flex; a number lays out a fixed grid. */
  columns?: number | "auto";
  toggles?: ToggleItemConfig[];
}

/* --------------------------------------------------------------- view model */

/** Card-owned runtime state that isn't derivable from `hass`. */
export interface RuntimeState {
  /** entity_id -> optimistically assumed on/off, pending confirmation. */
  pending: Record<string, boolean>;
  /** Index of the item awaiting its confirmation tap, if any. */
  armedIndex: number | null;
  /** Index of the item currently running its one-shot press flash. */
  flashIndex: number | null;
  reducedMotion: boolean;
}

export interface ResolvedBadge {
  color: string;
  animation: AnimationType;
  /** Rendered inside the badge when set; otherwise it stays a plain dot. */
  text?: string;
  /** Ink for that text, picked for contrast against `color`. */
  textColor?: string;
}

export interface ResolvedToggle {
  kind: "toggle";
  index: number;
  entityId?: string;
  /** Accessible name; not rendered as text. */
  label: string;
  icon: string;
  color: string;
  on: boolean;
  available: boolean;
  /** True while an optimistic flip is awaiting confirmation from HA. */
  pending: boolean;
  momentary: boolean;
  armed: boolean;
  flashing: boolean;
  /** 0..1 — outer glow strength. */
  glow: number;
  badge?: ResolvedBadge;
  /** At most one animation per layer. */
  animations: Partial<Record<AnimationTarget, AnimationType>>;
  /**
   * Set when motion was suppressed for prefers-reduced-motion but the
   * toggle would have been animating — the ring and badge then carry that
   * state statically instead.
   */
  emphasis: boolean;
}

export interface ResolvedDivider {
  kind: "divider";
  index: number;
}

export type ResolvedItem = ResolvedToggle | ResolvedDivider;
