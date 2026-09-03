import { LitElement, html, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import "./body-stats-card-editor";
import { cardStyles } from "./card.css";
import { computeVals, Level, MetricVal } from "./compute";
import { BodyStatsCardConfig, HomeAssistant } from "./types";

const DEFAULT_CONFIG: Partial<BodyStatsCardConfig> = {
  title: "Body Stats",
};

/** Every clickable/hoverable thing on the card, for hover-sync purposes:
 * hovering a legend row highlights whatever on-body element shares its
 * token, and vice versa. Torso+visceral, arms+protein, and the weight
 * chip's own weight+BMI pairing are each a primary driver plus a "sub
 * reason" that also feeds into the parent's color — hovering the sub
 * reason's badge or legend row does NOT highlight the parent region, since
 * it's a detail of it, not the same thing. Eyesight is drawn on the head
 * but is NOT a "sub reason" the same way (see headLevel in compute.ts) —
 * it just gets its own token because it's independently interactive, split
 * left/right since that's the one paired metric that genuinely differs
 * side to side. Arms and legs share one token each (one sensor, mirrored)
 * so hovering either side highlights both at once. */
type RegionId =
  | "head"
  | "eye-left"
  | "eye-right"
  | "torso"
  | "visceral"
  | "arms"
  | "legs"
  | "heart"
  | "water"
  | "protein"
  | "weight";

interface LegendRow {
  icon: string;
  label: string;
  val: MetricVal;
  entityId?: string;
  region?: RegionId;
  /** Indents this row under the one above it — mirrors the badge-on-the-
   * region visual treatment for a metric that's either a genuine "sub
   * reason" for its parent's color (visceral fat under body fat, protein
   * under muscle mass, BMI under weight) or just anatomically nested there
   * without affecting the parent's color (eyes under sleep — see headLevel
   * in compute.ts). */
  sub?: boolean;
}

const CONFIG_ENTITY_KEYS: (keyof BodyStatsCardConfig)[] = [
  "sleep_efficiency_entity",
  "eyesight_left_entity",
  "eyesight_right_entity",
  "resting_hr_entity",
  "body_fat_entity",
  "visceral_fat_entity",
  "muscle_mass_entity",
  "bone_mass_entity",
  "weight_entity",
  "bmi_entity",
  "water_entity",
  "protein_entity",
];

/** Only re-renders when one of the entities this card actually reads
 * changes, not on every unrelated hass update elsewhere in the system. */
function entitySignature(hass: HomeAssistant, config: BodyStatsCardConfig): string {
  return CONFIG_ENTITY_KEYS.map((key) => {
    const id = config[key];
    if (typeof id !== "string" || id === "") return "";
    const e = hass.states[id];
    return e ? `${id}:${e.state}` : `${id}:_`;
  }).join("|");
}

@customElement("m3-body-stats-card")
export class BodyStatsCard extends LitElement {
  static styles = cardStyles;

  private _hass?: HomeAssistant;
  private _lastSignature = "";

  @state() private _config!: BodyStatsCardConfig;
  @state() private _hovered?: RegionId;
  // Collapsed by default — the card's job at a glance is the silhouette;
  // the legend is the detail view you open on purpose.
  @state() private _expanded = false;

  @query('[data-ref="legend-body"]') private _legendBodyEl?: HTMLElement;
  private _syncedLegendBodyEl?: HTMLElement;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    // Reflects HA's actual theme setting, not the OS-level
    // prefers-color-scheme media feature — those two can disagree.
    this.setAttribute("data-theme", hass.themes?.darkMode ? "dark" : "light");
    if (!this._config) return;
    const signature = entitySignature(hass, this._config);
    if (signature === this._lastSignature) return;
    this._lastSignature = signature;
    this.requestUpdate();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  setConfig(config: BodyStatsCardConfig): void {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._lastSignature = "";
    this._hovered = undefined;
    this._expanded = false;
    this._syncedLegendBodyEl = undefined;
  }

  static getStubConfig(): BodyStatsCardConfig {
    return {
      type: "custom:m3-body-stats-card",
      title: "Body Stats",
      sleep_efficiency_entity: "sensor.sleep_efficiency",
      eyesight_left_entity: "sensor.eyesight_left",
      eyesight_right_entity: "sensor.eyesight_right",
      resting_hr_entity: "sensor.resting_heart_rate",
      body_fat_entity: "sensor.body_fat",
      visceral_fat_entity: "sensor.visceral_fat",
      muscle_mass_entity: "sensor.muscle_mass",
      bone_mass_entity: "sensor.bone_mass",
      weight_entity: "sensor.body_weight",
      bmi_entity: "sensor.bmi",
      water_entity: "sensor.body_water",
      protein_entity: "sensor.body_protein",
    };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("m3-body-stats-card-editor");
  }

  protected updated(): void {
    // A newly-mounted body (only happens once, at first render, or after a
    // config reset) needs its max-height snapped to the current
    // open/closed state with no animation — _toggleCard animates
    // explicitly and must not be fought here.
    const legendBody = this._legendBodyEl;
    if (legendBody && legendBody !== this._syncedLegendBodyEl) {
      this._syncedLegendBodyEl = legendBody;
      legendBody.style.maxHeight = this._expanded ? "none" : "0";
    }
  }

  /** Teardown for the expand/collapse currently running on a body element,
      so a new toggle can cancel it instead of racing it. */
  private _expandCleanups = new WeakMap<HTMLElement, () => void>();

  private _prefersReducedMotion(): boolean {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  private _animateExpand(el: HTMLElement, open: boolean): void {
    // Spammed toggles: tear down the previous run first. Its transitionend
    // listener would otherwise still be armed and fire at the end of *this*
    // animation, snapping max-height back to the superseded target — the
    // section visibly jumping to whatever the first click was heading for.
    this._expandCleanups.get(el)?.();

    if (this._prefersReducedMotion()) {
      el.style.maxHeight = open ? "none" : "0";
      return;
    }

    // Animate from the height that is on screen right now — mid-flight that
    // is somewhere between 0 and the content height, not either endpoint —
    // so an interrupted section continues from where it is instead of
    // snapping to 0 (or to full height) before moving.
    const from = el.offsetHeight;
    const to = open ? el.scrollHeight : 0;
    if (from === to) {
      el.style.maxHeight = open ? "none" : "0";
      return;
    }
    el.style.maxHeight = `${from}px`;
    void el.offsetHeight; // flush the start value so the change below transitions

    const cleanup = (): void => {
      el.removeEventListener("transitionend", onDone);
      el.removeEventListener("transitioncancel", onDone);
      this._expandCleanups.delete(el);
    };
    const onDone = (e: TransitionEvent): void => {
      if (e.target !== el || e.propertyName !== "max-height") return;
      const settled = e.type === "transitionend";
      cleanup();
      // Only a run that reached its end releases the clamp, so an open
      // section can grow with its content afterwards.
      if (open && settled) el.style.maxHeight = "none";
    };
    el.addEventListener("transitionend", onDone);
    el.addEventListener("transitioncancel", onDone);
    this._expandCleanups.set(el, cleanup);
    el.style.maxHeight = `${to}px`;
  }

  private _toggleCard(): void {
    this._expanded = !this._expanded;
    void this.updateComplete.then(() => {
      if (this._legendBodyEl) this._animateExpand(this._legendBodyEl, this._expanded);
    });
  }

  private _headerKeydown(e: KeyboardEvent): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    this._toggleCard();
  }

  private _openMoreInfo(entityId?: string): void {
    if (!entityId) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _onRegionKeydown(e: KeyboardEvent, entityId?: string): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    this._openMoreInfo(entityId);
  }

  private _setHovered(region?: RegionId): void {
    this._hovered = region;
  }

  /** `mode` picks which CSS family colors the shape: a filled silhouette
   * panel (head, torso) vs. a thick stroked centerline (arms, legs) — see
   * card.css.ts for why they need different properties. */
  /** The ink pass drawn under a limb. It has to know the level for the same
   * reason a filled region's stroke does: an unset limb has no colour for
   * the ink to separate, and in light theme a white ink under a pale grey
   * stroke on a near-white card left the limb invisible. Unset limbs take
   * the outline role instead. */
  private _limbOutlineClass(level: Level | null): string {
    return `limb-outline ${level ? `level-${level}` : "level-unset"}`;
  }

  private _regionClass(mode: "fill" | "stroke", region: RegionId, level: Level | null): string {
    const lvl = level ? `level-${level}` : "level-unset";
    const base = mode === "fill" ? "region region-fill" : "region region-stroke";
    return `${base} ${lvl}${this._hovered === region ? " hovered" : ""}`;
  }

  private _badgeClass(region: RegionId, level: Level | null, sub = false): string {
    const lvl = level ? `level-${level}` : "level-unset";
    return `badge${sub ? " sub" : ""} ${lvl}${this._hovered === region ? " hovered" : ""}`;
  }

  private _legendRowClass(region: RegionId | undefined, level: Level | null, sub = false): string {
    const lvl = level ? `level-${level}` : "level-unset";
    return `legend-row${sub ? " sub" : ""} ${lvl}${region && this._hovered === region ? " hovered" : ""}`;
  }

  protected render() {
    if (!this._config || !this._hass) {
      return nothing;
    }
    const c = this._config;
    const v = computeVals(this._hass, c);

    const rows: LegendRow[] = ([
      { icon: "mdi:sleep", label: "Sleep efficiency", val: v.sleep, entityId: c.sleep_efficiency_entity, region: "head" },
      { icon: "mdi:eye-outline", label: "Left eye", val: v.eyesightLeft, entityId: c.eyesight_left_entity, region: "eye-left", sub: true },
      { icon: "mdi:eye-outline", label: "Right eye", val: v.eyesightRight, entityId: c.eyesight_right_entity, region: "eye-right", sub: true },
      { icon: "mdi:heart-pulse", label: "Resting heart rate", val: v.restingHr, entityId: c.resting_hr_entity, region: "heart" },
      { icon: "mdi:scale-bathroom", label: "Body fat", val: v.bodyFat, entityId: c.body_fat_entity, region: "torso" },
      { icon: "mdi:chart-donut", label: "Visceral fat", val: v.visceralFat, entityId: c.visceral_fat_entity, region: "visceral", sub: true },
      { icon: "mdi:arm-flex", label: "Muscle mass", val: v.muscleMass, entityId: c.muscle_mass_entity, region: "arms" },
      { icon: "mdi:food-drumstick", label: "Protein", val: v.protein, entityId: c.protein_entity, region: "protein", sub: true },
      { icon: "mdi:bone", label: "Bone mass", val: v.boneMass, entityId: c.bone_mass_entity, region: "legs" },
      { icon: "mdi:scale-bathroom", label: "Weight", val: v.weight, entityId: c.weight_entity, region: "weight" },
      { icon: "mdi:human-male-height", label: "BMI", val: v.bmi, entityId: c.bmi_entity, region: "weight", sub: true },
      { icon: "mdi:water-percent", label: "Body water", val: v.water, entityId: c.water_entity, region: "water" },
    ] as LegendRow[]).filter((row) => row.entityId);

    const hasAny = rows.length > 0;
    const hasWeightChip = Boolean(c.weight_entity || c.bmi_entity);
    const weightPrimaryEntity = c.weight_entity ?? c.bmi_entity;

    return html`
      <ha-card>
        <div class="wrap">
          <div
            class="header ${hasAny ? "toggle" : ""}"
            tabindex=${hasAny ? "0" : nothing}
            role=${hasAny ? "button" : nothing}
            aria-expanded=${hasAny ? (this._expanded ? "true" : "false") : nothing}
            aria-label=${hasAny ? "Toggle the details list" : nothing}
            @click=${() => hasAny && this._toggleCard()}
            @keydown=${(e: KeyboardEvent) => hasAny && this._headerKeydown(e)}
          >
            <div class="leading-icon"><ha-icon icon="mdi:human"></ha-icon></div>
            <div class="title-text">
              <div class="name m3-title-medium-emphasized">${c.title || "Body Stats"}</div>
              <div class="supporting m3-body-small">
                ${hasAny ? "Tap a region, or the header for the full list" : "No entities configured yet"}
              </div>
            </div>
            ${hasWeightChip
              ? html`
                  <button
                    class="weight-chip ${v.weightLevel ? `level-${v.weightLevel}` : "level-unset"}${this._hovered === "weight" ? " hovered" : ""}"
                    type="button"
                    aria-label="Weight ${v.weight.text}, BMI ${v.bmi.text}"
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      this._openMoreInfo(weightPrimaryEntity);
                    }}
                    @keydown=${(e: KeyboardEvent) => e.stopPropagation()}
                    @mouseenter=${() => this._setHovered("weight")}
                    @mouseleave=${() => this._setHovered(undefined)}
                  >
                    <span class="wc-value m3-title-small-emphasized">${v.weight.text}</span>
                    <span class="wc-sub m3-label-small">BMI ${v.bmi.text}</span>
                  </button>
                `
              : nothing}
            ${hasAny ? html`<ha-icon class="chevron ${this._expanded ? "" : "collapsed"}" icon="mdi:chevron-down"></ha-icon>` : nothing}
          </div>

          ${hasAny
            ? html`
                <div class="body-map-wrap">
                  <svg class="silhouette" viewBox="0 0 240 400" role="img" aria-label="Body stats overview">
                    <!-- Neck: connective tissue only, never colored. -->
                    <rect class="structure" x="106" y="72" width="28" height="20" rx="6"></rect>

                    <!-- Legs: thick round-capped strokes, drawn before the torso
                         so the torso's hip curve overlaps their top end and the
                         joint reads as continuous rather than two shapes butted
                         together. Both legs are the same single bone-mass
                         entity, so only ONE of the pair is a keyboard tab stop
                         (role/tabindex/aria-label/keydown) — the second is
                         mouse-clickable/hoverable for visual symmetry but
                         aria-hidden and out of the tab order, so Tab doesn't
                         visit "the same region" twice in a row. Each carries
                         its own interactive attributes rather than sharing a
                         wrapping <g>, though — a <g> can only take the focus
                         outline/glow styling defined on the region classes of
                         its CHILDREN if it also directly carries those
                         classes, and it doesn't; making the focusable shape
                         itself carry the class (same as torso/head below)
                         keeps the native focus rectangle from showing up in
                         its place. -->
                    <path
                      class=${this._limbOutlineClass(v.boneMass.level)}
                      d="M 96,230 C 90,262 88,306 90,348 C 91,366 93,380 95,390"
                    ></path>
                    <path
                      class=${this._limbOutlineClass(v.boneMass.level)}
                      d="M 144,230 C 150,262 152,306 150,348 C 149,366 147,380 145,390"
                    ></path>
                    <path
                      class=${this._regionClass("stroke", "legs", v.boneMass.level)}
                      role=${c.bone_mass_entity ? "button" : nothing}
                      tabindex=${c.bone_mass_entity ? "0" : nothing}
                      aria-label="Bone mass: ${v.boneMass.text}"
                      @click=${() => this._openMoreInfo(c.bone_mass_entity)}
                      @keydown=${(e: KeyboardEvent) => this._onRegionKeydown(e, c.bone_mass_entity)}
                      @mouseenter=${() => this._setHovered("legs")}
                      @mouseleave=${() => this._setHovered(undefined)}
                      d="M 96,230 C 90,262 88,306 90,348 C 91,366 93,380 95,390"
                    ></path>
                    <path
                      class=${this._regionClass("stroke", "legs", v.boneMass.level)}
                      aria-hidden="true"
                      @click=${() => this._openMoreInfo(c.bone_mass_entity)}
                      @mouseenter=${() => this._setHovered("legs")}
                      @mouseleave=${() => this._setHovered(undefined)}
                      d="M 144,230 C 150,262 152,306 150,348 C 149,366 147,380 145,390"
                    ></path>

                    <!-- Arms: same thick-stroke treatment and same single-tab-
                         stop reasoning as the legs above — one muscle-mass
                         entity, mirrored, only the first arm is in the tab
                         order. -->
                    <path
                      class=${this._limbOutlineClass(v.muscleMass.level)}
                      d="M 78,100 C 56,110 44,134 42,170 C 41,192 44,212 51,228"
                    ></path>
                    <path
                      class=${this._limbOutlineClass(v.muscleMass.level)}
                      d="M 162,100 C 184,110 196,134 198,170 C 199,192 196,212 189,228"
                    ></path>
                    <path
                      class=${this._regionClass("stroke", "arms", v.armsLevel)}
                      role=${c.muscle_mass_entity ? "button" : nothing}
                      tabindex=${c.muscle_mass_entity ? "0" : nothing}
                      aria-label="Muscle mass: ${v.muscleMass.text}, protein ${v.protein.text}"
                      @click=${() => this._openMoreInfo(c.muscle_mass_entity)}
                      @keydown=${(e: KeyboardEvent) => this._onRegionKeydown(e, c.muscle_mass_entity)}
                      @mouseenter=${() => this._setHovered("arms")}
                      @mouseleave=${() => this._setHovered(undefined)}
                      d="M 78,100 C 56,110 44,134 42,170 C 41,192 44,212 51,228"
                    ></path>
                    <path
                      class=${this._regionClass("stroke", "arms", v.armsLevel)}
                      aria-hidden="true"
                      @click=${() => this._openMoreInfo(c.muscle_mass_entity)}
                      @mouseenter=${() => this._setHovered("arms")}
                      @mouseleave=${() => this._setHovered(undefined)}
                      d="M 162,100 C 184,110 196,134 198,170 C 199,192 196,212 189,228"
                    ></path>

                    <!-- Torso: one continuous shoulders-to-hips panel, body
                         fat's the single biggest driver of how this reads. -->
                    <path
                      class=${this._regionClass("fill", "torso", v.torsoLevel)}
                      role=${c.body_fat_entity ? "button" : nothing}
                      tabindex=${c.body_fat_entity ? "0" : nothing}
                      aria-label="Body fat: ${v.bodyFat.text}, visceral fat ${v.visceralFat.text}"
                      @click=${() => this._openMoreInfo(c.body_fat_entity)}
                      @keydown=${(e: KeyboardEvent) => this._onRegionKeydown(e, c.body_fat_entity)}
                      @mouseenter=${() => this._setHovered("torso")}
                      @mouseleave=${() => this._setHovered(undefined)}
                      d="M 82,84
                         C 96,80 144,80 158,84
                         C 172,88 180,98 178,112
                         C 176,146 170,180 166,206
                         C 164,218 166,228 170,238
                         C 170,242 166,244 162,244
                         L 78,244
                         C 74,244 70,242 70,238
                         C 74,228 76,218 74,206
                         C 70,180 64,146 62,112
                         C 60,98 68,88 82,84 Z"
                    ></path>

                    <!-- Head/brain: sleep efficiency only — eyesight is drawn
                         here too (see below) but deliberately doesn't feed
                         into this color. -->
                    <ellipse
                      class=${this._regionClass("fill", "head", v.headLevel)}
                      cx="120"
                      cy="44"
                      rx="33"
                      ry="37"
                      role=${c.sleep_efficiency_entity ? "button" : nothing}
                      tabindex=${c.sleep_efficiency_entity ? "0" : nothing}
                      aria-label="Sleep efficiency: ${v.sleep.text}"
                      @click=${() => this._openMoreInfo(c.sleep_efficiency_entity)}
                      @keydown=${(e: KeyboardEvent) => this._onRegionKeydown(e, c.sleep_efficiency_entity)}
                      @mouseenter=${() => this._setHovered("head")}
                      @mouseleave=${() => this._setHovered(undefined)}
                    ></ellipse>

                    <!-- Eyes: left and right eyesight, each its own flat dot
                         in the same fill+edge language as every other region
                         (no cartoon sclera) and its own entity/hover target,
                         since eyesight genuinely differs side to side —
                         drawn on the head, but deliberately not a "reason"
                         for the head's own color (see headLevel in
                         compute.ts). Each dot carries its own interactive
                         attributes directly, same reasoning as the arms/legs
                         above. -->
                    <circle
                      class="eye-dot ${this._regionClass("fill", "eye-left", v.eyesightLeft.level)}"
                      cx="108"
                      cy="40"
                      r="4.5"
                      role=${c.eyesight_left_entity ? "button" : nothing}
                      tabindex=${c.eyesight_left_entity ? "0" : nothing}
                      aria-label="Left eye: ${v.eyesightLeft.text}"
                      @click=${() => this._openMoreInfo(c.eyesight_left_entity)}
                      @keydown=${(e: KeyboardEvent) => this._onRegionKeydown(e, c.eyesight_left_entity)}
                      @mouseenter=${() => this._setHovered("eye-left")}
                      @mouseleave=${() => this._setHovered(undefined)}
                    ></circle>
                    <circle
                      class="eye-dot ${this._regionClass("fill", "eye-right", v.eyesightRight.level)}"
                      cx="132"
                      cy="40"
                      r="4.5"
                      role=${c.eyesight_right_entity ? "button" : nothing}
                      tabindex=${c.eyesight_right_entity ? "0" : nothing}
                      aria-label="Right eye: ${v.eyesightRight.text}"
                      @click=${() => this._openMoreInfo(c.eyesight_right_entity)}
                      @keydown=${(e: KeyboardEvent) => this._onRegionKeydown(e, c.eyesight_right_entity)}
                      @mouseenter=${() => this._setHovered("eye-right")}
                      @mouseleave=${() => this._setHovered(undefined)}
                    ></circle>
                  </svg>

                  <!-- Chest pin: resting heart rate — an independent vital,
                       not nested under torso. -->
                  <div
                    class=${this._badgeClass("heart", v.restingHr.level)}
                    style="left:50%;top:32%"
                    role=${c.resting_hr_entity ? "button" : nothing}
                    tabindex=${c.resting_hr_entity ? "0" : nothing}
                    aria-label="Resting heart rate: ${v.restingHr.text}"
                    @click=${() => this._openMoreInfo(c.resting_hr_entity)}
                    @keydown=${(e: KeyboardEvent) => this._onRegionKeydown(e, c.resting_hr_entity)}
                    @mouseenter=${() => this._setHovered("heart")}
                    @mouseleave=${() => this._setHovered(undefined)}
                  >
                    <ha-icon icon="mdi:heart-pulse"></ha-icon>
                  </div>

                  <!-- Belly badge: visceral fat — a sub reason for the torso's
                       color, smaller than the standalone pins to read as a
                       detail of the region it's sitting on rather than its
                       own body part. -->
                  <div
                    class=${this._badgeClass("visceral", v.visceralFat.level, true)}
                    style="left:50%;top:48%"
                    role=${c.visceral_fat_entity ? "button" : nothing}
                    tabindex=${c.visceral_fat_entity ? "0" : nothing}
                    aria-label="Visceral fat: ${v.visceralFat.text}"
                    @click=${() => this._openMoreInfo(c.visceral_fat_entity)}
                    @keydown=${(e: KeyboardEvent) => this._onRegionKeydown(e, c.visceral_fat_entity)}
                    @mouseenter=${() => this._setHovered("visceral")}
                    @mouseleave=${() => this._setHovered(undefined)}
                  >
                    <ha-icon icon="mdi:chart-donut"></ha-icon>
                  </div>

                  <!-- Elbow badges: body water (left) and protein (right) —
                       icon-only, mirrored at the same height. Positioned at
                       (42,170) and (198,170) in viewBox coords, which is
                       exactly the joint between each arm path's two curve
                       segments (shoulder->elbow, elbow->wrist) — the
                       anatomical elbow, not an arbitrary point along it.
                       Protein is a genuine sub reason for the arms' color
                       (it's muscle's raw material); water isn't — it's
                       drawn here purely for visual symmetry with protein,
                       not because hydration has an anatomical link to the
                       arm, so it deliberately doesn't feed into armsLevel. -->
                  <div
                    class=${this._badgeClass("water", v.water.level, true)}
                    style="left:17.5%;top:42.5%"
                    role=${c.water_entity ? "button" : nothing}
                    tabindex=${c.water_entity ? "0" : nothing}
                    aria-label="Body water: ${v.water.text}"
                    @click=${() => this._openMoreInfo(c.water_entity)}
                    @keydown=${(e: KeyboardEvent) => this._onRegionKeydown(e, c.water_entity)}
                    @mouseenter=${() => this._setHovered("water")}
                    @mouseleave=${() => this._setHovered(undefined)}
                  >
                    <ha-icon icon="mdi:water"></ha-icon>
                  </div>

                  <div
                    class=${this._badgeClass("protein", v.protein.level, true)}
                    style="left:82.5%;top:42.5%"
                    role=${c.protein_entity ? "button" : nothing}
                    tabindex=${c.protein_entity ? "0" : nothing}
                    aria-label="Protein: ${v.protein.text}"
                    @click=${() => this._openMoreInfo(c.protein_entity)}
                    @keydown=${(e: KeyboardEvent) => this._onRegionKeydown(e, c.protein_entity)}
                    @mouseenter=${() => this._setHovered("protein")}
                    @mouseleave=${() => this._setHovered(undefined)}
                  >
                    <ha-icon icon="mdi:food-drumstick"></ha-icon>
                  </div>
                </div>
              `
            : html`<div class="empty m3-body-medium">Add entities in the card editor to light this up.</div>`}

          ${hasAny
            ? html`
                <div class="legend-wrap" data-ref="legend-body" style="max-height:0">
                  <div class="legend">
                    ${rows.map(
                      (row) => html`
                        <button
                          type="button"
                          class=${this._legendRowClass(row.region, row.val.level, row.sub)}
                          @click=${() => this._openMoreInfo(row.entityId)}
                          @mouseenter=${() => this._setHovered(row.region)}
                          @mouseleave=${() => this._setHovered(undefined)}
                        >
                          <span class="legend-dot ${row.val.level ? `level-${row.val.level}` : "level-unset"}"></span>
                          <ha-icon class="legend-icon" icon=${row.icon}></ha-icon>
                          <span class="legend-label m3-body-medium">${row.label}</span>
                          <span class="legend-value m3-title-small-emphasized">${row.val.text}</span>
                        </button>
                      `
                    )}
                  </div>
                </div>
              `
            : nothing}
        </div>
      </ha-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3-body-stats-card": BodyStatsCard;
  }
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string; preview?: boolean }>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "m3-body-stats-card",
  name: "M3 Body Stats Card",
  description: "Live body-composition, sleep, and heart-rate snapshot as a tappable body map",
});
