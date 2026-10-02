import { HassEntity, HomeAssistant } from "../src/types";

/** A repeatable wobble per entity, so a reload draws the same graph. */
function hashOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * Stands in for `history/history_during_period` in the wire shape real HA
 * uses (compressed rows, `lu` in seconds), so the card's own parsing runs.
 * Readings every three minutes wander around the entity's current value, and
 * two hours a few hours back read `unavailable` — the PC asleep — so the
 * graphs show their gap handling. Like the recorder, the first row is the
 * state already in effect at `start_time`, stamped before it.
 */
function mockHistory(states: Record<string, HassEntity>, message: Record<string, unknown>) {
  const start = Date.parse(String(message.start_time));
  const end = Date.parse(String(message.end_time));
  const response: Record<string, Array<{ s: string; lu: number }>> = {};
  for (const id of (message.entity_ids as string[]) ?? []) {
    const current = Number(states[id]?.state);
    if (!Number.isFinite(current)) continue;
    const seed = hashOf(id);
    const rows: Array<{ s: string; lu: number }> = [];
    const gapStart = end - 7 * 3_600_000;
    const gapEnd = gapStart + 2 * 3_600_000;
    for (let t = start - 60_000; t < end; t += 180_000) {
      const asleep = t >= gapStart && t < gapEnd;
      const phase = (t / 3_600_000 + (seed % 97)) * 0.9;
      const wobble = 0.35 * Math.sin(phase) + 0.15 * Math.sin(phase * 3.7 + seed);
      const value = Math.max(0, current * (1 + wobble));
      rows.push({ s: asleep ? "unavailable" : value.toFixed(2), lu: t / 1000 });
    }
    response[id] = rows;
  }
  return response;
}

export function buildMockHass(
  entities: HassEntity[],
  darkMode: boolean,
  onCallService: (domain: string, service: string, data?: Record<string, unknown>) => void,
  onCallWS?: (message: Record<string, unknown>) => void
): HomeAssistant {
  const states: Record<string, HassEntity> = {};
  for (const entity of entities) {
    states[entity.entity_id] = entity;
  }
  return {
    states,
    themes: { darkMode },
    callService: onCallService,
    callWS: <T>(message: Record<string, unknown>): Promise<T> => {
      onCallWS?.(message);
      if (message.type !== "history/history_during_period") {
        return Promise.reject(new Error(`Unknown command ${String(message.type)}`));
      }
      return new Promise((resolve) => setTimeout(() => resolve(mockHistory(states, message) as T), 150));
    },
  };
}
