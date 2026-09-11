import { HassEntity } from "../src/types";

/** One zone's worth of harness state, in the same terms the integration
 * thinks in. Everything the card *derives* is derived here too, from these
 * inputs — see durationFor below. */
export interface FixtureZone {
  zoneId: number;
  name: string;
  /** Object-id prefix, so the fixture entity ids look like the real ones. */
  slug: string;
  /** m². Volume for a mm of water over the zone is size litres. */
  size: number;
  /** Litres per minute for the whole zone. */
  throughput: number;
  /** mm the bucket can bank. Top of the gauge's surplus band. */
  maximumBucket: number;
  /** mm. Negative is a deficit, positive is banked rain, 0 is capacity. */
  bucket: number;
  /** mm of deficit the zone is allowed to build up before the integration
   * produces a run at all — its `irrigation_threshold`. Zero is the
   * integration's own default and means "water as soon as anything is
   * missing"; it is served over `smart_irrigation/zones`, never as an
   * entity, which is why the card has to ask for it. */
  irrigationThreshold: number;
  mode: "automatic" | "manual" | "disabled";
  multiplier: number;
  leadTime: number;
  /** Seconds. A calculated run is clipped to this. */
  maximumDuration: number;
  /** mm of reference evapotranspiration for the day. */
  eto: number;
  /** mm of rain in the same interval. Nets off the evapotranspiration to
   * give the depth the calculation actually moved the bucket by. */
  precipitation: number;
  drainageRate: number;
  currentDrainage: number;
  wateringNow: boolean;
  /** The integration's own problem reason, or null for no problem. */
  problem: string | null;
  waterUsed: number;
  lastIrrigationIso: string;
  lastCalculated: string;
  dataPoints: number;
}

export interface FixtureState {
  zones: FixtureZone[];
  /** What the configured next-run entity reports. */
  nextRunIso: string;
}

/**
 * The run the integration would calculate for a zone, from that zone's own
 * numbers — never a separately-authored value.
 *
 * The card turns a duration back into litres (throughput times the running
 * time, less the lead time) and prints that next to the bucket it came from.
 * A harness where those two didn't agree would make a correct card look like
 * it was doing bad arithmetic, so the harness does the integration's sum
 * rather than inventing a duration: a millimetre of water over `size` square
 * metres is `size` litres, delivered at `throughput` litres a minute.
 *
 * Two details that are easy to get wrong, and were:
 *
 * - **The multiplier is not in here.** It is the crop factor Kc, and the
 *   integration applies it to the evapotranspiration filling the bucket, not
 *   to the run draining it (its #779) — applying it at the end scaled the
 *   whole water balance, crediting only Kc times the rain that fell.
 * - **A deficit under the zone's allowed depletion produces no run at all**,
 *   which is the whole point of the threshold: the water builds up into one
 *   deep soak instead of a trickle every day.
 */
export function durationFor(zone: FixtureZone): number {
  if (zone.bucket >= 0) return 0;
  const deficit = -zone.bucket;
  if (deficit < zone.irrigationThreshold) return 0;
  const litres = deficit * zone.size;
  // Clipped to the cap first, and only then given the lead time — a valve
  // that takes 15s to open does not come out of the watering.
  const seconds = Math.min((litres / zone.throughput) * 60, zone.maximumDuration);
  return Math.round(seconds + zone.leadTime);
}

/**
 * The two depth figures the integration publishes per zone, from one source.
 *
 * They are not the same quantity and are routinely read as if they were (the
 * integration's own issue #528):
 *
 * - `et_deficiency` is the raw per-day figure the calculation module
 *   returned, before the crop factor and before any rain. Negative.
 * - `et_value` is the *net* depth the calculation applied to the bucket:
 *   `ET0 x Kc x interval + precipitation`. Positive on a wet day. The
 *   integration names its entity "Applied ET", which is exactly why it gets
 *   read as the day's evapotranspiration.
 *
 * `eto` is `-et_deficiency` and nothing else, so the card shows one of the
 * two and never both. The interval here is a day, so the interval multiplier
 * is 1 and drops out.
 */
export function etFor(zone: FixtureZone): { etDeficiency: number; etValue: number } {
  const etDeficiency = -zone.eto;
  return { etDeficiency, etValue: etDeficiency * zone.multiplier + zone.precipitation };
}

function entity(id: string, state: string, attributes: HassEntity["attributes"] = {}): HassEntity {
  return { entity_id: id, state, attributes };
}

/** "YYYY-MM-DD HH:MM:SS", the shape the integration writes its own
 * timestamp attributes in — no timezone, unlike its timestamp sensors. */
