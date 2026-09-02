import { HomeAssistant, ScheduleBlocksByEntity, ScheduleTimeBlock, WEEKDAYS, Weekday } from "./types";

type GetScheduleResponse = Record<string, Partial<Record<Weekday, ScheduleTimeBlock[]>>>;

/**
 * schedule.* entities only expose `next_event` (and any active block's
 * "additional data") as state attributes — the monday/tuesday/... time
 * ranges themselves live outside entity state and have to be pulled via the
 * schedule.get_schedule service instead.
 */
export async function fetchScheduleBlocks(
  hass: HomeAssistant,
  entityIds: string[]
): Promise<ScheduleBlocksByEntity> {
  const result: ScheduleBlocksByEntity = new Map();
  if (entityIds.length === 0) {
    return result;
  }

  const { response } = await hass.callService(
    "schedule",
    "get_schedule",
    {},
    { entity_id: entityIds },
    true,
    true
  );
  const byEntity = response as GetScheduleResponse | undefined;

  for (const entityId of entityIds) {
    const entry = byEntity?.[entityId];
    const blocksByDay = {} as Record<Weekday, ScheduleTimeBlock[]>;
    for (const day of WEEKDAYS) {
      blocksByDay[day] = entry?.[day] ?? [];
    }
    result.set(entityId, blocksByDay);
  }

  return result;
}
