export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const WEEKDAYS: Weekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export interface ScheduleTimeBlock {
  from: string; // "HH:MM:SS"
  to: string; // "HH:MM:SS"
}

/** A minimal slice of Home Assistant's Hass type, just what this card reads. */
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    icon?: string;
    next_event?: string;
    [weekday: string]: unknown;
  };
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  locale?: { language?: string };
  language?: string;
  themes?: { darkMode?: boolean };
  callService(
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
    target?: { entity_id?: string | string[] },
    notifyOnError?: boolean,
    returnResponse?: boolean
  ): Promise<{ response?: unknown }>;
}

/** Per-entity weekly blocks, as returned by the `schedule.get_schedule`
 * service — this is NOT part of a schedule.* entity's state attributes. */
export type ScheduleBlocksByEntity = Map<string, Record<Weekday, ScheduleTimeBlock[]>>;

export interface EntityConfigOverride {
  entity: string;
  color?: string;
  label?: string;
  icon?: string;
}

export interface ScheduleTimelineCardConfig {
  type: string;
  title?: string;
  exclude_entities?: string[];
  entities?: EntityConfigOverride[];
  short_block_minutes?: number;
  default_hidden?: string[];
}

/** A resolved entity ready for layout: merged config overrides + live state. */
export interface ResolvedScheduleEntity {
  entityId: string;
  label: string;
  color: string;
  icon?: string;
  blocksByDay: Record<Weekday, ScheduleTimeBlock[]>;
}

export type LayoutBlockKind = "block" | "trigger";

export interface LayoutBlock {
  entityId: string;
  kind: LayoutBlockKind;
  /** 0-100, position within the visible window (which may span more than
   * one calendar day if the user has pulled in extra hours) */
  startPercent: number;
  widthPercent: number;
  from: string;
  to: string;
  /** true if the underlying event started before the visible window — this
   * fragment is a continuation, not the real start */
  clippedAtStart?: boolean;
  /** true if the underlying event continues past the visible window's end */
  clippedAtEnd?: boolean;
}

export interface LayoutLane {
  entityId: string;
  label: string;
  color: string;
  icon?: string;
  blocks: LayoutBlock[];
}
