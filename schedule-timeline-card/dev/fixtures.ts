import { HassEntity, ScheduleTimeBlock, Weekday, WEEKDAYS } from "../src/types";

const WEEKDAYS_ONLY = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const MWF = ["monday", "wednesday", "friday"];

/** Mirrors real HA: entity attributes only carry next_event etc., never the
 * weekly blocks themselves (those come from schedule.get_schedule) — see
 * FIXTURE_SCHEDULE_BLOCKS below. */
function entity(id: string, friendlyName: string, icon: string): HassEntity {
  return {
    entity_id: `schedule.${id}`,
    state: "off",
    attributes: {
      friendly_name: friendlyName,
      icon,
      next_event: "2026-07-23T06:30:00+00:00",
    },
  };
}

function blocksByDay(perDay: (day: Weekday) => ScheduleTimeBlock[]): Record<Weekday, ScheduleTimeBlock[]> {
  const result = {} as Record<Weekday, ScheduleTimeBlock[]>;
  for (const day of WEEKDAYS) {
    result[day] = perDay(day);
  }
  return result;
}

/** Mirrors a realistic set of native HA `schedule.*` helpers, deliberately
 * including the edge cases the card's layout math has to handle:
 * midnight-crossing (sleep), weekday-only (WFH), MWF-only (gym), and
 * short "trigger" style blocks (roomba, get ready, auto PC on). */
export const FIXTURE_ENTITIES: HassEntity[] = [
  entity("sleep", "Sleep", "mdi:bed"),
  entity("gym", "Gym", "mdi:dumbbell"),
  entity("wfh_hours", "WFH Hours", "mdi:laptop"),
  entity("get_ready", "Get Ready", "mdi:tshirt-crew"),
  entity("auto_pc_on", "Auto PC On", "mdi:power"),
  entity("roomba_start", "Roomba Start", "mdi:robot-vacuum"),
  entity("evening_wind_down", "Evening Wind Down", "mdi:weather-night"),
];

/** What the schedule.get_schedule service would return for each fixture
 * entity, keyed by entity_id — see mock-hass.ts's callService. */
export const FIXTURE_SCHEDULE_BLOCKS: Record<string, Record<Weekday, ScheduleTimeBlock[]>> = {
  "schedule.sleep": blocksByDay(() => [{ from: "22:30:00", to: "06:30:00" }]),

  "schedule.gym": blocksByDay((day) =>
    MWF.includes(day) ? [{ from: "18:00:00", to: "19:15:00" }] : []
  ),

  "schedule.wfh_hours": blocksByDay((day) =>
    WEEKDAYS_ONLY.includes(day) ? [{ from: "08:00:00", to: "17:00:00" }] : []
  ),

  "schedule.get_ready": blocksByDay((day) =>
    WEEKDAYS_ONLY.includes(day) ? [{ from: "07:00:00", to: "07:05:00" }] : []
  ),

  "schedule.auto_pc_on": blocksByDay((day) =>
    WEEKDAYS_ONLY.includes(day) ? [{ from: "08:55:00", to: "09:00:00" }] : []
  ),

  "schedule.roomba_start": blocksByDay((day) =>
    MWF.includes(day) ? [{ from: "10:00:00", to: "10:02:00" }] : []
  ),

  "schedule.evening_wind_down": blocksByDay(() => [{ from: "21:00:00", to: "22:30:00" }]),
};
