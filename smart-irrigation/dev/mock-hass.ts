import { HassEntity, HomeAssistant } from "../src/types";

export function buildMockHass(
  entities: HassEntity[],
  darkMode: boolean,
  onCallService: (domain: string, service: string, data?: Record<string, unknown>) => void
): HomeAssistant {
  const states: Record<string, HassEntity> = {};
  for (const entity of entities) {
    states[entity.entity_id] = entity;
  }
  return {
    states,
    themes: { darkMode },
    callService: onCallService,
  };
}
