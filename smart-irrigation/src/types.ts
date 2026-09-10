export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    icon?: string;
    device_class?: string;
    unit_of_measurement?: string;

    /* ---- Smart Irrigation: how a zone's entities identify themselves ----
     * Every entity the integration creates for a zone carries that zone's
     * numeric id, but the main duration sensor spells it `id` and all the
     * satellites spell it `zone_id`. Both are read, which is what lets the
     * card group a zone's entities together without matching entity-id
     * strings — so renaming an entity doesn't break discovery. */
    id?: number;
    zone_id?: number;

    /* ---- the zone model, all carried by the main duration sensor ----
     * The sensor's own state is the run duration in seconds; everything
     * needed to explain that number is in its attributes, so one entity per
     * zone is enough to draw the whole card. */
    /** Current bucket level in mm. Negative means a soil-moisture deficit
     * (irrigation needed to bring it back to 0); positive means banked rain.
     * Zero is field capacity, and is the normal resting value. */
    bucket?: number;
    bucket_unit?: string;
    /** The cap on how much surplus the bucket can bank, in mm. Doubles as
     * the top of the gauge's scale. */
    maximum_bucket?: number;
    /** "automatic" | "manual" | "disabled" — the zone's operating mode.
     * Named `state` in the attributes, which is not the entity's state. */
    state?: string;
    /** Zone area, and the unit the integration reports it in — which arrives
     * as the HTML string "m<sup>2</sup>", not as a plain unit. */
    size?: number;
    size_unit?: string;
    /** Delivery rate for the zone, used to turn a duration into litres. */
    throughput?: number;
    throughput_unit?: string;
    drainage_rate?: number;
    drainage_rate_unit?: string;
    current_drainage?: number;
    current_drainage_unit?: string;
    /** Scales the calculated duration. Also exposed as a number.* entity. */
    multiplier?: number;
    /** Seconds added to every run, e.g. for a valve that opens slowly. */
    lead_time?: number;
    /** Seconds. A calculated duration is clamped to this. */
    maximum_duration?: number;
    /** ISO-ish "YYYY-MM-DD HH:MM:SS" (integration-local, no timezone). */
    last_updated?: string;
    last_calculated?: string;
    /** How many weather samples the last calculation was based on. */
    number_of_data_points?: number;
    et_value?: number;
    et_deficiency?: number;
    eto?: number;
    /** binary_sensor.*_problem explains itself here. */
    reason?: string | null;

    /** schedule.* helpers: ISO datetime of their next state change. */
    next_event?: string;

    /** number.* bounds, read by the multiplier stepper. */
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

export interface SmartIrrigationCardConfig {
  type: string;
  title?: string;

  /** The zones to show, as their main duration sensors, in display order.
   * Left out, the card shows every zone it can discover, ordered by zone id
   * — which is what makes it work with no configuration at all. */
  zones?: string[];

  /** When the next watering run is due. The integration doesn't schedule
   * anything itself (an automation of yours calls its services), so there is
   * no next-run entity to discover — point this at whatever actually holds
   * the schedule: a `schedule.*` helper (its `next_event` is used), an
   * `input_datetime.*`, or any sensor whose state is a timestamp. */
  next_schedule?: string;

  /** The integration's three service buttons. Discovered when left out. */
  refresh_weather?: string;
  calculate_all?: string;
  irrigate_all?: string;

  /** Per-zone details section. On by default; turn it off for a card that
   * only ever answers "do the zones need water". */
  show_details?: boolean;

  /** mm of deficit that fills the gauge's sump — the band below the zero
   * line. Left out, a quarter of the zone's own maximum_bucket, so the
   * scale adapts per zone instead of needing to be tuned. */
  deficit_scale?: number;

  /** How long "Hold to irrigate" has to be held, in ms. */
  hold_ms?: number;
}
