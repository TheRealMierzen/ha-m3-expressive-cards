import { HomeAssistant } from "./types";

/**
 * The two things the integration knows and no entity carries.
 *
 * ## Next irrigation start
 *
 * The integration exposes no entity for this — it is computed on demand and
 * served over the `smart_irrigation/info` websocket command, which is what
 * feeds the **Info -> Next irrigation -> Next start** card in the
 * integration's own panel. Asking it directly is what makes the card's answer
 * the *same* answer: the resolved start trigger rather than an assumed
 * sunrise, the trigger's offset, sunset where that is what was selected, and
 * any remaining days-between-irrigation skip days.
 *
 * Verified against the integration at v2026.9.0
 * (`custom_components/smart_irrigation/websockets.py`,
 * `websocket_get_irrigation_info`), whose reply carries:
 *
 *     next_irrigation_start     ISO datetime, or null
 *     next_irrigation_duration  seconds, summed over every enabled zone
 *     next_irrigation_zones     names of the zones that need water
 *     irrigation_reason         plain text
 *     sunrise_time              ISO datetime, or null
 *     total_irrigation_duration seconds, same value as the duration above
 *     irrigation_explanation    text, and it can contain <br/> markup
 *
 * Only the first four are read. `irrigation_explanation` is deliberately not:
 * it is the one field that arrives as markup, nothing on this card renders
 * unsanitised HTML, and the per-zone figures say the same thing in numbers.
 *
 * ## Allowed depletion
 *
 * Each zone's `irrigation_threshold` — the deficit the integration lets build
 * up before it produces a run at all — is the single most important number
 * for reading a bucket, and it is in none of the zone's entities or their
 * attributes. It lives only in the integration's own store, which the
 * `smart_irrigation/zones` websocket command publishes (the same command the
 * integration's Zones panel is built on).
 *
 * Without it the card cannot tell a zone that is quietly drying down from one
 * the integration is about to water, which is exactly the distinction the
 * verdict has to make: `binary_sensor.*_irrigation_needed` is a bare
 * `bucket < 0` and ignores the threshold entirely, so it turns on at the first
 * calculation after a run and stays on for the whole dry-down.
 */
export interface IrrigationInfo {
  nextStart: Date | null;
  /** Seconds, summed over every enabled zone. Zero when nothing needs water. */
  durationSeconds: number | null;
  /** Names of the zones that will run. */
  zones: string[];
  reason: string | null;
  /** Zone id -> allowed depletion, in that zone's own depth unit (mm on a
   * metric install, inches on an imperial one — the same unit as `bucket`, so
   * the two compare directly and neither needs converting). Only thresholds
   * above zero are kept: zero is the integration's default and means "water
   * as soon as anything at all is missing", which is an absent threshold
   * rather than a threshold of nothing. */
  thresholds: Record<number, number>;
}

/** Shape of the reply, as far as this card cares. Every field is checked
 * rather than trusted: this is another component's payload, and an older
 * install may not send all of it. */
interface InfoReply {
  next_irrigation_start?: string | null;
  next_irrigation_duration?: number | null;
  next_irrigation_zones?: unknown;
  irrigation_reason?: string | null;
}

/** One entry of the `smart_irrigation/zones` reply. It carries the zone's
 * whole stored config; these are the only two fields read. */
interface ZoneReply {
  id?: unknown;
  irrigation_threshold?: unknown;
}

/** The integration writes its fallback path with a naive local datetime and
 * its normal path with an offset-aware one, so both shapes have to parse. A
 * date-time with no offset is local time per the ECMAScript grammar, which is
 * what the integration means by it. */
function parseIsoDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The allowed depletion of every zone the integration has, keyed by zone id.
 * Empty for any reason the command doesn't answer — the card then falls back
 * to estimating a watering point, which is also what it does for the (very
 * common) zone whose threshold is the default zero. */
async function fetchZoneThresholds(hass: HomeAssistant): Promise<Record<number, number>> {
  let reply: ZoneReply[];
  try {
    reply = await hass.callWS!<ZoneReply[]>({ type: "smart_irrigation/zones" });
  } catch {
    return {};
  }
  if (!Array.isArray(reply)) return {};
  const out: Record<number, number> = {};
  for (const zone of reply) {
    if (!zone || typeof zone !== "object") continue;
    const id = num(zone.id);
    const threshold = num(zone.irrigation_threshold);
    if (id != null && threshold != null && threshold > 0) out[id] = threshold;
  }
  return out;
}

/**
 * Asks the integration for its next start and its zones' allowed depletions.
 *
 * Resolves to `null` rather than throwing for every reason it might not answer
 * — no websocket connection, an install predating the command, the
 * integration not loaded — because none of those is an error the card should
 * shout about. The next-run tile just isn't drawn, exactly as it isn't when
 * nothing is configured.
 *
 * The two commands are asked together and fail independently: `/zones` has
 * existed far longer than `/info`, so an install that can't answer one can
 * still answer the other, and the thresholds are worth having on their own.
 */
export async function fetchIrrigationInfo(hass: HomeAssistant): Promise<IrrigationInfo | null> {
  if (typeof hass.callWS !== "function") return null;
  const [reply, thresholds] = await Promise.all([
    hass.callWS<InfoReply>({ type: "smart_irrigation/info" }).catch(() => null),
    fetchZoneThresholds(hass),
  ]);
  if (!reply || typeof reply !== "object") {
    // No next start, but the thresholds still change how every zone reads.
    return { nextStart: null, durationSeconds: null, zones: [], reason: null, thresholds };
  }

  const duration = typeof reply.next_irrigation_duration === "number" ? reply.next_irrigation_duration : null;
  const zones = Array.isArray(reply.next_irrigation_zones)
    ? reply.next_irrigation_zones.filter((z): z is string => typeof z === "string" && z.trim() !== "")
    : [];
  const reason =
    typeof reply.irrigation_reason === "string" && reply.irrigation_reason.trim() !== ""
      ? reply.irrigation_reason.trim()
      : null;

  return {
    nextStart: parseIsoDate(reply.next_irrigation_start),
    durationSeconds: duration != null && Number.isFinite(duration) && duration >= 0 ? duration : null,
    zones,
    reason,
    thresholds,
  };
}
