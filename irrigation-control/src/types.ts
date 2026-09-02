export interface HassEntity {
  entity_id: string;
  state: string;
  /** When this entity's state last changed — used for the valve's "last
   * watered" label as a simple proxy (last on OR off flip). */
  last_changed?: string;
  attributes: {
    friendly_name?: string;
    icon?: string;
    /** Present on timer.* entities while active: ISO datetime of completion. */
    finishes_at?: string;
    /** Present on timer.* entities: configured/last-used duration, "H:MM:SS". */
    duration?: string;
    /** Present on timer.* entities while paused: time left, "H:MM:SS". */
    remaining?: string;
    [key: string]: unknown;
  };
}

/** A minimal slice of Home Assistant's Hass type, just what this card reads. */
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  themes?: { darkMode?: boolean };
  callService(domain: string, service: string, serviceData?: Record<string, unknown>): void;
}

export interface IrrigationScheduleCardConfig {
  type: string;
  title?: string;
  /** The AI-driven scheduling automation — enables/disables auto watering. */
  automation?: string;
  /** input_boolean (or similar): today's water/skip decision. */
  should_water?: string;
  /** input_datetime (time-only): scheduled start time, "HH:MM:SS". */
  start_time?: string;
  /** input_datetime (time-only): scheduled stop time, "HH:MM:SS". */
  stop_time?: string;
  /** input_number: run duration in minutes. */
  duration?: string;
  /** timer.* entity: counts down once the scheduled start time arrives. */
  timer?: string;
  /** switch.* entity: the actual irrigation valve. */
  valve?: string;
}
