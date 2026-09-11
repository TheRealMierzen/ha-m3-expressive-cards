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
    /** Current soil-water balance, in `bucket_unit`. Zero is field capacity —
     * the soil holding all the water it usefully can — and is the resting
     * value a run leaves behind. Negative is a deficit; positive is rain
     * banked above capacity, which drains away over the following days.
     *
     * A calculation moves it by `ET0 x multiplier x interval + precipitation`,
     * caps the result at `maximum_bucket`, and then subtracts drainage *only
     * while the bucket is above zero*. A deficit therefore never drains: once
     * negative, the only things that bring it back are rain and irrigation. */
    bucket?: number;
    bucket_unit?: string;
    /** The cap on banked rain, in `bucket_unit`. Water above it is runoff.
     * Doubles as the top of the gauge's surplus band. */
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
    /** The crop factor Kc. Also exposed as a number.* entity. It scales the
     * *evapotranspiration* — `ETc = ET0 x Kc` — and so changes how fast the
     * bucket drains, not how long a run is. (It used to be applied to the
     * duration; the integration moved it in its #779, because scaling the
     * whole water balance scaled the rain along with it.) */
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
    /* ---- the three ET numbers, which are not three of the same thing ----
     * The integration's own issue #528 is about exactly this confusion. */
    /** The *net* depth the last calculation applied to the bucket:
     * `ET0 x Kc x interval + precipitation`. Positive when more rain fell
     * than water evaporated. Named "Applied ET" by the integration's own
     * entity, which is what makes it so easy to read as the day's ET. */
    et_value?: number;
    /** The raw per-day figure the calculation module returned, before the
     * interval scaling, before the crop factor and before any rain. Negative,
     * because it is a deficiency. */
    et_deficiency?: number;
    /** Reference evapotranspiration — the positive number weather services
     * quote. Exactly `-et_deficiency`, so the card shows one or the other and
     * never both. */
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

/**
 * A minimal slice of Home Assistant's Hass type, just what this card reads.
 *
 * `callWS` is here for the same class of reason `activity-heatmap` has it:
 * the thing the card wants isn't in `hass.states`. Smart Irrigation's next
 * start is computed on demand from the selected start trigger, `sun.sun` and
 * the days-between-irrigation counter, and served over the websocket
 * connection to the integration's own Info panel — it was never given an
 * entity. Optional, and every call site guards on it, because an older
 * install (or a card rendered somewhere without a connection) simply doesn't
 * get a next run.
 */
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  themes?: { darkMode?: boolean };
  callService(domain: string, service: string, serviceData?: Record<string, unknown>): void;
  callWS?<T = unknown>(message: Record<string, unknown>): Promise<T>;
}

export interface SmartIrrigationCardConfig {
  type: string;
  title?: string;

  /** The zones to show, as their main duration sensors, in display order.
   * Left out, the card shows every zone it can discover, ordered by zone id
   * — which is what makes it work with no configuration at all. */
  zones?: string[];

  /** Overrides where the next run comes from.
   *
   * By default the card asks the integration, over the same
   * `smart_irrigation/info` websocket command its own Info panel uses, so
   * the next start it shows is the integration's own answer — the selected
   * start trigger, its offset, sunrise or sunset, and any remaining
   * days-between-irrigation skip days all included. There is no entity for
   * this; the integration never made one.
   *
   * Set this only when something *other* than the integration's triggers
   * decides when watering happens — your own automation, say. It takes a
   * `schedule.*` helper (its `next_event` is used), an `input_datetime.*`
   * (time-only is resolved to its next occurrence), or any sensor whose
   * state is a timestamp. */
  next_schedule?: string;

  /** The integration's three service buttons. Discovered when left out. */
  refresh_weather?: string;
  calculate_all?: string;
  irrigate_all?: string;

  /** Per-zone details section. On by default; turn it off for a card that
   * only ever answers "do the zones need water". */
  show_details?: boolean;

  /** The deficit that counts as needing water, as a positive depth in the
   * zone's own bucket unit. It is both the gauge's marked watering point and
   * the line the "Needs water" verdict is drawn at.
   *
   * Left out, the card takes the zone's own `irrigation_threshold` from the
   * integration — the allowed depletion, which *is* this number — and falls
   * back to a quarter of `maximum_bucket` for the zones (most of them, since
   * it is the default) whose threshold is zero. Set this only to overrule
   * both.
   *
   * `deficit_scale` is the name this had when it only set the depth of the
   * gauge's sump; it is still accepted and means the same thing. */
  watering_point?: number;
  /** @deprecated Use `watering_point`. */
  deficit_scale?: number;

  /** How long "Hold to irrigate" has to be held, in ms. */
  hold_ms?: number;
}
