import { HassEntity, QuickTogglesCardConfig } from "../src/types";

export type VacuumState = "docked" | "cleaning" | "returning" | "error";

export interface FixtureState {
  gymDay: boolean;
  onLeave: boolean;
  roombaSchedule: boolean;
  guestMode: boolean;
  vacuum: VacuumState;
  vacuumBattery: number;
  /** script.clean_house — flips on for a moment when the momentary button fires. */
  scriptRunning: boolean;
  /** Drives the visibility rule on Guest mode. */
  houseMode: "home" | "away";
}

function entity(id: string, state: string, extra: Partial<HassEntity["attributes"]> = {}): HassEntity {
  return { entity_id: id, state, attributes: { friendly_name: id, ...extra } };
}

export function buildFixtureEntities(s: FixtureState): HassEntity[] {
  return [
    entity("input_boolean.gym_day", s.gymDay ? "on" : "off", { friendly_name: "Gym day" }),
    entity("input_boolean.on_leave", s.onLeave ? "on" : "off", { friendly_name: "On leave" }),
    entity("input_boolean.roomba_schedule", s.roombaSchedule ? "on" : "off", {
      friendly_name: "Roomba schedule",
    }),
    entity("input_boolean.guest_mode", s.guestMode ? "on" : "off", { friendly_name: "Guest mode" }),
    entity("vacuum.roomba", s.vacuum, { friendly_name: "Roomba", battery_level: s.vacuumBattery }),
    entity("script.clean_house", s.scriptRunning ? "on" : "off", { friendly_name: "Clean house" }),
    entity("sensor.house_mode", s.houseMode, { friendly_name: "House mode" }),
    // Enumerates its own states in an `options` attribute, the way select.*
    // and input_select.* do — the editor reads those for its value dropdown.
    entity("input_select.house_scene", "Day", {
      friendly_name: "House scene",
      options: ["Morning", "Day", "Evening", "Night"],
    }),
    entity("sensor.power_draw", "412.5", { friendly_name: "Power draw", unit_of_measurement: "W" }),
    // Deliberately absent from the card config — proves the entity signature
    // only tracks what the card actually reads.
    entity("sensor.unrelated_noise", "0"),
  ];
}

/**
 * The config from DESIGN.md, with the battery condition first on purpose: it
 * claims the badge layer before the `cleaning` entry can, while `cleaning`
 * still supplies the spin. That's the per-field cascade in one screenshot —
 * a red low-battery dot on a spinning medallion.
 */
export const DEV_CONFIG: QuickTogglesCardConfig = {
  type: "custom:m3-quick-toggles-card",
  title: "Controls",
  size: "md",
  // align omitted on purpose: the harness should show the default even split.
  toggles: [
    { entity: "input_boolean.gym_day", name: "Gym day", icon: "mdi:weight-lifter", color: "amber" },
    { entity: "input_boolean.on_leave", name: "On leave", icon: "mdi:sleep", color: "indigo" },
    { type: "divider" },
    {
      entity: "input_boolean.roomba_schedule",
      name: "Roomba schedule",
      icon: "mdi:robot-vacuum",
      color: "cyan",
      states: [
        {
          // Two tests, ANDed: a low battery only matters while it's out
          // working. Docked and charging at 12% is not a problem.
          when: [
            { entity: "vacuum.roomba", attribute: "battery_level", below: 20 },
            { entity: "vacuum.roomba", state_not: "docked" },
          ],
          badge: {
            entity: "vacuum.roomba",
            attribute: "battery_level",
            color: "red",
            animation: "pulse",
          },
        },
        {
          when: { entity: "vacuum.roomba", state: "cleaning" },
          animation: "spin",
          badge: { entity: "vacuum.roomba", attribute: "battery_level", color: "cyan" },
        },
        { when: { entity: "vacuum.roomba", state: "returning" }, animation: "sweep", color: "amber" },
        { when: { entity: "vacuum.roomba", state: "error" }, animation: "shake", color: "red" },
        { when: "off", icon: "mdi:robot-vacuum-off" },
      ],
    },
    // confirm: two taps, so the harness exercises the armed state.
    // visible: only while the house is in home mode.
    {
      entity: "input_boolean.guest_mode",
      name: "Guest mode",
      icon: "mdi:bed",
      color: "purple",
      confirm: true,
      visible: { entity: "sensor.house_mode", state: "home" },
    },
    {
      entity: "script.clean_house",
      name: "Run clean-up",
      icon: "mdi:broom",
      color: "teal",
      momentary: true,
      tap_action: { action: "call-service", service: "script.turn_on" },
      states: [{ when: { entity: "script.clean_house", state: "on" }, animation: "sheen", glow: 0.8 }],
    },
    {
      entity: "input_boolean.missing_helper",
      name: "Missing entity",
      icon: "mdi:alert-circle-outline",
    },
  ],
};
