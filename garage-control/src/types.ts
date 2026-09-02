export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    icon?: string;
    last_triggered?: string;
    last_triggered_at?: string;
    /** cover: bitmask — OPEN 1, CLOSE 2, SET_POSITION 4, STOP 8. */
    supported_features?: number;
    /** cover: 0 (shut) – 100 (fully open), when the opener reports it. */
    current_position?: number;
    device_class?: string;
    [key: string]: unknown;
  };
}

/** A minimal slice of Home Assistant's Hass type, just what this card reads. */
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  themes?: { darkMode?: boolean };
  callService(domain: string, service: string, serviceData?: Record<string, unknown>): void;
}

export interface GarageAutoOpenCardConfig {
  type: string;
  title?: string;
  automation?: string;

  left_entity?: string;
  right_entity?: string;
  left_label?: string;
  right_label?: string;

  /** The `cover.*` door each side actually drives. Optional — with neither
   * set the card renders exactly as it did before door controls existed. */
  left_cover?: string;
  right_cover?: string;

  /** How long Open/Close must be held before the door moves, in ms.
   * Defaults to 600. `0` disables the hold and fires on a plain tap. */
  hold_ms?: number;

  /** How to interpret "home"/"away" on left_entity/right_entity. */
  home_state?: string;
  home_states?: string[];
  left_home_state?: string;
  right_home_state?: string;
  left_home_states?: string[];
  right_home_states?: string[];
}
