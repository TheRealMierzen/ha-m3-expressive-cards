import { LayoutBlock, LayoutLane, ResolvedScheduleEntity, Weekday } from "./types";
import { MINUTES_PER_DAY, parseTimeToMinutes, weekdayAtOffset, windowMinutesToPercent } from "./time-utils";

const DEFAULT_SHORT_BLOCK_MINUTES = 10;

/**
 * Lays out one lane per entity for the given visible window. The window is
 * expressed in minutes relative to viewedDay's midnight (0) and can extend
 * negative (hours pulled in from the day before) or past 1440 (hours pulled
 * in from the day after) — see the range-extend controls in
 * schedule-timeline-card.ts. Every weekday whose midnight-to-midnight span
 * could contribute a block to that window is walked (with a day of
 * lookback so a block that starts just before the window can still spill
 * in), each block's own from/to is placed on an absolute minute timeline,
 * and clipped to the window. Blocks shorter than `shortBlockMinutes` are
 * classified as "trigger" markers rather than bars, so tiny helpers (roomba
 * start, get ready, ...) stay legible next to hour-long blocks (sleep, gym,
 * WFH hours).
 */
export function buildLanes(
  entities: ResolvedScheduleEntity[],
  viewedDay: Weekday,
  shortBlockMinutes: number = DEFAULT_SHORT_BLOCK_MINUTES,
  windowStartMinutes: number = 0,
  windowEndMinutes: number = MINUTES_PER_DAY
): LayoutLane[] {
  const firstDayIndex = Math.floor(windowStartMinutes / MINUTES_PER_DAY) - 1;
  const lastDayIndex = Math.floor((windowEndMinutes - 1) / MINUTES_PER_DAY);

  return entities.map((entity) => {
    const blocks: LayoutBlock[] = [];

    for (let dayIndex = firstDayIndex; dayIndex <= lastDayIndex; dayIndex++) {
      const day = weekdayAtOffset(viewedDay, dayIndex);
      const dayOffsetMinutes = dayIndex * MINUTES_PER_DAY;
      const dayBlocks = entity.blocksByDay[day] ?? [];

      for (const block of dayBlocks) {
        const fromMin = parseTimeToMinutes(block.from);
        const toMinRaw = parseTimeToMinutes(block.to);
        const crossesMidnight = toMinRaw <= fromMin;
        const absFrom = dayOffsetMinutes + fromMin;
        const absTo = dayOffsetMinutes + toMinRaw + (crossesMidnight ? MINUTES_PER_DAY : 0);

        const overlapStart = Math.max(absFrom, windowStartMinutes);
        const overlapEnd = Math.min(absTo, windowEndMinutes);
        if (overlapStart >= overlapEnd) {
          continue;
        }

        const durationMinutes = overlapEnd - overlapStart;
        blocks.push({
          entityId: entity.entityId,
          kind: durationMinutes < shortBlockMinutes ? "trigger" : "block",
          startPercent: windowMinutesToPercent(overlapStart, windowStartMinutes, windowEndMinutes),
          widthPercent:
            windowMinutesToPercent(overlapEnd, windowStartMinutes, windowEndMinutes) -
            windowMinutesToPercent(overlapStart, windowStartMinutes, windowEndMinutes),
          from: block.from,
          to: block.to,
          clippedAtStart: absFrom < windowStartMinutes,
          clippedAtEnd: absTo > windowEndMinutes,
        });
      }
    }

    blocks.sort((a, b) => a.startPercent - b.startPercent);

    return {
      entityId: entity.entityId,
      label: entity.label,
      color: entity.color,
      icon: entity.icon,
      blocks,
    };
  });
}
