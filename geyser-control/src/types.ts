export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    icon?: string;
    /** input_number attributes, read for the target-temp stepper's step size. */
    min?: number;
    max?: number;
    step?: number;
    [key: string]: unknown;
  };
}

/** A minimal slice of Home Assistant's Hass type, just what this card reads. */
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  themes?: { darkMode?: boolean };
  callService(domain: string, service: string, serviceData?: Record<string, unknown>): void;
}

export interface GeyserStatusCardConfig {
  type: string;
  title?: string;

  /** switch.* — powers the heating element directly. */
  switch?: string;
  /** sensor.* — current water temperature. */
  current_temp?: string;
  /** input_number — target temperature; also drives the stepper in Settings. */
  target_temp?: string;
  /** sensor.* — minutes remaining to reach target (or an "H:MM:SS" duration). */
  time_to_heat?: string;
  /** sensor.*, input_datetime.*, etc. — next scheduled shower time. Doubles
   * as the override time: when shower_override_switch is on, this holds
   * the overridden value directly (there's no separate override-time
   * entity — an automation resets this back to the default schedule
   * whenever the override switch turns off). */
  next_shower?: string;

  /** automation.* — display only. Enabled means heating; disabled means
   * cooling — a single automation drives both states. */
  heating_automation?: string;
  /** sensor.* — heating efficiency, e.g. a percentage. */
  efficiency?: string;

  /** switch.* or input_boolean.* — when on, next_shower holds an
   * overridden time instead of the default schedule. */
  shower_override_switch?: string;
  /** sensor.*, input_datetime.*, etc. — the default shower time the
   * override-reset automation restores next_shower to when the override
   * switch turns off. Shown for reference in Settings. */
  default_shower_time?: string;
}
