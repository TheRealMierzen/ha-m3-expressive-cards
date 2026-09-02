import { HomeAssistant, ToggleCondition, WhenClause, WhenTest } from "./types";

/**
 * States counted as "on". Deliberately broader than `=== "on"`: a toggle can
 * legitimately point at a `vacuum.*` (cleaning), a `cover.*` (open) or a
 * `media_player.*` (playing), and all of those should read as active. Not
 * exhaustive across every domain HA has — it covers what a quick-toggle row
 * plausibly holds, and anything else simply reads as off.
 */
const ON_STATES = new Set([
  "on",
  "open",
  "opening",
  "home",
  "playing",
  "cleaning",
  "returning",
  "active",
  "heat",
  "cool",
  "heat_cool",
  "auto",
  "dry",
  "fan_only",
  "armed",
  "armed_home",
  "armed_away",
  "armed_night",
  "unlocked",
  "true",
  "1",
]);

export const UNAVAILABLE_STATES = new Set(["unavailable", "unknown", ""]);

export function isOnState(state: string | undefined): boolean {
  if (state === undefined) return false;
  return ON_STATES.has(state.toLowerCase());
}

/** Case-insensitive string compare — HA states are lowercase, user config isn't reliably. */
function sameValue(actual: unknown, expected: string | number | boolean): boolean {
  return String(actual).toLowerCase() === String(expected).toLowerCase();
}

function numeric(actual: unknown): number {
  if (typeof actual === "number") return actual;
  return Number(String(actual));
}

export interface MatchOptions {
  /**
   * What a condition naming a non-existent entity evaluates to. Appearance
   * conditions fail closed (the override just doesn't apply); visibility
   * conditions fail open, so a typo can't make a control disappear.
   */
  missingEntity?: boolean;
}

/**
 * Evaluates one condition. Never throws — a typo'd or removed entity degrades
 * to `opts.missingEntity` (false by default), not a blank card.
 */
export function matchCondition(
  hass: HomeAssistant,
  cond: ToggleCondition,
  selfEntity: string | undefined,
  opts: MatchOptions = {}
): boolean {
  const missing = opts.missingEntity ?? false;
  const entityId = cond.entity ?? selfEntity;
  if (!entityId) return missing;
  const entity = hass.states[entityId];
  if (!entity) return missing;

  const actual: unknown = cond.attribute ? entity.attributes[cond.attribute] : entity.state;
  if (cond.attribute && actual === undefined) return false;

  let tested = false;
  if (cond.state !== undefined) {
    tested = true;
    if (!sameValue(actual, cond.state)) return false;
  }
  if (cond.state_not !== undefined) {
    tested = true;
    if (sameValue(actual, cond.state_not)) return false;
  }
  if (cond.above !== undefined) {
    tested = true;
    const n = numeric(actual);
    if (!Number.isFinite(n) || n <= cond.above) return false;
  }
  if (cond.below !== undefined) {
    tested = true;
    const n = numeric(actual);
    if (!Number.isFinite(n) || n >= cond.below) return false;
  }

  // A condition that names an entity but tests nothing about it means
  // "this entity exists and is on" — the useful reading of `{entity: x}`.
  if (!tested) return isOnState(entity.state);
  return true;
}

/**
 * `undefined` matches (an unconditional override), `on`/`off` test the
 * toggle's own optimistic state, an array ANDs its conditions.
 */
export function matchWhen(
  hass: HomeAssistant,
  when: WhenClause | undefined,
  selfEntity: string | undefined,
  selfOn: boolean,
  opts: MatchOptions = {}
): boolean {
  if (when === undefined) return true;
  if (when === "on") return selfOn;
  if (when === "off") return !selfOn;
  if (Array.isArray(when)) {
    if (when.length === 0) return true;
    // An array may mix the on/off shorthand with entity conditions.
    return when.every((test) => matchWhen(hass, test, selfEntity, selfOn, opts));
  }
  if (typeof when === "object") return matchCondition(hass, when, selfEntity, opts);
  return false;
}

/** The tests in a clause, normalised to a list. */
export function whenTests(when: WhenClause | undefined): WhenTest[] {
  if (when === undefined) return [];
  return Array.isArray(when) ? when : [when];
}

/** One thing the card watches: an entity's state, or one of its attributes. */
export interface EntityRef {
  entity: string;
  attribute?: string;
}

/**
 * Everything a toggle's conditions read, for the card's entity signature.
 * Attribute conditions produce an attribute ref rather than a state ref —
 * a `battery_level` condition has to re-render the card when only that
 * attribute moves, and an entity's state can sit unchanged across an
 * attribute update for hours.
 */
export function conditionRefs(when: WhenClause | undefined): EntityRef[] {
  const refs: EntityRef[] = [];
  for (const test of whenTests(when)) {
    if (typeof test === "string") continue;
    const cond = test;
    if (typeof cond.entity !== "string" || cond.entity === "") continue;
    refs.push(cond.attribute ? { entity: cond.entity, attribute: cond.attribute } : { entity: cond.entity });
  }
  return refs;
}
