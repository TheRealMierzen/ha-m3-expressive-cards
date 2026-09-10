import { HassEntity, HomeAssistant } from "../src/types";

/**
 * The shared mock, plus a websocket handler.
 *
 * This is the one place this card's harness diverges from the copy the other
 * cards share, and it diverges for the same reason `activity-heatmap`'s does:
 * the card reads something that isn't in `hass.states`. Here it is Smart
 * Irrigation's next start, which the integration computes on demand and
 * serves over `smart_irrigation/info` rather than exposing as an entity, so
 * the harness has to answer that command for the card's real fetch path to be
 * exercised at all.
 *
 * `onCallWS` left out imitates an install with no websocket handler for it —
 * an older integration, or a card rendered without a connection — which is
 * the path where the card must fall back to showing no next run rather than
 * an error.
 */
export function buildMockHass(
  entities: HassEntity[],
  darkMode: boolean,
  onCallService: (domain: string, service: string, data?: Record<string, unknown>) => void,
  onCallWS?: (message: Record<string, unknown>) => Promise<unknown>
): HomeAssistant {
  const states: Record<string, HassEntity> = {};
  for (const entity of entities) {
    states[entity.entity_id] = entity;
  }
  return {
    states,
    themes: { darkMode },
    callService: onCallService,
    // Deliberately absent, not a stub that resolves undefined, when no
    // handler is given: the card guards on `typeof hass.callWS === "function"`
    // and that guard is what is being tested.
    ...(onCallWS ? { callWS: <T>(message: Record<string, unknown>) => onCallWS(message) as Promise<T> } : {}),
  };
}
