import { GarageAutoOpenCardConfig, HomeAssistant } from "./types";

const UNKNOWN_STATES = new Set(["unknown", "unavailable"]);

function isUnknown(state: unknown): boolean {
  return state == null || UNKNOWN_STATES.has(String(state).toLowerCase());
}

function isBoolOn(state: unknown): boolean {
  const l = String(state ?? "").toLowerCase();
  return l === "on" || l === "true" || l === "enabled";
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  let d = Date.now() - t;
  if (d < 0) d = 0;
  const s = Math.floor(d / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const days = Math.floor(h / 24);
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (h > 0) return `${h} hour${h === 1 ? "" : "s"} ago`;
  if (m > 0) return `${m} min${m === 1 ? "" : "s"} ago`;
  return "just now";
}

function homeStateMatches(
  state: unknown,
  homeStates: string[] | null | undefined,
  homeState: string | null | undefined
): boolean {
  const l = String(state ?? "").toLowerCase();
  if (Array.isArray(homeStates) && homeStates.length) {
    return homeStates.some((candidate) => l === String(candidate).toLowerCase());
  }
  return homeState != null ? l === String(homeState).toLowerCase() : l === "home";
}

/* ------------------------------------------------------------------ doors */

/** `cover` supported_features bits. SET_POSITION (4) is deliberately absent:
 * a garage door is open or shut, and this card offers no position slider. */
const COVER_SUPPORT_OPEN = 1;
const COVER_SUPPORT_CLOSE = 2;
const COVER_SUPPORT_STOP = 8;

export type DoorState = "open" | "closed" | "opening" | "closing" | "unknown" | "unavailable";

export interface ComputedDoor {
  entityId: string;
  state: DoorState;
  /** Badge text: "Open", "Open 40%", "Closed", "Opening", "Closing", … */
  text: string;
  moving: boolean;
  available: boolean;
  position: number | null;
  canOpen: boolean;
  canClose: boolean;
  /** Whether to draw the Stop segment at all — the opener has to support
   * STOP, or the group is a two-segment Open/Close pair instead. */
  hasStop: boolean;
  canStop: boolean;
}

function normaliseDoorState(state: string | undefined): DoorState {
  const l = String(state ?? "").toLowerCase();
  if (l === "open" || l === "closed" || l === "opening" || l === "closing") return l;
  if (l === "unavailable") return "unavailable";
  return "unknown";
}

export function computeDoor(hass: HomeAssistant, entityId?: string | null): ComputedDoor | null {
  if (!entityId) return null;
  const entity = hass.states[entityId];
  const state = normaliseDoorState(entity?.state);
  // A configured-but-missing entity is reported as unavailable rather than
  // hidden — silently dropping the controls would read as "this card has no
  // door" when the real answer is "that entity id is wrong".
  const available = Boolean(entity) && state !== "unavailable";

  const rawPos = entity?.attributes.current_position;
  const position = typeof rawPos === "number" && Number.isFinite(rawPos) ? Math.round(rawPos) : null;

  // Not every integration reports supported_features. Assuming open+close
  // (and no stop) keeps the two directional buttons working on those, and
  // errs towards hiding a Stop the opener may not honour rather than
  // showing one that does nothing.
  const rawFeatures = entity?.attributes.supported_features;
  const features =
    typeof rawFeatures === "number" && Number.isFinite(rawFeatures)
      ? rawFeatures
      : COVER_SUPPORT_OPEN | COVER_SUPPORT_CLOSE;

  const moving = state === "opening" || state === "closing";
  const hasStop = (features & COVER_SUPPORT_STOP) !== 0;

  let text: string;
  if (!available) text = "Unavailable";
  else if (state === "opening") text = "Opening";
  else if (state === "closing") text = "Closing";
  else if (state === "closed") text = "Closed";
  else if (state === "open") text = position != null && position > 0 && position < 100 ? `Open ${position}%` : "Open";
  else text = "Unknown";

  return {
    entityId,
    state,
    text,
    moving,
    available,
    position,
    // An unknown state leaves both directions enabled on purpose: the card
    // can't tell where the door is, so it must not be the thing that stops
    // you from moving it.
    canOpen: available && (features & COVER_SUPPORT_OPEN) !== 0 && state !== "open" && state !== "opening",
    canClose: available && (features & COVER_SUPPORT_CLOSE) !== 0 && state !== "closed" && state !== "closing",
    hasStop,
    canStop: available && hasStop && moving,
  };
}

/** Watermark glyph behind a tile, following the door where there is one. */
export function doorGlyph(door: ComputedDoor | null): string {
  if (!door) return "mdi:garage-variant-lock";
  if (door.moving) return "mdi:garage-alert-variant";
  if (door.state === "open") return "mdi:garage-open-variant";
  return "mdi:garage-variant";
}

export interface ComputedGarageVals {
  autoEnabled: boolean;
  lastTriggeredText: string;
  leftHome: boolean;
  rightHome: boolean;
  leftText: string;
  rightText: string;
  leftDoor: ComputedDoor | null;
  rightDoor: ComputedDoor | null;
}

export function computeVals(hass: HomeAssistant, c: GarageAutoOpenCardConfig): ComputedGarageVals {
  const states = hass.states;
  const get = (id?: string | null): string | undefined => (id ? states[id]?.state : undefined);

  const autoId = c.automation;
  const autoState = autoId ? states[autoId]?.state : undefined;
  const autoEnabled = !isUnknown(autoState) ? isBoolOn(autoState) : false;

  const autoAttrs = autoId ? states[autoId]?.attributes ?? {} : {};
  const lastTriggered =
    (autoAttrs.last_triggered as string | undefined) ?? (autoAttrs.last_triggered_at as string | undefined) ?? null;

  const leftState = get(c.left_entity);
  const rightState = get(c.right_entity);

  const leftHome = homeStateMatches(leftState, c.left_home_states ?? c.home_states, c.left_home_state ?? c.home_state);
  const rightHome = homeStateMatches(
    rightState,
    c.right_home_states ?? c.home_states,
    c.right_home_state ?? c.home_state
  );

  return {
    autoEnabled,
    lastTriggeredText: lastTriggered ? timeAgo(lastTriggered) : "—",
    leftHome,
    rightHome,
    leftText: leftHome ? "Home" : "Away",
    rightText: rightHome ? "Home" : "Away",
    leftDoor: computeDoor(hass, c.left_cover),
    rightDoor: computeDoor(hass, c.right_cover),
  };
}
