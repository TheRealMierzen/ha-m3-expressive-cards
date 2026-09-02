import { BodyStatsCardConfig, HomeAssistant } from "./types";

const UNKNOWN_STATES = new Set(["unknown", "unavailable"]);

function isUnknown(state: unknown): boolean {
  return state == null || UNKNOWN_STATES.has(String(state).toLowerCase());
}

function toNumber(state: unknown): number | null {
  if (isUnknown(state)) return null;
  const n = Number(state);
  return Number.isFinite(n) ? n : null;
}

export type Level = "good" | "ok" | "bad";
type Sex = "male" | "female" | undefined;
type Age = number | undefined;

export interface MetricVal {
  value: number | null;
  /** Formatted for display, e.g. "67.2 kg". "—" when the entity is missing
   * or unavailable. */
  text: string;
  /** null when there's no value to judge (entity not configured, or its
   * state is unknown/unavailable) — the region/badge renders neutral. */
  level: Level | null;
}

const NO_VALUE: MetricVal = { value: null, text: "—", level: null };

/** Picks the more concerning of two levels — bad beats ok beats good beats
 * unset — so a region driven by a primary metric plus a "sub reason" (torso:
 * body fat + visceral fat; header: weight + BMI) reads as "needs attention"
 * if either input does, rather than averaging two numbers that don't share
 * a scale. Eyesight is drawn on the head but deliberately excluded from
 * this pattern — see headLevel below. */
export function worstOf(...levels: Array<Level | null>): Level | null {
  const present = levels.filter((l): l is Level => l != null);
  if (present.length === 0) return null;
  if (present.includes("bad")) return "bad";
  if (present.includes("ok")) return "ok";
  return "good";
}

function higherBetter(value: number, badBelow: number, goodAtOrAbove: number): Level {
  if (value < badBelow) return "bad";
  if (value < goodAtOrAbove) return "ok";
  return "good";
}

function lowerBetter(value: number, goodAtOrBelow: number, badAbove: number): Level {
  if (value > badAbove) return "bad";
  if (value > goodAtOrBelow) return "ok";
  return "good";
}

/** For metrics with a healthy target band on both sides (BMI, body fat %,
 * body water %) rather than a simple "more/less is better" direction. */
function bandLevel(value: number, goodMin: number, goodMax: number, okMin: number, okMax: number): Level {
  if (value >= goodMin && value <= goodMax) return "good";
  if (value >= okMin && value <= okMax) return "ok";
  return "bad";
}

function metric(hass: HomeAssistant, entityId: string | undefined, format: (v: number) => string, level: (v: number) => Level): MetricVal {
  if (!entityId) return NO_VALUE;
  const value = toNumber(hass.states[entityId]?.state);
  if (value == null) return NO_VALUE;
  return { value, text: format(value), level: level(value) };
}

const pct = (v: number) => `${v.toFixed(v % 1 === 0 ? 0 : 1)}%`;
const kg = (v: number) => `${v.toFixed(1)} kg`;

/** --------------------------------------------------------------------
 * Researched threshold bands
 *
 * Every band below is sourced from a named, checkable reference rather
 * than guessed — see the comment above each. Two categories of metric
 * needed real research to get right:
 *
 * 1. Metrics smart scales derive via bioelectrical impedance (muscle
 *    mass, bone mass, visceral fat, body water, protein) don't measure
 *    the same thing a DEXA scan or clinical lab does — they're
 *    proprietary estimates, and academic/clinical reference ranges for
 *    the "real" measurement (e.g. DEXA bone mineral content) don't apply
 *    to a bathroom scale's number. These are grounded in the scale
 *    vendors' own published reference data instead (Withings, Tanita,
 *    Renpho, InBody) wherever available.
 * 2. Muscle mass % and bone mass reference values scale with body
 *    weight and differ by sex — a fixed kg cutoff misclassifies anyone
 *    who isn't close to the original dashboard owner's own build. Both
 *    now derive from body weight (via weight_entity) and an optional
 *    `sex` config field, falling back to the old fixed-kg heuristic only
 *    when weight isn't tracked.
 * ------------------------------------------------------------------- */

/** Sleep efficiency: clinical sleep-medicine / CBT-I insomnia threshold.
 * ≥85% is the standard "good" cutoff; <75% is commonly used as indicative
 * of clinically significant sleep disturbance. Source: sleep medicine
 * literature on insomnia treatment (CBT-I sleep-efficiency criterion),
 * e.g. https://en.wikipedia.org/wiki/Sleep_efficiency and the clinical
 * consensus summarized at https://ubiehealth.com/doctors-note/sleep-efficiency-measure-nighttime-rest-quality-7332e4 */
function sleepEfficiencyLevel(v: number): Level {
  return higherBetter(v, 75, 85);
}

