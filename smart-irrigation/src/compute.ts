import { HassEntity, HomeAssistant, SmartIrrigationCardConfig } from "./types";

const UNKNOWN_STATES = new Set(["unknown", "unavailable"]);

function isUnknown(state: unknown): boolean {
  return state == null || UNKNOWN_STATES.has(String(state).toLowerCase());
}

function isBoolOn(state: unknown): boolean {
  const l = String(state ?? "").toLowerCase();
  return l === "on" || l === "true";
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (isUnknown(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/* ------------------------------------------------------------- discovery */

/** Every entity the Smart Irrigation integration creates for one zone. Only
 * `main` is required — it carries the whole bucket model in its attributes,
 * so a zone still draws completely when the satellites are missing. */
export interface ZoneEntities {
  zoneId: number;
  /** sensor.* — run duration in seconds, plus every zone attribute. */
  main: string;
  /** The satellites. Present when discovery found them; each one is used
   * only for what the main sensor's attributes can't give: a service to
   * call, or an entity id to open a history graph for. */
  bucket?: string;
  etValue?: string;
  etDeficiency?: string;
  currentDrainage?: string;
  lastIrrigation?: string;
  waterUsed?: string;
  irrigationNeeded?: string;
  wateringNow?: string;
  problem?: string;
  multiplier?: string;
  calculate?: string;
  irrigateNow?: string;
  resetBucket?: string;
  resetUsage?: string;
}

/** The integration's three zone-independent service buttons. */
export interface GlobalEntities {
  refreshWeather?: string;
  calculateAll?: string;
  irrigateAll?: string;
}

export interface Discovery {
  zones: ZoneEntities[];
  globals: GlobalEntities;
}

function objectId(entityId: string): string {
  const dot = entityId.indexOf(".");
  return dot === -1 ? entityId : entityId.slice(dot + 1);
}

function domainOf(entityId: string): string {
  const dot = entityId.indexOf(".");
  return dot === -1 ? "" : entityId.slice(0, dot);
}

/** The zone keys that hold a satellite entity id — everything except the
 * zone's number and its main sensor, which discovery fills in first. */
type ZoneEntityKey = Exclude<keyof ZoneEntities, "zoneId" | "main">;

/** Buttons carry nothing in their attributes that says what they do, so they
 * are the one part of discovery that has to match names. Entity-id suffix
 * first, then the integration's own icon as a fallback for a renamed
 * entity. */
const ZONE_BUTTONS: ReadonlyArray<readonly [ZoneEntityKey, string, string]> = [
  ["irrigateNow", "_irrigate_now", "mdi:sprinkler"],
  ["calculate", "_calculate", "mdi:calculator"],
  ["resetBucket", "_reset_bucket", "mdi:bucket-outline"],
  ["resetUsage", "_reset_usage", "mdi:restart"],
];

/** Sensors whose value the card reads off the main sensor's attributes, but
 * whose entity id is still worth having: tapping the row opens HA's history
 * graph for it, which is the actual answer to "how has this been going". */
const ZONE_SENSOR_SUFFIXES: ReadonlyArray<readonly [ZoneEntityKey, string]> = [
  ["bucket", "_bucket"],
  ["etValue", "_et_value"],
  ["etDeficiency", "_et_deficiency"],
  ["currentDrainage", "_current_drainage"],
];

const GLOBAL_BUTTONS: ReadonlyArray<readonly [keyof GlobalEntities, string, string]> = [
  ["refreshWeather", "_update_weather", "mdi:weather-cloudy-arrow-right"],
  ["calculateAll", "_calculate_all", "mdi:calculator-variant"],
  ["irrigateAll", "_irrigate_all", "mdi:sprinkler-variant"],
];

/** How many leading underscore-separated tokens two object ids share. Used to
 * tie the global buttons to the zones they belong to without hardcoding the
 * string "smart_irrigation": both sides keep the integration's prefix even
 * when its entities have been renamed, as long as they were renamed
 * consistently. */
function sharedPrefixTokens(a: string, b: string): number {
  const x = a.split("_");
  const y = b.split("_");
  let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n]) n++;
  return n;
}

/**
 * Finds the integration's zones and their entities in `hass.states`.
 *
 * Grouping is by the zone id the entities carry in their own attributes, not
 * by entity-id string matching, so renaming an entity in HA doesn't hide it
 * from the card. Within a zone, sensors and binary sensors are told apart by
 * `device_class` — also rename-proof. Only the buttons need name matching,
 * because a button's attributes say nothing about what pressing it does.
 */
export function discover(hass: HomeAssistant): Discovery {
  const zonesById = new Map<number, ZoneEntities>();

  // Pass 1: the main sensors. `maximum_bucket` is the tell — it's the only
  // entity per zone that carries the bucket model, and the zone id it spells
  // `id` rather than `zone_id`.
  for (const entity of Object.values(hass.states)) {
    if (domainOf(entity.entity_id) !== "sensor") continue;
    const a = entity.attributes;
    if (a.maximum_bucket === undefined || typeof a.id !== "number") continue;
    zonesById.set(a.id, { zoneId: a.id, main: entity.entity_id });
  }

  // Pass 2: everything else that names a zone we found.
  for (const entity of Object.values(hass.states)) {
    const a = entity.attributes;
    if (typeof a.zone_id !== "number") continue;
    const zone = zonesById.get(a.zone_id);
    if (zone === undefined) continue;

    const id = entity.entity_id;
    const oid = objectId(id);
    switch (domainOf(id)) {
      case "sensor": {
        if (a.device_class === "timestamp") zone.lastIrrigation = id;
        else if (a.device_class === "water") zone.waterUsed = id;
        else {
          const hit = ZONE_SENSOR_SUFFIXES.find(([, suffix]) => oid.endsWith(suffix));
          if (hit) zone[hit[0]] = id;
        }
        break;
      }
      case "binary_sensor": {
        // running/problem are declared; "irrigation needed" has no device
        // class of its own, so it's what's left over.
        if (a.device_class === "running") zone.wateringNow = id;
        else if (a.device_class === "problem") zone.problem = id;
        else if (zone.irrigationNeeded === undefined) zone.irrigationNeeded = id;
        break;
      }
      case "number": {
        if (zone.multiplier === undefined) zone.multiplier = id;
        break;
      }
      case "button": {
        const hit =
          ZONE_BUTTONS.find(([, suffix]) => oid.endsWith(suffix)) ??
          ZONE_BUTTONS.find(([, , icon]) => a.icon === icon);
        if (hit) zone[hit[0]] = id;
        break;
      }
      default:
        break;
    }
  }

  const zones = [...zonesById.values()].sort((a, b) => a.zoneId - b.zoneId);

  // The global buttons carry no zone id, so they're matched by name and then
  // required to share the integration prefix with a zone we already found —
  // which is what stops an unrelated `button.sprinklers_irrigate_all`
  // elsewhere in the house from being adopted.
  const globals: GlobalEntities = {};
  const zoneObjectIds = zones.map((z) => objectId(z.main));
  for (const entity of Object.values(hass.states)) {
    const id = entity.entity_id;
    if (domainOf(id) !== "button") continue;
    if (typeof entity.attributes.zone_id === "number") continue;
    const oid = objectId(id);
    const hit =
      GLOBAL_BUTTONS.find(([, suffix]) => oid.endsWith(suffix)) ??
      GLOBAL_BUTTONS.find(([, , icon]) => entity.attributes.icon === icon);
    if (!hit || globals[hit[0]] !== undefined) continue;
    if (!zoneObjectIds.some((zoneOid) => sharedPrefixTokens(zoneOid, oid) >= 2)) continue;
    globals[hit[0]] = id;
  }

  return { zones, globals };
}

/* ------------------------------------------------------------ formatting */

/** The integration reports zone area as the HTML string "m<sup>2</sup>".
 * Nothing on this card renders unsanitised HTML, so units are translated to
 * real characters instead — and any other tagged unit degrades to its text
 * rather than showing markup. */
export function formatUnit(unit: unknown): string {
  const raw = String(unit ?? "").trim();
  if (raw === "") return "";
  return raw
    .replace(/<sup>2<\/sup>/gi, "²")
    .replace(/<sup>3<\/sup>/gi, "³")
    .replace(/<[^>]*>/g, "");
}

/** mm values, at the one decimal the bucket model is meaningful to. A bucket
 * of 0.001mm is 0.0 and should read that way — it is field capacity. */
function formatMm(value: number | null): string | null {
  if (value == null) return null;
  // -0.04 would otherwise print as "-0.0 mm", which reads as a deficit that
  // isn't there.
  const rounded = Math.round(value * 10) / 10;
  return `${(rounded === 0 ? 0 : rounded).toFixed(1)} mm`;
}

/** Runtime, as the two largest useful units. Seconds matter at the short end
 * — a 45-second run is a real setting — and stop mattering past an hour. */
export function formatDuration(seconds: number | null): string | null {
  if (seconds == null || seconds < 0) return null;
  const total = Math.round(seconds);
  if (total < 60) return `${total} s`;
  if (total < 3600) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return s === 0 ? `${m} min` : `${m} min ${s} s`;
  }
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** The integration writes `last_calculated` / `last_updated` as
 * "YYYY-MM-DD HH:MM:SS" with no timezone. The space form is not in the
 * ECMAScript date grammar (engines accept it by convention), so it's
 * normalised to the "T" form, which is specified — and specified as local
 * time, which is what the integration means. */
function parseDate(raw: unknown): Date | null {
  if (isUnknown(raw)) return null;
  const text = String(raw).trim();
  const d = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(text) ? text.replace(" ", "T") : text);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "14 h ago" / "in 9 h". Coarse on purpose: this card is checked in on, not
 * watched, so minute-accurate ages would only be noise. */
export function formatRelative(date: Date | null, now: Date): string | null {
  if (!date) return null;
  const deltaMs = date.getTime() - now.getTime();
  const future = deltaMs > 0;
  const minutes = Math.round(Math.abs(deltaMs) / 60_000);
  const say = (text: string): string => (future ? `in ${text}` : `${text} ago`);
  if (minutes < 1) return future ? "any moment" : "just now";
  if (minutes < 60) return say(`${minutes} min`);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return say(`${hours} h`);
  // Floor, not round: "2 days ago" has to mean at least two days have
  // passed. Rounding put 38 hours at "2 days ago" next to a date formatted
  // as "Yesterday", which is a contradiction the reader has to resolve.
  const days = Math.floor(hours / 24);
  return say(days === 1 ? "1 day" : `${days} days`);
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** "Today 04:00" / "Tomorrow 04:00" / "Wed 04:00" — the calendar day matters
 * for a schedule, and a bare clock time doesn't say which one. */
export function formatDayTime(date: Date | null, now: Date): string | null {
  if (!date) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000);
  const time = formatClock(date);
  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Tomorrow ${time}`;
  if (dayDiff === -1) return `Yesterday ${time}`;
  return `${date.toLocaleDateString([], { weekday: "short" })} ${time}`;
}

/** The friendly name of a zone's main sensor is "<zone> Duration". Trimming
 * the suffix gives the zone's own name; if the integration ever stops
 * appending it, the name simply reads as it always did. */
function zoneName(entity: HassEntity | undefined, fallback: string): string {
  const friendly = entity?.attributes.friendly_name;
  if (typeof friendly === "string" && friendly.trim() !== "") {
    return friendly.replace(/\s+duration$/i, "").trim() || friendly;
  }
  return fallback;
}

/* ------------------------------------------------------------ zone values */

export type ZoneMode = "automatic" | "manual" | "disabled" | null;
export type Verdict = "watering" | "disabled" | "needs-water" | "ok" | "unknown";

export interface ZoneVals {
  entities: ZoneEntities;
  name: string;
  /** False when the main sensor is gone or unavailable — the tile then says
   * so instead of drawing a gauge full of dashes. */
  available: boolean;

  mode: ZoneMode;
  modeLabel: string | null;

  bucket: number | null;
  bucketText: string | null;
  maximumBucket: number | null;
  /** Top of the gauge's surplus band, in mm — always the zone's own
   * maximum_bucket. */
  maximumBucketText: string | null;
  /** mm of deficit that fills the sump. */
  deficitScale: number;
  deficitScaleText: string;
  /** Percentages of the vessel's height, ready for the gauge's inline
   * custom properties: where the zero line sits, and how far each fill
   * reaches from it. */
  zeroPercent: number;
  surplusPercent: number;
  deficitPercent: number;
  /** The deficit runs past the drawn scale, so the sump is full and the
   * gauge shows a marker rather than pretending it isn't. */
  deficitBeyondScale: boolean;

  verdict: Verdict;
  verdictLabel: string;
  durationSeconds: number | null;
  durationText: string | null;
  /** Litres the calculated run would deliver, from duration and throughput.
   * Null when there's no run or no throughput to work from. */
  litresText: string | null;
  /** The calculated run hit the zone's maximum_duration and was clipped. */
  capped: boolean;
  /** The cap itself, so "capped" can say what it was capped to. */
  maxDurationText: string | null;

  problem: boolean;
  problemReason: string | null;

  lastIrrigation: Date | null;
  lastIrrigationText: string | null;
  lastIrrigationRelative: string | null;
  waterUsedText: string | null;

  multiplier: number | null;
  multiplierText: string | null;
  multiplierMin: number;
  multiplierMax: number;
  multiplierStep: number;

  etValueText: string | null;
  etDeficiencyText: string | null;
  etoText: string | null;
  drainageText: string | null;
  lastCalculatedRelative: string | null;
  dataPoints: number | null;
  sizeText: string | null;
  throughputText: string | null;
}

function computeZone(
  hass: HomeAssistant,
  config: SmartIrrigationCardConfig,
  entities: ZoneEntities,
  now: Date
): ZoneVals {
  const get = (id?: string): HassEntity | undefined => (id ? hass.states[id] : undefined);
  const main = get(entities.main);
  const a = main?.attributes ?? {};

  const available = main !== undefined && !isUnknown(main.state);

  const rawMode = typeof a.state === "string" ? a.state.toLowerCase() : null;
  const mode: ZoneMode =
    rawMode === "automatic" || rawMode === "manual" || rawMode === "disabled" ? rawMode : null;

  const bucket = num(a.bucket);
  const maximumBucketRaw = num(a.maximum_bucket);
  // A zone with no usable cap still has to draw: fall back to a 10mm scale so
  // the gauge stays a gauge rather than dividing by zero.
  const maximumBucket = maximumBucketRaw != null && maximumBucketRaw > 0 ? maximumBucketRaw : null;
  const surplusTop = maximumBucket ?? 10;

  const configuredDeficit = num(config.deficit_scale);
  const deficitScale =
    configuredDeficit != null && configuredDeficit > 0 ? configuredDeficit : Math.max(surplusTop / 4, 1);

  // The gauge is driven by the bucket rounded to the precision it is printed
  // at, not by the raw value, so the drawing and the number agree by
  // construction. A real zone at field capacity reports something like
  // 0.00104mm: it prints as "0.0 mm", and without this it would still draw a
  // fill — a 7px wavy water surface sitting on the zero line, showing water
  // the reading beside it says isn't there.
  const drawnBucket = bucket != null ? Math.round(bucket * 10) / 10 : null;

  // The zero line divides the vessel in proportion to the two bands it
  // separates, so a mm is the same number of pixels above and below it.
  const zeroPercent = (surplusTop / (surplusTop + deficitScale)) * 100;
  const surplusPercent =
    drawnBucket != null && drawnBucket > 0 ? clamp(drawnBucket / surplusTop, 0, 1) * zeroPercent : 0;
  const deficitPercent =
    drawnBucket != null && drawnBucket < 0 ? clamp(-drawnBucket / deficitScale, 0, 1) * (100 - zeroPercent) : 0;

  const durationSeconds = available ? num(main?.state) : null;
  const maximumDuration = num(a.maximum_duration);
  const leadTime = num(a.lead_time) ?? 0;
  const throughput = num(a.throughput);

  const wateringNow = isBoolOn(get(entities.wateringNow)?.state);
  const needsWater =
    isBoolOn(get(entities.irrigationNeeded)?.state) || (durationSeconds != null && durationSeconds > 0);

  // "Watering now" outranks "disabled": a disabled zone can still be run by
  // hand, and what it is doing right now beats what it is set to do. Below
  // that, a disabled zone's bucket is still drawn — the deficit is real and
  // worth seeing — but calling it "needs water" would promise a run that the
  // integration is not going to schedule.
  const verdict: Verdict = !available
    ? "unknown"
    : wateringNow
      ? "watering"
      : mode === "disabled"
        ? "disabled"
        : needsWater
          ? "needs-water"
          : "ok";
  const verdictLabel =
    verdict === "watering"
      ? "Watering now"
      : verdict === "disabled"
        ? "Zone disabled"
        : verdict === "needs-water"
          ? "Needs water"
          : verdict === "ok"
            ? "No water needed"
            : "Unavailable";

  // Lead time is the valve opening, not water on the ground, so it comes off
  // the estimate. Throughput is litres per minute for the whole zone.
  const litres =
    durationSeconds != null && durationSeconds > 0 && throughput != null && throughput > 0
      ? (Math.max(0, durationSeconds - leadTime) / 60) * throughput
      : null;

  const problemEntity = get(entities.problem);
  const problemReason = problemEntity?.attributes.reason;
  const multiplierEntity = get(entities.multiplier);
  // The number.* entity is authoritative when it exists (it's what the
  // stepper writes to); the attribute is the fallback for a zone whose
  // number entity is hidden or missing.
  const multiplier = num(multiplierEntity?.state) ?? num(a.multiplier);

  const waterUsed = num(get(entities.waterUsed)?.state);
  const waterUsedUnit = formatUnit(get(entities.waterUsed)?.attributes.unit_of_measurement) || "L";
  const lastIrrigation = parseDate(get(entities.lastIrrigation)?.state);

  const size = num(a.size);
  const sizeUnit = formatUnit(a.size_unit);
  const throughputUnit = formatUnit(a.throughput_unit);
  const drainage = num(a.current_drainage);
  const drainageRate = num(a.drainage_rate);
  const drainageUnit = formatUnit(a.current_drainage_unit) || "mm";
  const drainageRateUnit = formatUnit(a.drainage_rate_unit) || "mm/h";

  return {
    entities,
    name: zoneName(main, `Zone ${entities.zoneId}`),
    available,

    mode,
    modeLabel: mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : null,

    bucket,
    bucketText: formatMm(bucket),
    maximumBucket,
    maximumBucketText: formatMm(maximumBucket),
    deficitScale,
    deficitScaleText: formatMm(-deficitScale) ?? "",
    zeroPercent,
    surplusPercent,
    deficitPercent,
    deficitBeyondScale: drawnBucket != null && -drawnBucket > deficitScale,

    verdict,
    verdictLabel,
    durationSeconds,
    durationText: durationSeconds != null && durationSeconds > 0 ? formatDuration(durationSeconds) : null,
    litresText: litres != null ? `≈ ${Math.round(litres)} L` : null,
    capped:
      durationSeconds != null && maximumDuration != null && maximumDuration > 0 && durationSeconds >= maximumDuration,
    maxDurationText: formatDuration(maximumDuration),

    problem: isBoolOn(problemEntity?.state),
    problemReason: typeof problemReason === "string" && problemReason.trim() !== "" ? problemReason : null,

    lastIrrigation,
    lastIrrigationText: formatDayTime(lastIrrigation, now),
    lastIrrigationRelative: formatRelative(lastIrrigation, now),
    waterUsedText: waterUsed != null ? `${Math.round(waterUsed)} ${waterUsedUnit}` : null,

    multiplier,
    multiplierText: multiplier != null ? `×${multiplier.toFixed(1)}` : null,
    multiplierMin: num(multiplierEntity?.attributes.min) ?? 0,
    multiplierMax: num(multiplierEntity?.attributes.max) ?? 10,
    multiplierStep: num(multiplierEntity?.attributes.step) ?? 0.1,

    etValueText: formatMm(num(a.et_value)),
    etDeficiencyText: formatMm(num(a.et_deficiency)),
    etoText: formatMm(num(a.eto)),
    drainageText:
      drainage != null
        ? `${drainage.toFixed(1)} ${drainageUnit}${drainageRate != null ? ` · ${drainageRate} ${drainageRateUnit}` : ""}`
        : null,
    lastCalculatedRelative: formatRelative(parseDate(a.last_calculated), now),
    dataPoints: num(a.number_of_data_points),
    sizeText: size != null ? `${size} ${sizeUnit}`.trim() : null,
    throughputText: throughput != null ? `${throughput} ${throughputUnit}`.trim() : null,
  };
}

/* ------------------------------------------------------------ card values */

export interface CardVals {
  zones: ZoneVals[];
  globals: GlobalEntities;
  /** No zone resolved at all — the card says how to fix that rather than
   * rendering an empty shell. */
  empty: boolean;

  /** Any zone dry, or any zone running: what the header icon reflects. */
  active: boolean;
  anyWatering: boolean;
  needCount: number;
  /** Header supporting line: what the zones add up to right now. */
  summary: string;

  nextRun: Date | null;
  nextRunText: string | null;
  nextRunRelative: string | null;
  /** The configured schedule entity had no usable time in it, so its raw
   * state is shown instead of a silent dash. */
  nextRunRaw: string | null;

  lastRun: Date | null;
  lastRunText: string | null;
  lastRunRelative: string | null;
  /** Which zone the card-level "last run" came from — only worth saying
   * when there's more than one zone to have come from. */
  lastRunZone: string | null;

  problems: Array<{ name: string; reason: string | null }>;
}

/** The next occurrence of a bare time of day — today if it is still ahead,
 * tomorrow otherwise. A time-only `input_datetime` reports "04:00:00" with no
 * date at all, which is a daily schedule rather than an unparseable value,
 * and is a likely thing to point this card at. */
function nextOccurrenceOfTime(raw: string, now: Date): Date | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(raw.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, seconds, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

/** The next run, from whatever the user pointed the card at: a `schedule.*`
 * helper (which publishes `next_event`), an entity whose state is a full
 * timestamp, or a time-only helper. The integration schedules nothing
 * itself, so there is nothing to discover here — this is the one thing the
 * card can't find on its own. */
function computeNextRun(entity: HassEntity | undefined, now: Date): { date: Date | null; raw: string | null } {
  if (!entity) return { date: null, raw: null };
  const fromAttribute = parseDate(entity.attributes.next_event);
  if (fromAttribute) return { date: fromAttribute, raw: null };
  if (isUnknown(entity.state)) return { date: null, raw: null };
  const fromState = parseDate(entity.state);
  if (fromState) return { date: fromState, raw: null };
  const fromTimeOfDay = nextOccurrenceOfTime(entity.state, now);
  if (fromTimeOfDay) return { date: fromTimeOfDay, raw: null };
  // Not a time in any shape the card understands. Its raw state is shown
  // rather than a silent dash, so a wrongly-wired entity is visible.
  return { date: null, raw: entity.state };
}

export function computeVals(
  hass: HomeAssistant,
  config: SmartIrrigationCardConfig,
  discovery: Discovery,
  now: Date
): CardVals {
  // An explicit `zones` list selects and orders; without one, every zone
  // discovery found. A configured id that no longer resolves is dropped
  // rather than rendered as a broken tile.
  const selected =
    config.zones && config.zones.length > 0
      ? config.zones
          .map((id) => discovery.zones.find((z) => z.main === id))
          .filter((z): z is ZoneEntities => z !== undefined)
      : discovery.zones;

  const zones = selected.map((entities) => computeZone(hass, config, entities, now));

  const globals: GlobalEntities = {
    refreshWeather: config.refresh_weather ?? discovery.globals.refreshWeather,
    calculateAll: config.calculate_all ?? discovery.globals.calculateAll,
    irrigateAll: config.irrigate_all ?? discovery.globals.irrigateAll,
  };

  const anyWatering = zones.some((z) => z.verdict === "watering");
  const needCount = zones.filter((z) => z.verdict === "needs-water").length;

  const withLast = zones.filter((z) => z.lastIrrigation !== null);
  withLast.sort((a, b) => b.lastIrrigation!.getTime() - a.lastIrrigation!.getTime());
  const mostRecent = withLast[0];

  const { date: nextRun, raw: nextRunRaw } = computeNextRun(
    config.next_schedule ? hass.states[config.next_schedule] : undefined,
    now
  );

  // With one zone — the shape the integration most often ends up in — the
  // verdict beside that zone's gauge already says whether it needs water, so
  // repeating it here would spend the card's only summary line on something
  // already on screen. What is *not* visible anywhere on the front surface is
  // how current the numbers are, which is exactly what you want to know when
  // you check in after a few days away. With more than one zone the count is
  // the thing no single tile can tell you, so it wins.
  const single = zones.length === 1;
  const freshness = single && zones[0].lastCalculatedRelative ? `Calculated ${zones[0].lastCalculatedRelative}` : null;
  const status = anyWatering
    ? single
      ? "Watering now"
      : `Watering now · ${zones.length} zones`
    : needCount > 0
      ? single
        ? "Needs water"
        : `${needCount} of ${zones.length} zones need water`
      : single
        ? "No water needed"
        : `${zones.length} zones · all at capacity`;
  const summary = freshness ?? status;

  return {
    zones,
    globals,
    empty: zones.length === 0,

    active: anyWatering || needCount > 0,
    anyWatering,
    needCount,
    summary,

    nextRun,
    nextRunText: formatDayTime(nextRun, now),
    nextRunRelative: formatRelative(nextRun, now),
    nextRunRaw,

    lastRun: mostRecent?.lastIrrigation ?? null,
    lastRunText: mostRecent ? formatDayTime(mostRecent.lastIrrigation, now) : null,
    lastRunRelative: mostRecent ? formatRelative(mostRecent.lastIrrigation, now) : null,
    lastRunZone: mostRecent && zones.length > 1 ? mostRecent.name : null,

    problems: zones.filter((z) => z.problem).map((z) => ({ name: z.name, reason: z.problemReason })),
  };
}
