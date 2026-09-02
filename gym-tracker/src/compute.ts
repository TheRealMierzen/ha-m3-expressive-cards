import { GymTrackerCardConfig, HomeAssistant } from "./types";

const UNKNOWN_STATES = new Set(["unknown", "unavailable"]);

function isUnknown(state: unknown): boolean {
  return state == null || UNKNOWN_STATES.has(String(state).toLowerCase());
}

function toNumber(state: unknown): number | null {
  if (isUnknown(state)) return null;
  const n = Number(state);
  return Number.isFinite(n) ? n : null;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/** Formats a cost figure as "R1,234.50" — no decimals when the value is a
 * whole number, two decimals otherwise. Returns "—" for unavailable
 * entities rather than "R—", so a missing sensor reads as missing. */
export function formatCurrency(value: number | null, currency: string): string {
  if (value == null) return "—";
  const rounded = Math.round(value * 100) / 100;
  const text = rounded.toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${currency}${text}`;
}

/** "unknown" is a real level, not a placeholder: with no adherence sensor
 * configured (or an unavailable one) the card must read as neutral rather
 * than as the worst case, since the ring, the leading icon and the settings
 * header all take their colour from this. */
export type AdherenceLevel = "good" | "ok" | "bad" | "unknown";

export interface ComputedGymVals {
  actual: number | null;
  target: number | null;
  visitsText: string;

  adherencePct: number | null;
  adherenceLevel: AdherenceLevel;
  /** The numeral alone, with no percent sign — the card sets the "%" as
   * its own smaller element so the figure itself can stay at display size
   * inside the ring. */
  adherenceValueText: string;

  monthlyCost: number | null;
  dailyCost: number | null;
  moneyWasted: number | null;
  /** Cost attributable to visits actually attended (actual × daily cost) —
   * the positive counterpart to moneyWasted, computed here rather than
   * read from its own entity since it's the same notional per-day cost
   * model applied the other way around. Framed as "invested" rather than
   * "spent" in the UI — same number, but "spent" reads as money gone
   * either way, while "invested" actually contrasts with "wasted". */
  moneyInvested: number | null;
}

/** Pure computation from (hass, config) -> display values. No `now` input —
 * unlike the timer/schedule cards in this family, nothing here is
 * time-dependent; every figure (adherence %, daily cost, money wasted) is
 * pre-computed upstream by HA and this card only formats and colors it. */
export function computeVals(hass: HomeAssistant, c: GymTrackerCardConfig): ComputedGymVals {
  const st = hass.states;
  const get = (id?: string) => (id ? st[id] : undefined);

  const actual = toNumber(get(c.actual_counter)?.state);
  const target = toNumber(get(c.target_counter)?.state);
  const visitsText =
    actual != null && target != null
      ? `${actual} / ${target} visits this year`
      : actual != null
        ? `${actual} visits this year`
        : "No visits logged yet";

  const adherenceRaw = toNumber(get(c.adherence_sensor)?.state);
  const adherencePct = adherenceRaw != null ? clamp(adherenceRaw, 0, 100) : null;
  const adherenceValueText = adherencePct != null ? String(Math.round(adherencePct)) : "—";

  const good = c.good_threshold ?? 80;
  const ok = c.ok_threshold ?? 50;
  let adherenceLevel: AdherenceLevel = "unknown";
  if (adherencePct != null) {
    adherenceLevel = adherencePct >= good ? "good" : adherencePct >= ok ? "ok" : "bad";
  }

  const monthlyCost = toNumber(get(c.monthly_cost_entity)?.state);
  const dailyCost = toNumber(get(c.daily_cost_entity)?.state);
  const moneyWasted = toNumber(get(c.money_wasted_entity)?.state);
  const moneyInvested = actual != null && dailyCost != null ? actual * dailyCost : null;

  return {
    actual,
    target,
    visitsText,
    adherencePct,
    adherenceLevel,
    adherenceValueText,
    monthlyCost,
    dailyCost,
    moneyWasted,
    moneyInvested,
  };
}