/** Eyesight: standard Snellen denominator (20 for 20/20), lower is
 * better. WHO's mild-visual-impairment category starts at "worse than
 * 20/40" — see https://www.cedc.tools/WHOcategories.html — so 20/40 is
 * the natural "still fine without correction for most purposes" ceiling,
 * matching the good/ok/bad split below almost exactly. */
function eyesightLevel(v: number): Level {
  return lowerBetter(v, 20, 40);
}

/** Resting heart rate: AHA's clinical "normal" range is a blunt 60-100bpm
 * for all adults (https://www.heart.org/en/healthy-living/exercise-and-physical-activity/fitness-basics/target-heart-rates)
 * — not useful for a fitness dashboard, since nearly every reading you'd
 * actually see falls inside it. Fitness-rating charts (Garmin/Polar-style)
 * are more discriminating: roughly <70bpm reads as good-to-excellent,
 * 70-85 as average, and above 85 as below-average for a general adult —
 * see https://www.topendsports.com/testing/heart-rate-resting-chart.htm
 * and https://themetabolicjournal.com/biomarkers/resting-heart-rate.
 * Deliberately not age-adjusted even though this card now collects age
 * for muscle mass — the fitness-chart age breakdowns for RHR found during
 * research were too inconsistent between sources to turn into a
 * defensible per-bracket table; this stays a general-adult heuristic. */
function restingHrLevel(v: number): Level {
  return lowerBetter(v, 70, 85);
}

/** Body fat %: American Council on Exercise categories, which are
 * explicitly sex-specific because essential fat differs by sex —
 * https://www.acefitness.org/about-ace/press-room/in-the-news/8602/body-fat-percentage-charting-averages-in-men-and-women-very-well-health/
 * "Healthy/Fitness" maps to good, "Athletic" (very lean but below ACE's
 * own healthy label) maps to ok, and "Essential" (too low, real health
 * risk) or "Acceptable"-and-up (ACE's obesity-adjacent bucket) map to
 * bad. Unisex fallback below is a rough midpoint of both sex bands, used
 * only when `sex` isn't configured. */
function bodyFatLevel(v: number, sex: Sex): Level {
  if (sex === "male") return bandLevel(v, 14, 24, 6, 24.999);
  if (sex === "female") return bandLevel(v, 21, 31, 14, 31.999);
  return bandLevel(v, 18, 27, 10, 27.999);
}

/** Visceral fat rating: Tanita's 1-59 scale is the original/most widely
 * calibrated one (validated against DEXA/CT samples) — 1-12 is its own
 * "healthy" band, 13+ is "high" —
 * https://biologyinsights.com/visceral-fat-rating-chart-what-do-the-numbers-mean/
 * Renpho's own app uses a stricter 1-9 "healthy" cutoff on the same
 * underlying scale — https://renpho.com/blogs/wellness-fitness-blog/what-does-renpho-body-scale-measure
 * Splitting the difference: ≤9 good, 9-12 ok (still inside Tanita's own
 * healthy band but past Renpho's), >12 bad (unambiguously Tanita's
 * "high" tier regardless of vendor). */
function visceralFatLevel(v: number): Level {
  return lowerBetter(v, 9, 12);
}

/** Muscle mass: Withings publishes this as a % of total body weight, not
 * an absolute figure — and it's a much broader "everything but fat and
 * bone" lean-mass metric, not literal skeletal muscle tissue, which is
 * why the healthy range sits as high as 60-89% —
 * https://support.withings.com/hc/en-us/articles/218500778-Body-What-are-the-normal-ranges-for-body-composition
 * Withings documents this in three age brackets per sex, each a few
 * points apart — worth using age if it's configured, and falling back to
 * the min-to-max envelope across all three brackets if it isn't:
 *   Men:   20-39 75-89%, 40-59 73-86%, 60-79 70-84%
 *   Women: 20-39 63-75.5%, 40-59 62-73.5%, 60-79 60-72.5%
 * Falls back further to the old fixed-kg heuristic when body weight
 * isn't tracked at all, since a kg reading can't become a % without it. */
const MUSCLE_MASS_PCT_BY_AGE: Record<"male" | "female", Record<"20-39" | "40-59" | "60-79", [number, number]>> = {
  male: { "20-39": [75, 89], "40-59": [73, 86], "60-79": [70, 84] },
  female: { "20-39": [63, 75.5], "40-59": [62, 73.5], "60-79": [60, 72.5] },
};

function ageBracket(age: Age): "20-39" | "40-59" | "60-79" | undefined {
  if (age == null) return undefined;
  if (age < 40) return "20-39";
  if (age < 60) return "40-59";
  return "60-79";
}

