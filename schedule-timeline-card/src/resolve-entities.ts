import { paletteColor } from "./palette";
import {
  HomeAssistant,
  ResolvedScheduleEntity,
  ScheduleBlocksByEntity,
  ScheduleTimelineCardConfig,
  WEEKDAYS,
  Weekday,
} from "./types";

const SCHEDULE_DOMAIN_PREFIX = "schedule.";
const EMPTY_BLOCKS_BY_DAY = Object.fromEntries(WEEKDAYS.map((day) => [day, []])) as Record<
  Weekday,
  never[]
>;

/**
 * Auto-discovers schedule.* entities from hass.states, applies config
 * ordering/overrides/excludes, and assigns each a stable palette color.
 * Block data comes from `blocksByEntity` (see schedule-service.ts) rather
 * than entity attributes, since schedule.* entities don't expose their
 * weekly time ranges via state — entities not yet present there (fetch
 * still in flight) just render with no blocks until it resolves.
 */
export function resolveEntities(
  hass: HomeAssistant,
  config: ScheduleTimelineCardConfig,
  darkMode: boolean,
  blocksByEntity?: ScheduleBlocksByEntity
): ResolvedScheduleEntity[] {
  const allIds = Object.keys(hass.states).filter((id) =>
    id.startsWith(SCHEDULE_DOMAIN_PREFIX)
  );
  const excluded = new Set(config.exclude_entities ?? []);
  const overridesById = new Map(
    (config.entities ?? []).map((override) => [override.entity, override])
  );

  let orderedIds: string[];
  if (config.entities && config.entities.length > 0) {
    const explicit = config.entities
      .map((override) => override.entity)
      .filter((id) => hass.states[id] !== undefined);
    const listed = new Set(explicit);
    const extras = allIds
      .filter((id) => !listed.has(id) && !excluded.has(id))
      .sort((a, b) => friendlyName(hass, a).localeCompare(friendlyName(hass, b)));
    orderedIds = [...explicit, ...extras];
  } else {
    orderedIds = [...allIds].sort((a, b) =>
      friendlyName(hass, a).localeCompare(friendlyName(hass, b))
    );
  }

  orderedIds = orderedIds.filter((id) => !excluded.has(id));

  return orderedIds.map((entityId, index) => {
    const state = hass.states[entityId];
    const override = overridesById.get(entityId);
    const blocksByDay = blocksByEntity?.get(entityId) ?? EMPTY_BLOCKS_BY_DAY;
    return {
      entityId,
      label: override?.label ?? state.attributes.friendly_name ?? entityId,
      color: override?.color ?? paletteColor(index, darkMode),
      icon: override?.icon ?? state.attributes.icon,
      blocksByDay,
    };
  });
}

function friendlyName(hass: HomeAssistant, entityId: string): string {
  return hass.states[entityId]?.attributes.friendly_name ?? entityId;
}
