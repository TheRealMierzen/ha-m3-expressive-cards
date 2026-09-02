import { HomeAssistant } from "./types";

/**
 * States a domain can be in, for entities that don't enumerate them in an
 * attribute. Not exhaustive across all of HA — it covers what a quick-toggle
 * row plausibly points at, and anything unlisted simply falls back to a free
 * text field, which is what the editor had before.
 */
const DOMAIN_STATES: Record<string, string[]> = {
  alarm_control_panel: [
    "disarmed",
    "armed_home",
    "armed_away",
    "armed_night",
    "armed_vacation",
    "armed_custom_bypass",
    "arming",
    "pending",
    "triggered",
  ],
  automation: ["on", "off"],
  binary_sensor: ["on", "off"],
  calendar: ["on", "off"],
  climate: ["off", "heat", "cool", "heat_cool", "auto", "dry", "fan_only"],
  cover: ["open", "closed", "opening", "closing"],
  device_tracker: ["home", "not_home"],
  fan: ["on", "off"],
  humidifier: ["on", "off"],
  input_boolean: ["on", "off"],
  light: ["on", "off"],
  lock: ["locked", "unlocked", "locking", "unlocking", "open", "jammed"],
  media_player: ["off", "on", "idle", "playing", "paused", "standby", "buffering"],
  person: ["home", "not_home"],
  remote: ["on", "off"],
  schedule: ["on", "off"],
  script: ["on", "off"],
  siren: ["on", "off"],
  sun: ["above_horizon", "below_horizon"],
  switch: ["on", "off"],
  timer: ["active", "idle", "paused"],
  update: ["on", "off"],
  vacuum: ["cleaning", "docked", "idle", "paused", "returning", "error"],
  valve: ["open", "closed", "opening", "closing"],
  water_heater: ["eco", "electric", "performance", "high_demand", "heat_pump", "gas", "off"],
  weather: [
    "clear-night",
    "cloudy",
    "exceptional",
    "fog",
    "hail",
    "lightning",
    "lightning-rainy",
    "partlycloudy",
    "pouring",
    "rainy",
    "snowy",
    "snowy-rainy",
    "sunny",
    "windy",
  ],
};

/** Attributes that enumerate the entity's own possible *states*. */
const STATE_LIST_ATTRIBUTES = ["options", "hvac_modes", "operation_list"];

/**
 * For an attribute condition, the sibling attribute that lists that
 * attribute's legal values — HA's own convention of `preset_mode` being
 * chosen from `preset_modes`.
 */
const ATTRIBUTE_LIST_ATTRIBUTES: Record<string, string[]> = {
  preset_mode: ["preset_modes"],
  fan_mode: ["fan_modes"],
  swing_mode: ["swing_modes"],
  hvac_mode: ["hvac_modes"],
  hvac_action: ["hvac_modes"],
  source: ["source_list"],
  sound_mode: ["sound_mode_list"],
  effect: ["effect_list"],
  operation_mode: ["operation_list"],
  mode: ["available_modes", "modes"],
  device_class: [],
};

const NOT_WORTH_OFFERING = new Set(["unavailable", "unknown", ""]);

function pushList(into: Set<string>, value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    if (item === null || item === undefined || typeof item === "object") continue;
    const text = String(item);
    if (NOT_WORTH_OFFERING.has(text.toLowerCase())) continue;
    into.add(text);
  }
}

/**
 * Values worth offering for an `is` / `is not` test against this entity, most
 * likely first (its current value leads).
 *
 * Returns an empty list when there's nothing meaningful to suggest — a
 * free-text sensor, or a numeric reading where `above` / `below` is the right
 * tool and an "is 78" dropdown would be noise. The editor falls back to a
 * plain text field in that case, and even when options *are* offered the
 * field stays free-text-capable, since this inference can't be complete.
 */
export function stateOptions(
  hass: HomeAssistant | undefined,
  entityId: string | undefined,
  attribute?: string
): string[] {
  if (!hass || !entityId) return [];
  const entity = hass.states[entityId];
  if (!entity) return [];

  const options = new Set<string>();

  if (attribute) {
    for (const key of ATTRIBUTE_LIST_ATTRIBUTES[attribute] ?? []) {
      pushList(options, entity.attributes[key]);
    }
    const current = entity.attributes[attribute];
    // A list-valued attribute describes choices for something else, not its
    // own value, so it's never a candidate here.
    if (current !== undefined && current !== null && typeof current !== "object") {
      const text = String(current);
      if (!NOT_WORTH_OFFERING.has(text.toLowerCase()) && !Number.isFinite(Number(text))) {
        return [text, ...[...options].filter((o) => o !== text)];
      }
    }
    return [...options];
  }

  for (const key of STATE_LIST_ATTRIBUTES) pushList(options, entity.attributes[key]);
  for (const state of DOMAIN_STATES[entityId.split(".")[0]] ?? []) options.add(state);

  const current = entity.state;
  if (NOT_WORTH_OFFERING.has(current.toLowerCase())) return [...options];
  // A purely numeric state (a sensor reading) is not a useful "is" choice on
  // its own, but it shouldn't suppress a domain's real state list either.
  if (Number.isFinite(Number(current))) return [...options];
  return [current, ...[...options].filter((o) => o !== current)];
}
