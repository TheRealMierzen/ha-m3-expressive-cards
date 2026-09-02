import { HassEntity } from "../src/types";

export interface FixtureState {
  actual: number;
  target: number;
  monthlyCost: number;
}

function entity(id: string, state: string, extra: Partial<HassEntity["attributes"]> = {}): HassEntity {
  return {
    entity_id: id,
    state,
    attributes: { friendly_name: id, ...extra },
  };
}

/** Mirrors what the real automation/template sensors behind these entities
 * would compute — adherence %, daily cost, and money wasted are all
 * derived here from the three raw values a toolbar button actually edits,
 * matching how the card only ever displays pre-computed values. */
export function buildFixtureEntities(s: FixtureState): HassEntity[] {
  const dailyCost = s.monthlyCost / 30;
  const adherence = s.target > 0 ? Math.min(100, Math.round((s.actual / s.target) * 100)) : 0;
  const missed = Math.max(0, s.target - s.actual);
  const moneyWasted = missed * dailyCost;

  return [
    entity("counter.gym_actual_counter", String(s.actual)),
    entity("counter.gym_target_counter", String(s.target)),
    entity("sensor.gym_adherence", String(adherence), { unit_of_measurement: "%" }),
    entity("input_number.gym_monthly_cost", String(s.monthlyCost)),
    entity("number.gym_daily_cost", dailyCost.toFixed(2)),
    entity("number.gym_money_wasted", moneyWasted.toFixed(2)),
  ];
}