function muscleMassBand(sex: Sex, age: Age): { goodMin: number; goodMax: number; okMin: number; okMax: number } {
  const bracket = ageBracket(age);
  const sexes: Array<"male" | "female"> = sex ? [sex] : ["male", "female"];
  const brackets = bracket ? [bracket] : (["20-39", "40-59", "60-79"] as const);
  // No age/sex known: envelope across every bracket for both sexes. Age
  // known but not sex (or vice versa): envelope across whatever's left
  // unpinned. Both known: the exact documented pair.
  const pairs = sexes.flatMap((s) => brackets.map((b) => MUSCLE_MASS_PCT_BY_AGE[s][b]));
  const goodMin = Math.min(...pairs.map((p) => p[0]));
  const goodMax = Math.max(...pairs.map((p) => p[1]));
  // A ±5-point buffer around the documented good range, same width used
  // for the sex-only bands this replaces.
  return { goodMin, goodMax, okMin: goodMin - 5, okMax: goodMax + 3 };
}

function muscleMassLevel(muscleKg: number, weightKg: number | null, sex: Sex, age: Age): Level {
  if (weightKg == null || weightKg <= 0) return higherBetter(muscleKg, 48, 53);
  const p = (muscleKg / weightKg) * 100;
  const { goodMin, goodMax, okMin, okMax } = muscleMassBand(sex, age);
  return bandLevel(p, goodMin, goodMax, okMin, okMax);
}

/** Bone mass: consumer BIA scales report a much smaller number than true
 * DEXA-measured skeletal weight (their own proprietary estimate, not a
 * bone-density measurement), and it scales with body weight — reference
 * points collected from smart-scale documentation: women <50kg -> 1.95kg,
 * 50-75kg -> 2.40kg, >75kg -> 2.90kg; men <65kg -> 2.65kg, 65-95kg ->
 * 3.29kg, >95kg -> 3.69kg (https://wellbeingnutrition.com/blogs/weight-metabolism/how-much-of-body-weight-is-bone).
 * Unlike fat, more bone mass is never itself a health concern, so this is
 * a lower-bound-only check against that reference (ratio of actual to
 * expected), not a two-sided band. Falls back to the old fixed-kg
 * heuristic when weight isn't tracked. */
function boneMassReference(weightKg: number, sex: Sex): number {
  if (sex === "female") {
    if (weightKg < 50) return 1.95;
    if (weightKg <= 75) return 2.4;
    return 2.9;
  }
  if (sex === "male") {
    if (weightKg < 65) return 2.65;
    if (weightKg <= 95) return 3.29;
    return 3.69;
  }
  return (boneMassReference(weightKg, "female") + boneMassReference(weightKg, "male")) / 2;
}

function boneMassLevel(boneKg: number, weightKg: number | null, sex: Sex): Level {
  if (weightKg == null || weightKg <= 0) return higherBetter(boneKg, 3, 4);
  const ratio = boneKg / boneMassReference(weightKg, sex);
  if (ratio >= 0.9) return "good";
  if (ratio >= 0.78) return "ok";
  return "bad";
}

/** BMI: WHO's standard adult categories —
 * https://www.who.int (summarized at, e.g., https://simplebmi.com/bmi-categories/):
 * Underweight <18.5, Normal 18.5-24.9, Overweight 25-29.9, Obese ≥30.
 * Mapped directly: Normal -> good, Overweight -> ok, Underweight or
 * Obese -> bad (WHO treats being underweight as its own risk category,
 * not merely "fine" — this reflects that rather than a softer reading). */
function bmiLevel(v: number): Level {
  // bandLevel's good/ok bands cover 18.5-29.9; anything outside that,
  // above or below, already falls through to "bad" — exactly WHO's
  // Underweight-or-Obese-is-bad mapping, no extra casing needed.
  return bandLevel(v, 18.5, 24.9, 25, 29.9);
}

/** Body water %: general BIA/physiology consensus (not vendor-specific —
 * unlike muscle/bone mass, this figure is the same underlying measurement
 * across scale brands), sex-specific because men typically carry more
 * lean mass -> more water: men ~50-65%, women ~45-60% —
 * https://wcs.withings.com/us/en/health-insights/about-body-water and
 * https://biologyinsights.com/body-water-percentage-how-much-should-you-have/ */
function waterLevel(v: number, sex: Sex): Level {
  if (sex === "male") return bandLevel(v, 50, 65, 45, 70);
  if (sex === "female") return bandLevel(v, 45, 60, 40, 65);
  return bandLevel(v, 47, 62, 42, 67);
}

/** Protein %: the weakest-evidenced band here — there's no widely
 * published, vendor-agnostic protein-mass-% chart the way there is for
 * body fat or BMI (InBody's own reports personalize this per user rather
 * than publishing a fixed table). The one concrete figure found is a
 * "healthy is ~17% and up" floor —
 * https://www.bodycentredayspa.com/new-blog-1/j7hswhgnewm8zshd3ce5hj75k8mgkn
 * Treat this one as a rough heuristic, more than the others. */
