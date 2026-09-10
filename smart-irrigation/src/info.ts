import { HomeAssistant } from "./types";

/**
 * Smart Irrigation's next irrigation start, from the integration itself.
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
 */
export interface IrrigationInfo {
  nextStart: Date | null;
  /** Seconds, summed over every enabled zone. Zero when nothing needs water. */
  durationSeconds: number | null;
  /** Names of the zones that will run. */
  zones: string[];
  reason: string | null;
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

/** The integration writes its fallback path with a naive local datetime and
 * its normal path with an offset-aware one, so both shapes have to parse. A
 * date-time with no offset is local time per the ECMAScript grammar, which is
 * what the integration means by it. */
function parseIsoDate(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const d = new Date(raw.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Asks the integration for its next start. Resolves to `null` rather than
 * throwing for every reason it might not answer — no websocket connection, an
 * install predating the command, the integration not loaded — because none of
 * those is an error the card should shout about. The next-run tile just isn't
 * drawn, exactly as it isn't when nothing is configured.
 */
export async function fetchIrrigationInfo(hass: HomeAssistant): Promise<IrrigationInfo | null> {
  if (typeof hass.callWS !== "function") return null;
  let reply: InfoReply;
  try {
    reply = await hass.callWS<InfoReply>({ type: "smart_irrigation/info" });
  } catch {
    return null;
  }
  if (!reply || typeof reply !== "object") return null;

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
  };
}
