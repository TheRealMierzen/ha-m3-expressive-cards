import { HassEntity } from "../src/types";

export interface FixtureState {
  automationOn: boolean;
  shouldWater: boolean;
  valveOn: boolean;
  valveLastChanged: string;
  timerState: "idle" | "active" | "paused";
  timerDuration: string; // "H:MM:SS"
  timerFinishesAt?: string; // ISO, when active
  timerRemaining?: string; // "H:MM:SS", when paused
}

function entity(id: string, state: string, extra: Partial<HassEntity["attributes"]> = {}, lastChanged?: string): HassEntity {
  return {
    entity_id: id,
    state,
    last_changed: lastChanged ?? new Date().toISOString(),
    attributes: { friendly_name: id, ...extra },
  };
}

export function buildFixtureEntities(s: FixtureState): HassEntity[] {
  return [
    entity("automation.irrigation_ai", s.automationOn ? "on" : "off"),
    entity("input_boolean.should_water", s.shouldWater ? "on" : "off"),
    entity("input_datetime.irrigation_start", "06:00:00"),
    entity("input_datetime.irrigation_stop", "06:15:00"),
    entity("input_number.irrigation_duration", "15"),
    entity(
      "timer.irrigation",
      s.timerState,
      {
        duration: s.timerDuration,
        ...(s.timerState === "active" ? { finishes_at: s.timerFinishesAt } : {}),
        ...(s.timerState === "paused" ? { remaining: s.timerRemaining } : {}),
      }
    ),
    entity("switch.irrigation_valve", s.valveOn ? "on" : "off", {}, s.valveLastChanged),
  ];
}
