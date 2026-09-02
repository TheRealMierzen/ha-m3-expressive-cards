import { HassEntity } from "../src/types";

export interface FixtureState {
  powerOn: boolean;
  currentTemp: number;
  targetTemp: number;
  timeToHeatMin: number;
  /** The live shower time — doubles as the override time when overrideOn
   * is true; reset to a datetime built from defaultShowerTimeTod whenever
   * override turns off. */
  nextShowerIso: string;
  mode: "heating" | "cooling";
  efficiency: number;
  overrideOn: boolean;
  /** Bare time-of-day, "HH:MM:SS" — real input_datetime helpers configured
   * as "time only" report just this, no date component. */
  defaultShowerTimeTod: string;
}

function entity(id: string, state: string, extra: Partial<HassEntity["attributes"]> = {}): HassEntity {
  return {
    entity_id: id,
    state,
    attributes: { friendly_name: id, ...extra },
  };
}

export function buildFixtureEntities(s: FixtureState): HassEntity[] {
  return [
    entity("switch.geyser_power", s.powerOn ? "on" : "off"),
    entity("sensor.geyser_current_temp", String(s.currentTemp)),
    entity("input_number.geyser_target_temp", String(s.targetTemp), { min: 40, max: 70, step: 1 }),
    entity("sensor.geyser_time_to_heat", String(s.timeToHeatMin)),
    entity("sensor.geyser_next_shower", s.nextShowerIso),
    entity("automation.geyser_heating", s.mode === "heating" ? "on" : "off"),
    entity("sensor.geyser_efficiency", String(s.efficiency)),
    entity("input_boolean.geyser_shower_override", s.overrideOn ? "on" : "off"),
    entity("input_datetime.geyser_default_shower_time", s.defaultShowerTimeTod),
  ];
}
