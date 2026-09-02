export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    icon?: string;
    unit_of_measurement?: string;
    [key: string]: unknown;
  };
}

/** A minimal slice of Home Assistant's Hass type, just what this card reads. */
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  themes?: { darkMode?: boolean };
  callService(domain: string, service: string, serviceData?: Record<string, unknown>): void;
}

export interface BodyStatsCardConfig {
  type: string;
  title?: string;
  /** Optional, but several thresholds in compute.ts are sex-specific
   * (body fat %, muscle mass %, bone mass, body water %) because the
   * underlying research is — see compute.ts for sources. Omit to fall
   * back to a blended unisex band for those metrics. */
  sex?: "male" | "female";
  /** Optional — only sharpens the muscle mass band further, from a broad
   * all-ages envelope down to Withings' actual age-bracketed range (see
   * compute.ts). Not used for anything else; other age-adjusted charts
   * found during research weren't consistent enough to use responsibly. */
  age?: number;
  /** sensor.*: 0-100 sleep efficiency. Sole driver of the head/brain
   * region's color. */
  sleep_efficiency_entity?: string;
  /** sensor.*: left-eye visual acuity from a standard Snellen eye test —
   * the entity is expected to hold just the denominator (20 for 20/20, 40
   * for 20/40); lower is better. Adjust compute.ts if your sensor reports a
   * different scale (logMAR, diopters, ...). Unlike every other paired
   * body part, eyesight genuinely can differ left vs right, so it gets its
   * own entity per eye instead of one mirrored to both. Drawn as the eyes
   * on the head, but deliberately doesn't affect the head region's color —
   * it's just anatomically located there, not a "reason" for how the head
   * reads. */
  eyesight_left_entity?: string;
  /** sensor.*: right-eye visual acuity. See eyesight_left_entity. */
  eyesight_right_entity?: string;
  /** sensor.*: resting heart rate in bpm. A standalone chest pin — not
   * nested under any region. */
  resting_hr_entity?: string;
  /** sensor.*: body fat %. Primary driver of the torso region — paired
   * with visceral_fat_entity as its "sub reason". */
  body_fat_entity?: string;
  /** sensor.*: visceral fat index. Drawn as a small belly badge and a sub
   * reason for the torso region's color alongside body fat. */
  visceral_fat_entity?: string;
  /** sensor.*: muscle mass in kg. Primary driver of the arms (mirrored —
   * one sensor, not a left/right split), paired with protein_entity as its
   * "sub reason". */
  muscle_mass_entity?: string;
  /** sensor.*: bone mass in kg. Drives both legs (the long bones live
   * there). */
  bone_mass_entity?: string;
  /** sensor.*: body weight in kg. Doesn't map to a body part cleanly —
   * shown as a header chip instead. Has no health verdict of its own:
   * its color mirrors bmi_entity's, since BMI (which accounts for
   * height) is the actual signal for whether a given weight is healthy,
   * not some fixed target weight. */
  weight_entity?: string;
  /** sensor.*: BMI. The header weight chip's sole color driver — see
   * weight_entity. */
  bmi_entity?: string;
  /** sensor.*: body water %. Drawn as a left-elbow badge, mirroring protein
   * on the right elbow purely for visual symmetry — hydration doesn't have
   * an honest anatomical link to the arm the way protein does, so this
   * deliberately does NOT feed into the arms' color (see armsLevel in
   * compute.ts). */
  water_entity?: string;
  /** sensor.*: protein %. Drawn as a right-elbow badge and a genuine sub
   * reason for the arms' color alongside muscle mass — protein is muscle's
   * raw material, a real functional link (unlike water, which just sits
   * on the mirrored elbow spot for symmetry). */
  protein_entity?: string;
}
