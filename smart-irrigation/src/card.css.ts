import { css } from "lit";
import { m3Tokens, m3Type } from "./m3.css";

/**
 * Material 3 Expressive surface for the Smart Irrigation card.
 *
 * Every colour here is an M3 role from m3.css.ts — no literal hexes below
 * this line except the wave mask's data-URI, which can't take a custom
 * property (see M3-EXPRESSIVE.md pitfall 8). Shape, motion and type likewise
 * come from the token scale.
 */
export const cardStyles = css`
  ${m3Tokens}
  ${m3Type}

  /* Without this, any element mixing a percentage size with its own padding
     renders wider than intended — padding adds on top of a content-box size
     instead of eating into it. */
  :host,
  :host *,
  :host *::before,
  :host *::after {
    box-sizing: border-box;
  }

  :host {
    display: block;
    color: var(--m3-on-surface);
  }

  /* display:block is implicit in real HA (ha-card sets it internally) but has
     no default here, so it's explicit — otherwise an undefined custom element
     defaults to display:inline and collapses. */
  ha-card {
    display: block;
    position: relative;
    overflow: hidden;
    contain: content;
    /* container-type lives here (a shadow-DOM descendant), never on :host —
       :host is the element HA's sections-view grid places and measures for
       auto-row sizing, and container-type forces size/layout containment
       onto whatever it's set on. */
    container-type: inline-size;
    border-radius: var(--m3-shape-xl);
    border: none;
    background: var(--m3-surface-container-low);
    color: var(--m3-on-surface);
    box-shadow: var(--m3-elevation-1);
    transition: background var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }
  ha-card.watering {
    background: var(--m3-surface-container);
  }

  /* Sits above the ambient glow layer, which paints behind it. */
  .wrap {
    position: relative;
    z-index: 1;
    padding: 16px;
  }

  /* Ambient glow, shown only while a zone is actually watering — the one
     state on this card that is a thing happening rather than a reading. A
     glow for "dry" would be ambience for the resting state.

     The drifting layers live inside this dedicated element rather than on
     ha-card's own pseudo-elements, and that placement is load-bearing: a
     transform contributes to its container's *scrollable overflow*, so
     scale() on a pseudo-element of ha-card inflates ha-card's
     scrollWidth/scrollHeight past its client size, which is exactly what
     makes HA's sections view mis-allocate the card's grid row. inset:0 alone
     does not prevent it and neither does overflow:hidden on ha-card. This is
     its own clipping context, so the transforms are contained. See
     M3-EXPRESSIVE.md pitfall 6. */
  .glow {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    contain: paint;
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }
  ha-card.watering .glow {
    opacity: 1;
  }
  .glow::before,
  .glow::after {
    content: "";
    position: absolute;
    inset: 0;
    filter: blur(40px);
    opacity: 0.26;
    will-change: transform;
  }
  .glow::before {
    background: radial-gradient(circle at 16% 14%, var(--m3-primary), transparent 58%);
    animation: m3-glow-a 16s ease-in-out infinite;
  }
  .glow::after {
    background: radial-gradient(circle at 84% 86%, var(--m3-tertiary), transparent 58%);
    animation: m3-glow-b 20s ease-in-out infinite;
  }
  @keyframes m3-glow-a {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    50% {
      transform: translate(14px, 10px) scale(1.08);
    }
  }
  @keyframes m3-glow-b {
    0%,
    100% {
      transform: translate(0, 0) scale(1);
    }
    50% {
      transform: translate(-12px, -14px) scale(1.05);
    }
  }

  /* ---------------------------------------------------------------- header */

  .header {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  /* M3 leading icon in a shape-morphing container: a circle at rest, a
     rounded square when a zone wants attention. The morph is the state
     change — colour alone would be a weaker signal at a glance. */
  .leading-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: var(--m3-shape-full);
    background: var(--m3-surface-container-highest);
    color: var(--m3-on-surface-variant);
    transition: border-radius var(--m3-spring-spatial-default-duration) var(--m3-spring-spatial-default),
      background var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default),
      color var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }
  ha-card.watering .leading-icon {
    border-radius: var(--m3-shape-l);
    background: var(--m3-primary-container);
    color: var(--m3-on-primary-container);
  }
  ha-card.thirsty .leading-icon {
    border-radius: var(--m3-shape-l);
    background: var(--m3-dry-container);
    color: var(--m3-on-dry-container);
  }
  /* --mdc-icon-size sizes the glyph ha-icon actually draws internally;
     width/height alone size the host box, and real HA's ha-icon can leave the
     drawn glyph at its own default size regardless. The flex/line-height
     block is the companion fix: real ha-icon inherits surrounding
     line-height, which inflates its box asymmetrically and renders the glyph
     visibly off-centre inside a circular container. Neither is reproducible
     in the dev harness's mock ha-icon. */
  .leading-icon ha-icon {
    width: 26px;
    height: 26px;
    min-width: 26px;
    min-height: 26px;
    --mdc-icon-size: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
  }

  .title-text {
    flex: 1;
    min-width: 0;
  }
  .name {
    color: var(--m3-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .supporting {
    margin-top: 2px;
    color: var(--m3-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
  }

  /* ----------------------------------------------------------- icon button */

  /* M3 icon button, standard variant: state layer on hover/press and a shape
     morph from circle to rounded-square when pressed. */
  .icon-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    padding: 0;
    border: none;
    border-radius: var(--m3-shape-full);
    background: transparent;
    color: inherit;
    cursor: pointer;
    outline: none;
    overflow: hidden;
    /* Effects spring, not spatial: this radius *shrinks* on press, and an
       underdamped spring's overshoot becomes an undershoot that clamps at 0
       — the corner sits fully square for the whole excursion instead of
       easing. See M3-EXPRESSIVE.md pitfall 20. */
    transition: border-radius var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .icon-button::before {
    content: "";
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .icon-button:hover::before {
    opacity: var(--m3-state-hover);
  }
  .icon-button:active::before {
    opacity: var(--m3-state-pressed);
  }
  .icon-button:active {
    border-radius: var(--m3-shape-s);
  }
  .icon-button:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }
  .icon-button ha-icon {
    position: relative;
    width: 20px;
    height: 20px;
    min-width: 20px;
    min-height: 20px;
    --mdc-icon-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
  }
  .icon-button.small {
    width: 32px;
    height: 32px;
  }
  .icon-button.small ha-icon {
    width: 18px;
    height: 18px;
    min-width: 18px;
    min-height: 18px;
    --mdc-icon-size: 18px;
  }

  /* --------------------------------------------------------------- banners */

  .block {
    margin-top: 16px;
  }

  /* The integration's own problem sensor, with its own reason text. This is
     the only place error colour is used on the card: a dry zone is the
     system working, not a fault. */
  .problem-banner {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    max-width: 100%;
    padding: 10px 14px;
    border-radius: var(--m3-shape-l);
    background: var(--m3-error-container);
    color: var(--m3-on-error-container);
  }
  .problem-banner ha-icon {
    width: 18px;
    height: 18px;
    min-width: 18px;
    min-height: 18px;
    --mdc-icon-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 1px 0 0;
    padding: 0;
    line-height: 0;
    flex-shrink: 0;
  }
  .problem-text {
    flex: 1;
    min-width: 0;
  }

  .empty-note {
    margin-top: 16px;
    padding: 14px;
    border-radius: var(--m3-shape-l);
    background: var(--m3-surface-container-high);
    color: var(--m3-on-surface-variant);
  }

  /* ------------------------------------------------------ schedule strip */

  /* The two questions this card exists to answer on sight, so they sit above
     the zones rather than inside them: when it next runs, and when it last
     did. */
  /* auto-fit rather than a fixed two columns: with no next_schedule
     configured there is only a "Last run" tile, and a fixed grid would leave
     it stranded at half width with a hole beside it. auto-fit collapses the
     empty track, so one tile spans the row and two share it — and it drops to
     a single column on its own when the card is too narrow for two. */
  .strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 8px;
  }
  .stat {
    position: relative;
    display: block;
    width: 100%;
    min-width: 0;
    text-align: left;
    padding: 12px 14px;
    border: none;
    border-radius: var(--m3-shape-l);
    background: var(--m3-surface-container-high);
    color: var(--m3-on-surface);
    font: inherit;
    overflow: hidden;
    transition: border-radius var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
  }
  button.stat {
    cursor: pointer;
    outline: none;
  }
  .stat::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--m3-on-surface);
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  button.stat:hover::before {
    opacity: var(--m3-state-hover);
  }
  button.stat:active::before {
    opacity: var(--m3-state-pressed);
  }
  button.stat:active {
    border-radius: var(--m3-shape-xl);
    transform: scale(0.97);
  }
  button.stat:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }
  .stat-label {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    color: var(--m3-on-surface-variant);
  }
  .stat-label ha-icon {
    width: 16px;
    height: 16px;
    min-width: 16px;
    min-height: 16px;
    --mdc-icon-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
    flex-shrink: 0;
  }
  .stat-value {
    position: relative;
    /* Explicit, because these are spans: an inline box ignores overflow and
       text-overflow, so the ellipsis below would never appear. */
    display: block;
    color: var(--m3-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .stat-sub {
    position: relative;
    display: block;
    margin-top: 2px;
    color: var(--m3-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ------------------------------------------------------------ zone tile */

  .zones {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .zone {
    border-radius: var(--m3-shape-l-increased);
    background: var(--m3-surface-container-high);
    padding: 12px 14px;
  }

  .zone-head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .zone-name {
    flex: 1;
    min-width: 0;
    color: var(--m3-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .zone-body {
    display: flex;
    align-items: stretch;
    gap: 14px;
    margin-top: 10px;
  }
  .zone-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
  }

  /* ---------------------------------------------------------- the gauge */

  /* A zone's bucket, drawn as the bucket it is called.

     The zero line across the vessel is field capacity. Above it, banked rain
     fills upward toward maximum_bucket as water. Below it, a moisture deficit
     hangs downward into a hatched sump toward the marked watering point — the
     deficit at which this zone gets water.

     The two bands are *not* one continuous scale. They measure different
     things against different references, and giving them a shared one hands
     the vessel to the surplus: on a typical zone (24mm max, watering at 6mm)
     the entire dry-down gets a fifth of the height, which is backwards — the
     surplus band is empty for most of a zone's life and the deficit band is
     where every decision is made. The split is fixed instead (see
     ZERO_PERCENT in compute.ts), each band is scaled to its own end, and both
     ends are labelled on the axis so nothing is left implied. It also makes
     every zone's vessel the same shape, so a column of zones reads as
     fractions of their own dry-downs rather than as unrelated scales.

     The deficit band runs a quarter past the watering point, so the mark has
     somewhere to sit that is not the floor, and a zone that is overdue looks
     different from one that has just come due.

     An empty vessel is therefore the *normal* resting state, not an alarm:
     the bucket sits at 0 for as long as the weather and the last run leave it
     there. That is why the verdict beside the gauge is words and not just
     colour. */
  .gauge-wrap {
    display: flex;
    align-items: stretch;
    gap: 4px;
    flex-shrink: 0;
  }
  .gauge-axis {
    position: relative;
    width: 26px;
    flex-shrink: 0;
    color: var(--m3-on-surface-variant);
  }
  .tick {
    position: absolute;
    right: 0;
    width: 100%;
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .tick.top {
    top: -2px;
  }
  .tick.zero {
    top: var(--zero);
    transform: translateY(-50%);
    color: var(--m3-on-surface);
  }
  /* Aligned with the marked watering point rather than pinned to the vessel's
     floor: the mark is the number worth reading, the floor is only headroom
     past it. */
  .tick.mark {
    top: var(--mark);
    transform: translateY(-50%);
  }

  .gauge {
    position: relative;
    width: 54px;
    height: 116px;
    flex-shrink: 0;
    /* The rim overhangs the vessel by 3px each side; this padding is what
       keeps that overhang inside the gauge's own box rather than letting it
       widen the card. */
    padding: 0 4px;
  }
  .vessel {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    /* Squarer at the rim, rounder at the base: a bucket, not a bar. */
    border-radius: var(--m3-shape-xs) var(--m3-shape-xs) var(--m3-shape-m) var(--m3-shape-m);
    background: var(--m3-surface-container-highest);
    box-shadow: inset 0 0 0 2px var(--m3-outline-variant);
  }
  /* A capsule sitting proud of the vessel's sides — the one detail that makes
     the shape read as a bucket instead of a progress bar. */
  .rim {
    position: absolute;
    top: 0;
    left: 1px;
    right: 1px;
    height: 5px;
    border-radius: var(--m3-shape-full);
    background: var(--m3-outline-variant);
    z-index: 3;
  }

  /* The band below field capacity, marked whether or not it's filled, so the
     zero line always reads as a floor with something under it.

     The hatch is --m3-outline at 0.5 opacity, and both halves of that matter.
     At full strength it measures 3.86:1 (dark) / 3.46:1 (light) against the
     vessel and competes with the deficit fill drawn on top of it (1.86:1 /
     1.45:1 between them); --m3-outline-variant instead is 1.31:1 / 1.32:1 and
     too faint to read as a marked zone at all. Halving the opaque token lands
     the composite between the two, at 2.02:1 / 1.75:1 — a texture rather than
     an object, which is what a background band should be. The reduction is on
     opacity rather than in the colour because M3 role tokens are opaque — see
     M3-EXPRESSIVE.md pitfall 12.

     The gaps are wider than the measured version's 5px because this band is
     now three times taller: the same stripe at the same pitch over 62% of the
     vessel reads as a solid fill, which is exactly what the band must not
     look like when it is empty. Pitch, not tone — the measured contrast above
     is unaffected. */
  .sump {
    position: absolute;
    left: 0;
    right: 0;
    top: var(--zero);
    bottom: 0;
    opacity: 0.5;
    background: repeating-linear-gradient(
      135deg,
      var(--m3-outline) 0 2px,
      transparent 2px 7px
    );
  }

  .zero-line {
    position: absolute;
    left: 0;
    right: 0;
    top: var(--zero);
    height: 2px;
    margin-top: -1px;
    background: var(--m3-outline);
    z-index: 2;
  }

  /* Both fills are anchored to the zero line and grow away from it, which is
     what makes surplus and deficit read as directions rather than as two
     colours.

     Emphasized easing rather than a spatial spring, deliberately. The spatial
     springs are underdamped and overshoot, which is a bounce for a value that
     grows and an *undershoot* for one that shrinks — and a height clamps at
     0, so a draining fill would sit flat at the bottom through the whole
     excursion before rebounding. Same mechanism as M3-EXPRESSIVE.md pitfall
     20, applied to a length instead of a radius. */
  .fill {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 1;
    transition: height var(--m3-spring-spatial-slow-duration) var(--m3-ease-emphasized);
  }
  .fill-surplus {
    bottom: calc(100% - var(--zero));
    height: var(--surplus);
    background: var(--m3-primary);
  }
  .fill-deficit {
    top: var(--zero);
    height: var(--deficit);
    background: var(--m3-dry);
  }

  /* The water's surface. Same wave geometry as M3E's wavy progress indicator
     — the path begins and ends on a crest so the repeat has no seam (see
     M3-EXPRESSIVE.md pitfall 7) — scaled down to a 20px wavelength, because
     a 40px one shows barely half a wave across a 46px vessel. Drawn white
     and used as a mask so the water keeps its token colour through both
     themes; a data-URI can't reference a custom property (pitfall 8). */
  .crest {
    position: absolute;
    left: 0;
    right: 0;
    top: -3px;
    height: 7px;
    background: var(--m3-primary);
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='14'%3E%3Cpath d='M0 4 C6.67 4 13.33 10 20 10 S33.33 4 40 4' fill='none' stroke='white' stroke-width='4'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='14'%3E%3Cpath d='M0 4 C6.67 4 13.33 10 20 10 S33.33 4 40 4' fill='none' stroke='white' stroke-width='4'/%3E%3C/svg%3E");
    -webkit-mask-size: 20px 7px;
    mask-size: 20px 7px;
    -webkit-mask-repeat: repeat-x;
    mask-repeat: repeat-x;
    -webkit-mask-position: 0 center;
    mask-position: 0 center;
  }
  /* The surface only travels while water is actually moving. A standing
     bucket has a standing surface — animating it would imply a flow that
     isn't happening, the same reason M3E's wavy progress flattens when it
     isn't progressing. */
  .zone.watering .crest {
    animation: m3-crest-scroll 2.4s linear infinite;
  }
  @keyframes m3-crest-scroll {
    from {
      -webkit-mask-position: 0 center;
      mask-position: 0 center;
    }
    to {
      -webkit-mask-position: 20px center;
      mask-position: 20px center;
    }
  }

  /* The watering point, and the whole reason the deficit band is scaled the
     way it is: the fill reaching this line *is* the "Needs water" verdict.
     Position carries that meaning, which is why the fill keeps one colour on
     both sides of it — a second, quieter dry tone would have to be a reduced
     opacity of the same role (--m3-dry-container is 1.32:1 dark / 1.00:1
     light against the vessel, i.e. invisible), and every alpha that stayed
     distinguishable from the full-strength fill fell under the 3:1 a
     graphical object needs.

     Two variants, because the line is read against two different backgrounds
     and has to claim two different things:

     - .submerged swaps the dash to on-dry, because once the deficit covers
       the mark the line is drawn on water, not on the vessel. Measured 9.50:1
       (dark) / 13.34:1 (light) on the vessel, 7.70:1 / 6.45:1 on the fill.
     - .estimated is a finer, fainter dotted pattern for a watering point this
       card worked out rather than one the integration told it. The zone's own
       irrigation_threshold is a fact about when water will be delivered; a
       quarter of maximum_bucket is only this card's idea of when a deficit is
       worth a soak, and the two must not look alike. */
  .water-mark {
    position: absolute;
    left: 0;
    right: 0;
    top: var(--mark);
    height: 2px;
    margin-top: -1px;
    z-index: 2;
    background: repeating-linear-gradient(90deg, var(--m3-on-surface) 0 4px, transparent 4px 8px);
  }
  .water-mark.submerged {
    background: repeating-linear-gradient(90deg, var(--m3-on-dry) 0 4px, transparent 4px 8px);
  }
  .water-mark.estimated {
    opacity: 0.75;
    background: repeating-linear-gradient(90deg, var(--m3-on-surface) 0 2px, transparent 2px 5px);
  }
  .water-mark.estimated.submerged {
    background: repeating-linear-gradient(90deg, var(--m3-on-dry) 0 2px, transparent 2px 5px);
  }

  /* The deficit has run past the drawn scale, so the sump is full and can't
     say how much further. Drawn in on-dry over the full dry fill. */
  .beyond {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 1px;
    z-index: 2;
    display: flex;
    justify-content: center;
    color: var(--m3-on-dry);
  }
  .beyond ha-icon {
    width: 16px;
    height: 16px;
    min-width: 16px;
    min-height: 16px;
    --mdc-icon-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
  }

  /* --------------------------------------------------------------- verdict */

  /* Only the states that are *events* get a filled block: a zone that wants
     water, and a zone that is having it. "No water needed" is plain text on
     the tile, which keeps the card quiet in the state it is in most of the
     time and makes the fill itself mean something. */
  .verdict {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 8px 12px;
    border-radius: var(--m3-shape-m);
    background: var(--m3-surface-container-highest);
    color: var(--m3-on-surface);
  }
  .verdict.needs-water {
    background: var(--m3-dry-container);
    color: var(--m3-on-dry-container);
  }
  .verdict.watering {
    background: var(--m3-primary-container);
    color: var(--m3-on-primary-container);
  }
  /* Drying is not an event. The whole point of separating it from
     "needs water" is that a zone spends nearly all its life in it, so it gets
     the same unfilled treatment as "no water needed" and only the icon
     carries the dry role. Filling this block would put the card back in a
     permanent alarm state, which is the bug it exists to fix. */
  .verdict.drying {
    background: transparent;
    padding: 0;
  }
  .verdict.drying .verdict-icon {
    color: var(--m3-dry);
  }
  .verdict.ok {
    background: transparent;
    padding: 0;
  }
  .verdict.disabled {
    background: transparent;
    padding: 0;
    color: var(--m3-on-surface-variant);
  }
  /* The block's high-contrast anchor. A container role against the zone tile
     measures 1.54:1 (dark) / 1.05:1 (light) — same tone, different hue, which
     is the house pattern for chips and banners but does not by itself make
     the block read as an object in light theme. The glyph in the *strong*
     role is 5.46:1 / 4.99:1 on its own container and does. */
  .verdict-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    min-width: 20px;
    min-height: 20px;
    --mdc-icon-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
  }
  .verdict.needs-water .verdict-icon {
    color: var(--m3-dry);
  }
  .verdict.watering .verdict-icon {
    color: var(--m3-primary);
  }
  .verdict.ok .verdict-icon,
  .verdict.disabled .verdict-icon {
    color: var(--m3-on-surface-variant);
  }
  .verdict-text {
    min-width: 0;
  }
  .verdict-line {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .verdict-sub {
    margin-top: 1px;
    opacity: 0.86;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ------------------------------------------------------------- facts */

  .facts {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--m3-on-surface-variant);
  }
  .fact {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .fact ha-icon {
    width: 14px;
    height: 14px;
    min-width: 14px;
    min-height: 14px;
    --mdc-icon-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
    flex-shrink: 0;
  }
  .fact span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* --------------------------------------------------------------- chips */

  /* M3 assist chip. Compound class names throughout (chip-mode, not a bare
     mode modifier) — a card has one flat stylesheet, so a bare modifier is a
     global class waiting to collide with a block of the same name. See
     M3-EXPRESSIVE.md pitfall 19. */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    padding: 4px 10px;
    border-radius: var(--m3-shape-s);
    background: var(--m3-secondary-container);
    color: var(--m3-on-secondary-container);
    flex-shrink: 0;
    white-space: nowrap;
  }
  .chip.chip-quiet {
    background: var(--m3-surface-container-highest);
    color: var(--m3-on-surface-variant);
  }
  .chip ha-icon {
    width: 14px;
    height: 14px;
    min-width: 14px;
    min-height: 14px;
    --mdc-icon-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
    flex-shrink: 0;
  }

  /* ----------------------------------------------------------- details */

  /* The animated wrapper carries no spacing or border of its own — the inner
     element does — so a collapsed body truly renders nothing rather than
     leaving a stray sliver of the first child's padding. */
  .details-body {
    overflow: hidden;
    transition: max-height var(--m3-spring-spatial-slow-duration) var(--m3-ease-emphasized);
  }
  .details-inner {
    padding-top: 12px;
    margin-top: 12px;
    border-top: 1px solid var(--m3-outline-variant);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .chevron {
    transition: transform var(--m3-spring-spatial-default-duration) var(--m3-spring-spatial-default);
  }
  .zone.collapsed .chevron {
    transform: rotate(-90deg);
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 10px;
  }
  .detail {
    position: relative;
    display: block;
    width: 100%;
    min-width: 0;
    text-align: left;
    padding: 6px 8px;
    border: none;
    border-radius: var(--m3-shape-s);
    background: transparent;
    color: inherit;
    font: inherit;
    overflow: hidden;
  }
  button.detail {
    cursor: pointer;
    outline: none;
  }
  .detail::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--m3-on-surface);
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  button.detail:hover::before {
    opacity: var(--m3-state-hover);
  }
  button.detail:active::before {
    opacity: var(--m3-state-pressed);
  }
  button.detail:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 1px;
  }
  .detail-label {
    position: relative;
    display: block;
    color: var(--m3-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .detail-value {
    position: relative;
    display: block;
    margin-top: 1px;
    color: var(--m3-on-surface);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .detail-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 40px;
  }
  .detail-row > :first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--m3-on-surface-variant);
  }

  /* ------------------------------------------- connected button group (M3E) */

  /* Segments separated by a 2px gap, outer corners full and inner corners
     square. Rounding both sides of a 2px seam puts two facing curves at each
     junction and opens an hourglass void through the middle, so the segments
     read as separate pills instead of one control. */
  .button-group {
    display: flex;
    align-items: stretch;
    gap: 2px;
    flex-shrink: 0;
  }
  .segment {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    padding: 0;
    border: none;
    background: var(--m3-secondary-container);
    color: var(--m3-on-secondary-container);
    font: inherit;
    outline: none;
    position: relative;
    overflow: hidden;
    transition: border-radius var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      background var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  button.segment {
    width: 44px;
    cursor: pointer;
  }
  .segment::before {
    content: "";
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  button.segment:hover::before {
    opacity: var(--m3-state-hover);
  }
  button.segment:active::before {
    opacity: var(--m3-state-pressed);
  }
  .segment:first-child {
    border-radius: var(--m3-shape-full) var(--m3-shape-none) var(--m3-shape-none) var(--m3-shape-full);
  }
  .segment:last-child {
    border-radius: var(--m3-shape-none) var(--m3-shape-full) var(--m3-shape-full) var(--m3-shape-none);
  }
  /* Without this, :last-child beats :first-child on a lone segment and it
     renders flat down one side. */
  .segment:only-child {
    border-radius: var(--m3-shape-full);
  }
  button.segment:active {
    border-radius: var(--m3-shape-s);
    transform: scale(0.92);
  }
  button.segment:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
    z-index: 1;
  }
  .segment ha-icon {
    position: relative;
    width: 20px;
    height: 20px;
    min-width: 20px;
    min-height: 20px;
    --mdc-icon-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
  }
  /* The read-out between the buttons is a segment too, so the group reads as
     one connected control rather than a value with buttons either side. */
  .segment.value {
    min-width: 62px;
    padding: 0 10px;
    background: var(--m3-surface-container-highest);
    color: var(--m3-on-surface);
    border-radius: var(--m3-shape-none);
    font-variant-numeric: tabular-nums;
    cursor: default;
  }

  /* ------------------------------------------------------- action pills */

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pill {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: none;
    border-radius: var(--m3-shape-full);
    background: var(--m3-secondary-container);
    color: var(--m3-on-secondary-container);
    cursor: pointer;
    outline: none;
    overflow: hidden;
    font: inherit;
    transition: border-radius var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
  }
  .pill::before {
    content: "";
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .pill:hover::before {
    opacity: var(--m3-state-hover);
  }
  .pill:active::before {
    opacity: var(--m3-state-pressed);
  }
  .pill:active {
    border-radius: var(--m3-shape-s);
    transform: scale(0.94);
  }
  .pill:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }
  .pill ha-icon {
    position: relative;
    width: 18px;
    height: 18px;
    min-width: 18px;
    min-height: 18px;
    --mdc-icon-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
  }
  .pill span {
    position: relative;
  }

  /* --------------------------------------------------------- hold to run */

  /* Starting a run puts real water on real ground, so a tap does nothing:
     the button fills over --hold-ms and fires at the end. It sits apart from
     the tap-only actions above rather than inside a group with them —
     separation is a channel, and it distinguishes the consequential control
     without asking colour to do it. */
  .hold {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 10px 16px;
    border: none;
    border-radius: var(--m3-shape-full);
    background: var(--m3-surface-container-highest);
    color: var(--m3-on-surface);
    cursor: pointer;
    outline: none;
    overflow: hidden;
    font: inherit;
    /* Effects spring for the same reason as the icon button: this radius
       shrinks, and a sustained hold makes a spatial spring's undershoot
       impossible to miss. */
    transition: border-radius var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .hold.holding,
  .hold:active {
    border-radius: var(--m3-shape-m);
  }
  .hold:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }
  /* Deliberately not a motion token: the tokens collapse to 1ms under
     prefers-reduced-motion, which would leave a hold gesture with no
     indication of how long to hold. This fill is a readout of a real elapsed
     time, not decoration. The 0ms base transition is what makes release feel
     right — dropping the class snaps the fill back with no rewind. */
  .hold-fill {
    position: absolute;
    inset: 0 auto 0 0;
    width: 100%;
    background: var(--m3-primary);
    opacity: 0.3;
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform 0ms linear;
  }
  .hold.holding .hold-fill {
    transform: scaleX(1);
    transition: transform var(--hold-ms, 600ms) linear;
  }
  /* Targets the label by its own class, not by its tag. This rule used to be
     .hold span, which also matched .hold-fill — a span — and at higher
     specificity than .hold-fill's own class selector, so the absolutely
     positioned fill became an in-flow flex item 100% wide and squeezed the
     icon and label into a corner. A card has one flat stylesheet, so a bare
     tag inside a class is a wide net; see M3-EXPRESSIVE.md pitfall 19. */
  .hold ha-icon,
  .hold-label {
    position: relative;
  }
  .hold ha-icon {
    width: 18px;
    height: 18px;
    min-width: 18px;
    min-height: 18px;
    --mdc-icon-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
  }

  /* ------------------------------------------------------ narrow widths */

  /* @container, not @media: a dashboard column's width has no fixed
     relationship to the viewport, so a media query would never fire for a
     narrow card sitting in an otherwise-wide window. */
  @container (max-width: 380px) {
    .detail-grid {
      grid-template-columns: 1fr;
    }
  }
  /* Measured at 280px: every line the card cares about was truncating —
     "No water nee...", "20 min 39 s . ...", "1 of 3 zones ne...". Wrapping is
     strictly better than an ellipsis for these, because the sentence is the
     content; there is no shorter form of "No water needed" that still says
     it. The ellipsis stays on the zone *name*, where truncation is a
     recognisable label rather than a lost fact. */
  @container (max-width: 340px) {
    .supporting,
    .verdict-line,
    .verdict-sub,
    .fact span,
    .stat-value,
    .stat-sub {
      white-space: normal;
    }
  }

  @container (max-width: 300px) {
    /* A label and a fixed-width control can't share a line at this width,
       and squeezing the label still leaves the control overflowing. Stack
       instead of truncating. */
    .detail-row {
      flex-wrap: wrap;
      row-gap: 8px;
    }
    .detail-row > :first-child {
      flex: 1 0 100%;
    }
    /* The 48px leading icon plus two 40px buttons left the title 38px at
       190px wide. The smaller icon container buys some back; the rest comes
       from letting the action buttons drop to their own line, where the
       basis below is what forces the wrap. */
    .header {
      flex-wrap: wrap;
      gap: 10px;
      row-gap: 4px;
    }
    .title-text {
      flex: 1 0 calc(100% - 50px);
    }
    .header-actions {
      margin-left: auto;
    }
    .leading-icon {
      width: 40px;
      height: 40px;
    }
    .leading-icon ha-icon {
      width: 22px;
      height: 22px;
      min-width: 22px;
      min-height: 22px;
      --mdc-icon-size: 22px;
    }
    .zone-body {
      gap: 10px;
    }
    /* The axis goes entirely rather than shrinking: every number on it has a
       written-out equivalent in the details ("Bucket", "Max bucket", and
       "Waters at", which carries the marked line's depth and how far through
       it the zone is), and the zero line and the mark inside the vessel still
       show where both sit. That returns 26px to the verdict, which has no
       equivalent anywhere. */
    .gauge-axis {
      display: none;
    }
    .gauge {
      width: 40px;
      padding: 0 3px;
    }
  }

  /* Measured at 190px: even with the axis gone, the gauge, the verdict's
     leading icon and the block's padding left the verdict 58px, which wraps
     to one word a line and still ellipsises. Past here the gauge stops
     sharing a line and the text gets the card's full width — CONTRIBUTING's
     rule that below ~300px you stack rather than truncate, applied to the
     one row that still couldn't hold two things. The vessel shortens with
     it, so a bucket alone on its row doesn't cost more height than the
     reading beside it used to. */
  @container (max-width: 250px) {
    .zone-body {
      flex-wrap: wrap;
    }
    .zone-info {
      flex: 1 0 100%;
    }
    .gauge {
      height: 84px;
    }
    /* Same width squeeze one row up: a mode chip plus the chevron left
       "Veg beds" 36px and rendered it "V..". The chip is the only one of
       the three that reads correctly on a line of its own, so it takes
       one — order puts it after the chevron, and the name's content basis
       is what keeps the wrap where it belongs. */
    .zone-head {
      flex-wrap: wrap;
      row-gap: 6px;
    }
    .zone-name {
      flex: 1 1 auto;
      white-space: normal;
    }
    .zone-head .chip {
      order: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .glow::before,
    .glow::after {
      animation: none;
    }
    .zone.watering .crest {
      animation: none;
    }
  }
`;
