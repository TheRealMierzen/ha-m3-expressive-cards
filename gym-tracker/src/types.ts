export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    icon?: string;
    unit_of_measurement?: string;
    [key: string]: unknown;
  };
}

/** A minimal slice of Home Assistant's Hass type, just what this card reads. */
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  themes?: { darkMode?: boolean };
  callService(domain: string, service: string, serviceData?: Record<string, unknown>): void;
}

export interface GymTrackerCardConfig {
  type: string;
  title?: string;
  /** counter.*: visits logged so far this period. */
  actual_counter?: string;
  /** counter.*: visit goal for this period. */
  target_counter?: string;
  /** sensor.*: 0-100 adherence percentage, pre-computed elsewhere. */
  adherence_sensor?: string;
  /** input_number.*: membership cost per month. */
  monthly_cost_entity?: string;
  /** number.*: monthly cost divided across the period, pre-computed elsewhere. */
  daily_cost_entity?: string;
  /** number.*: cost attributable to missed visits, pre-computed elsewhere. */
  money_wasted_entity?: string;
  /** Currency symbol prefixed to cost figures. Defaults to "R". */
  currency?: string;
  /** Adherence % at/above which the ring and badges read as "good". Defaults to 80. */
  good_threshold?: number;
  /** Adherence % at/above which the ring and badges read as "ok" rather than "bad". Defaults to 50. */
  ok_threshold?: number;
}
