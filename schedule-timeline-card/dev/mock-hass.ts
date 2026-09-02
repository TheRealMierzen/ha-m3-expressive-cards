import { HassEntity, HomeAssistant, ScheduleTimeBlock, Weekday } from "../src/types";

/**
 * Mirrors real HA: schedule.* entities' weekly blocks aren't in state
 * attributes, only retrievable via the schedule.get_schedule service — so
 * the mock's callService is what actually serves fixture block data, same
 * as the real integration would.
 */
export function buildMockHass(
  entities: HassEntity[],
  scheduleBlocks: Record<string, Record<Weekday, ScheduleTimeBlock[]>>,
  darkMode: boolean
): HomeAssistant {
  const states: Record<string, HassEntity> = {};
  for (const entity of entities) {
    states[entity.entity_id] = entity;
  }
  return {
    states,
    locale: { language: "en" },
    language: "en",
    themes: { darkMode },
    async callService(domain, service, _serviceData, target) {
      if (domain !== "schedule" || service !== "get_schedule") {
        throw new Error(`mock-hass: unsupported service ${domain}.${service}`);
      }
      const entityIds = ([] as string[]).concat(target?.entity_id ?? []);
      const response: Record<string, Record<Weekday, ScheduleTimeBlock[]>> = {};
      for (const entityId of entityIds) {
        if (scheduleBlocks[entityId]) {
          response[entityId] = scheduleBlocks[entityId];
        }
      }
      return { response };
    },
  };
}