export function localStamp(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export function buildFixtureEntities(s: FixtureState): HassEntity[] {
  const out: HassEntity[] = [
    // The integration's zone-independent entities. No zone_id on any of
    // them, which is how the card tells them from a zone's own buttons.
    entity("update.smart_irrigation_update", "off", { friendly_name: "Smart Irrigation Update" }),
    entity("button.smart_irrigation_calculate_all", "unknown", {
      icon: "mdi:calculator-variant",
      friendly_name: "Smart Irrigation Calculate all zones",
    }),
    entity("button.smart_irrigation_update_weather", "unknown", {
      icon: "mdi:weather-cloudy-arrow-right",
      friendly_name: "Smart Irrigation Refresh weather",
    }),
    entity("button.smart_irrigation_irrigate_all", "unknown", {
      icon: "mdi:sprinkler-variant",
      friendly_name: "Smart Irrigation Irrigate all zones",
    }),
    entity("schedule.irrigation_window", "off", {
      friendly_name: "Irrigation window",
      next_event: s.nextRunIso,
    }),
    // A decoy: same suffix as the integration's all-zones button, no shared
    // prefix with any zone sensor. Discovery must not adopt it.
    entity("button.patio_misters_irrigate_all", "unknown", { friendly_name: "Patio misters irrigate all" }),
  ];

  for (const zone of s.zones) {
    const p = `smart_irrigation_${zone.slug}`;
    const duration = durationFor(zone);
    const { etDeficiency, etValue } = etFor(zone);

    out.push(
      entity(`sensor.${p}`, String(duration), {
        id: zone.zoneId,
        size: zone.size,
        size_unit: "m<sup>2</sup>",
        throughput: zone.throughput,
        throughput_unit: "l/m",
        drainage_rate: zone.drainageRate,
        drainage_rate_unit: "mm/h",
        current_drainage: zone.currentDrainage,
        current_drainage_unit: "mm",
        maximum_bucket: zone.maximumBucket,
        maximum_bucket_unit: "mm",
        multiplier: zone.multiplier,
        lead_time: zone.leadTime,
        maximum_duration: zone.maximumDuration,
        state: zone.mode,
        bucket: zone.bucket,
        bucket_unit: "mm",
        last_updated: zone.lastCalculated,
        last_calculated: zone.lastCalculated,
        number_of_data_points: zone.dataPoints,
        et_value: etValue,
        et_value_unit: "mm",
        et_deficiency: etDeficiency,
        et_deficiency_unit: "mm",
        eto: zone.eto,
        eto_unit: "mm",
        unit_of_measurement: "s",
        device_class: "duration",
        icon: "mdi:sprinkler",
        friendly_name: `${zone.name} Duration`,
      }),
      entity(`sensor.${p}_bucket`, zone.bucket.toFixed(2), {
        state_class: "measurement",
        zone_id: zone.zoneId,
        unit_of_measurement: "mm",
        friendly_name: `${zone.name} Bucket`,
      }),
      entity(`sensor.${p}_et_value`, etValue.toFixed(2), {
        state_class: "measurement",
        zone_id: zone.zoneId,
        unit_of_measurement: "mm",
        friendly_name: `${zone.name} Applied ET`,
      }),
      entity(`sensor.${p}_et_deficiency`, etDeficiency.toFixed(2), {
        state_class: "measurement",
        zone_id: zone.zoneId,
        unit_of_measurement: "mm",
        friendly_name: `${zone.name} Daily ET deficiency`,
      }),
      entity(`sensor.${p}_current_drainage`, String(zone.currentDrainage), {
        state_class: "measurement",
        zone_id: zone.zoneId,
        unit_of_measurement: "mm",
        friendly_name: `${zone.name} Current drainage`,
      }),
      entity(`sensor.${p}_last_irrigation`, zone.lastIrrigationIso, {
        zone_id: zone.zoneId,
        device_class: "timestamp",
        icon: "mdi:history",
        friendly_name: `${zone.name} Last irrigation`,
      }),
      entity(`sensor.${p}_water_used`, zone.waterUsed.toFixed(1), {
        state_class: "total_increasing",
        zone_id: zone.zoneId,
        unit_of_measurement: "L",
        device_class: "water",
        icon: "mdi:water",
        friendly_name: `${zone.name} Water used`,
      }),
      entity(`number.${p}_multiplier`, zone.multiplier.toFixed(1), {
        min: 0,
        max: 10,
        step: 0.1,
        mode: "box",
        zone_id: zone.zoneId,
        icon: "mdi:multiplication",
        friendly_name: `${zone.name} Multiplier`,
      }),
      entity(`button.${p}_calculate`, "unknown", {
        zone_id: zone.zoneId,
        icon: "mdi:calculator",
        friendly_name: `${zone.name} Calculate`,
      }),
      entity(`button.${p}_reset_bucket`, "unknown", {
        zone_id: zone.zoneId,
        icon: "mdi:bucket-outline",
        friendly_name: `${zone.name} Reset bucket`,
      }),
      entity(`button.${p}_reset_usage`, "unknown", {
        zone_id: zone.zoneId,
        icon: "mdi:restart",
        friendly_name: `${zone.name} Reset water usage`,
      }),
      entity(`button.${p}_irrigate_now`, "unknown", {
        zone_id: zone.zoneId,
        icon: "mdi:sprinkler",
        friendly_name: `${zone.name} Irrigate now`,
      }),
      entity(`binary_sensor.${p}_irrigation_needed`, zone.bucket < 0 ? "on" : "off", {
        zone_id: zone.zoneId,
        icon: "mdi:water-alert",
        friendly_name: `${zone.name} Irrigation needed`,
      }),
      entity(`binary_sensor.${p}_watering_now`, zone.wateringNow ? "on" : "off", {
        zone_id: zone.zoneId,
        device_class: "running",
        icon: "mdi:sprinkler-variant",
        friendly_name: `${zone.name} Watering now`,
      }),
      entity(`binary_sensor.${p}_problem`, zone.problem ? "on" : "off", {
        zone_id: zone.zoneId,
        reason: zone.problem,
        device_class: "problem",
        icon: "mdi:alert-circle-outline",
        friendly_name: `${zone.name} Problem`,
      })
    );
  }

  return out;
}
