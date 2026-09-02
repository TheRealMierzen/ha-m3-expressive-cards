import { HassEntity, HomeAssistant } from "../src/types";

export function buildMockHass(entities: HassEntity[], darkMode: boolean): HomeAssistant {
  const states: Record<string, HassEntity> = {};
  for (const entity of entities) {
    states[entity.entity_id] = entity;
  }
  return {
    states,
    themes: { darkMode },
    callService: () => {
      // This card never calls a service — every entity here is read-only.
    },
  };
}