function proteinLevel(v: number): Level {
  return higherBetter(v, 14, 17);
}

export interface ComputedBodyStats {
  sleep: MetricVal;
  eyesightLeft: MetricVal;
  eyesightRight: MetricVal;
  restingHr: MetricVal;
  bodyFat: MetricVal;
  visceralFat: MetricVal;
  muscleMass: MetricVal;
  boneMass: MetricVal;
  weight: MetricVal;
  bmi: MetricVal;
  water: MetricVal;
  protein: MetricVal;
  /** Color driver for the head/brain silhouette region — sleep efficiency
   * only. Eyesight is drawn on the head (it's the anatomically obvious
   * spot) but deliberately doesn't feed into this: unlike visceral
   * fat/BMI, it's not a "reason" the head reads well or badly, it's an
   * unrelated metric that just happens to live on the same body part. */
  headLevel: Level | null;
  /** Combined color driver for the torso silhouette region — body fat,
   * with visceral fat as its "sub reason". */
  torsoLevel: Level | null;
  /** Combined color driver for the arms — muscle mass, with protein as its
   * "sub reason" (protein is muscle's raw material, a real functional link
   * — unlike eyesight/sleep, which just happen to share a body part). */
  armsLevel: Level | null;
  /** Color driver for the header's weight/BMI readout — weight and BMI
   * don't map to any single body part cleanly, so they get a text
   * readout next to the title instead of a silhouette region. In
   * practice this is just bmi.level (weight.level already mirrors it —
   * see weight's construction above), kept as worstOf for the same
   * "handles either one being untracked" safety net every other
   * combined level gets. */
  weightLevel: Level | null;
}

/** Pure computation from (hass, config) -> per-metric values + levels. See
 * the researched band functions above `ComputedBodyStats` for what each
 * threshold is based on and why. Weight/BMI are computed early (not in
 * their on-screen order) because muscle mass and bone mass need the raw
 * weight value to turn their kg reading into a body-weight-relative
 * figure, and weight's own displayed level needs BMI's. */
export function computeVals(hass: HomeAssistant, c: BodyStatsCardConfig): ComputedBodyStats {
  const sex: Sex = c.sex;
  const age: Age = c.age;

  const sleep = metric(hass, c.sleep_efficiency_entity, (v) => `${Math.round(v)}%`, sleepEfficiencyLevel);

  const eyeText = (v: number) => `20/${Math.round(v)}`;
  const eyesightLeft = metric(hass, c.eyesight_left_entity, eyeText, eyesightLevel);
  const eyesightRight = metric(hass, c.eyesight_right_entity, eyeText, eyesightLevel);

  const restingHr = metric(hass, c.resting_hr_entity, (v) => `${Math.round(v)} bpm`, restingHrLevel);

  // Weight has no health verdict of its own to give — BMI (which factors
  // in height) is the actual signal for whether a given weight is
  // healthy, so weight's color mirrors BMI's rather than being judged
  // independently against some fixed target. (This used to be a
  // hardcoded personal 64-68kg band inherited from the original
  // dashboard config — the one threshold in this file that never got the
  // "research it properly" treatment — which is exactly how a real
  // weight could read "bad" while BMI, right next to it, read "good":
  // two independent, disagreeing verdicts on the same underlying fact.)
  const weightRaw = metric(hass, c.weight_entity, kg, () => "good");
  const bmi = metric(hass, c.bmi_entity, (v) => v.toFixed(1), bmiLevel);
  const weight: MetricVal = weightRaw.value == null ? weightRaw : { ...weightRaw, level: bmi.level };

  const bodyFat = metric(hass, c.body_fat_entity, pct, (v) => bodyFatLevel(v, sex));
  const visceralFat = metric(hass, c.visceral_fat_entity, (v) => v.toFixed(1), visceralFatLevel);
  const muscleMass = metric(hass, c.muscle_mass_entity, kg, (v) => muscleMassLevel(v, weightRaw.value, sex, age));
  const boneMass = metric(hass, c.bone_mass_entity, (v) => `${v.toFixed(2)} kg`, (v) => boneMassLevel(v, weightRaw.value, sex));
  const water = metric(hass, c.water_entity, pct, (v) => waterLevel(v, sex));
  const protein = metric(hass, c.protein_entity, pct, proteinLevel);

  return {
    sleep,
    eyesightLeft,
    eyesightRight,
    restingHr,
    bodyFat,
    visceralFat,
    muscleMass,
    boneMass,
    weight,
    bmi,
    water,
    protein,
    headLevel: sleep.level,
    torsoLevel: worstOf(bodyFat.level, visceralFat.level),
    armsLevel: worstOf(muscleMass.level, protein.level),
    weightLevel: worstOf(weight.level, bmi.level),
  };
}
