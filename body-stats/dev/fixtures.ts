import { HassEntity } from "../src/types";

export interface FixtureState {
  sleepEfficiency: number;
  /** Snellen denominator (20 = 20/20) — lower is better. */
  eyesightLeft: number;
  eyesightRight: number;
  restingHr: number;
  bodyFat: number;
  visceralFat: number;
  muscleMass: number;
  boneMass: number;
  weight: number;
  bmi: number;
  water: number;
  protein: number;
  /** Simulates one sensor going unavailable without removing it from the
   * card's config — exercises the "entity configured but state unknown"
   * path, distinct from "never configured" (that's tested by editing the
   * card's config itself in main.ts). */
  restingHrUnavailable: boolean;
}

function entity(id: string, state: string, extra: Partial<HassEntity["attributes"]> = {}): HassEntity {
  return {
    entity_id: id,
    state,
    attributes: { friendly_name: id, ...extra },
  };
}

export function buildFixtureEntities(s: FixtureState): HassEntity[] {
  return [
    entity("sensor.sleep_efficiency", String(s.sleepEfficiency), { unit_of_measurement: "%" }),
    entity("sensor.eyesight_left", String(s.eyesightLeft)),
    entity("sensor.eyesight_right", String(s.eyesightRight)),
    entity(
      "sensor.resting_heart_rate",
      s.restingHrUnavailable ? "unavailable" : String(s.restingHr),
      { unit_of_measurement: "bpm" }
    ),
    entity("sensor.body_fat", String(s.bodyFat), { unit_of_measurement: "%" }),
    entity("sensor.visceral_fat", String(s.visceralFat)),
    entity("sensor.muscle_mass", String(s.muscleMass), { unit_of_measurement: "kg" }),
    entity("sensor.bone_mass", String(s.boneMass), { unit_of_measurement: "kg" }),
    entity("sensor.body_weight", String(s.weight), { unit_of_measurement: "kg" }),
    entity("sensor.bmi", String(s.bmi)),
    entity("sensor.body_water", String(s.water), { unit_of_measurement: "%" }),
    entity("sensor.body_protein", String(s.protein), { unit_of_measurement: "%" }),
  ];
}

/** Three whole-body scenarios spanning the good/ok/bad bands in compute.ts,
 * plus a "mixed" one that specifically exercises the torso and arms worst-of
 * combinations (primary metric good, its "sub reason" bad) — and gives the
 * two eyes genuinely different values, since that's the one metric allowed
 * to differ left vs right (and, unlike the torso/arms pairs, deliberately
 * does NOT drive the head's color — see headLevel in compute.ts). */
export const PRESETS: Record<"good" | "ok" | "bad" | "mixed" | "typical", FixtureState> = {
  good: {
    sleepEfficiency: 92,
    eyesightLeft: 20,
    eyesightRight: 20,
    restingHr: 55,
    bodyFat: 15,
    visceralFat: 6,
    muscleMass: 55,
    boneMass: 4.2,
    weight: 66.5,
    bmi: 21,
    water: 68,
    protein: 22,
    restingHrUnavailable: false,
  },
  ok: {
    sleepEfficiency: 78,
    eyesightLeft: 30,
    eyesightRight: 25,
    restingHr: 68,
    bodyFat: 22,
    visceralFat: 9,
    muscleMass: 50,
    boneMass: 3.4,
    weight: 64.5,
    bmi: 27,
    water: 58,
    protein: 17,
    restingHrUnavailable: false,
  },
  bad: {
    sleepEfficiency: 58,
    eyesightLeft: 60,
    eyesightRight: 70,
    restingHr: 88,
    bodyFat: 28,
    visceralFat: 13,
    muscleMass: 44,
    boneMass: 2.6,
    weight: 71,
    bmi: 33,
    water: 50,
    protein: 12,
    restingHrUnavailable: false,
  },
  mixed: {
    sleepEfficiency: 92, // good -> head should read good (eyesight no longer feeds into it)
    eyesightLeft: 20, // good
    eyesightRight: 50, // bad, but on its own — right eye alone shows it, head stays good
    restingHr: 55,
    bodyFat: 15, // good
    visceralFat: 13, // bad -> torso should read bad (worst-of)
    muscleMass: 55, // good
    protein: 12, // bad -> arms should read bad (worst-of) despite good muscle mass
    boneMass: 4.2,
    weight: 66.5, // good
    bmi: 33, // bad -> header chip should read bad (worst-of)
    water: 68,
    restingHrUnavailable: false,
  },
  // A whole-body set that sits inside the "ok" bands on every metric rather
  // than straddling them, so it reads as an ordinary day rather than a test
  // case — useful for eyeballing the resting layout without any region
  // shouting for attention.
  typical: {
    sleepEfficiency: 80,
    eyesightLeft: 25,
    eyesightRight: 25,
    restingHr: 62,
    bodyFat: 20,
    visceralFat: 8,
    muscleMass: 50,
    boneMass: 3.0,
    weight: 70,
    bmi: 24,
    water: 58,
    protein: 18,
    restingHrUnavailable: false,
  },
};
