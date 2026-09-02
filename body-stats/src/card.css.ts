import { css } from "lit";
import { m3Tokens, m3Type } from "./m3.css";

/**
 * Material 3 Expressive surface for the body stats card.
 *
 * Every colour here is an M3 role from m3.css.ts — no literal hexes below
 * this line. Shape, motion and type likewise come from the token scale.
 */
export const cardStyles = css`
  ${m3Tokens}
  ${m3Type}

  /* Without this, any element that mixes a percentage width with its own
     padding renders wider than intended. */
  :host,
  :host *,
  :host *::before,
  :host *::after {
    box-sizing: border-box;
  }

  :host {
    display: block;
    color: var(--m3-on-surface);

    /* ---- the three health levels, aliased once ----
       Every reading on this card resolves to good / ok / bad / unset, and
       four different components render that: silhouette fills, limb strokes,
       vital pins and legend dots. Rather than each carrying four variants,
       one class sets these properties and the components read them. Adding a
       level, or restyling one, is a change here and nowhere else. Aliases of
       M3 roles, not roles themselves. */
    --lvl: var(--m3-outline);
    --on-lvl: var(--m3-surface);
  }
  .level-good {
    --lvl: var(--m3-success);
    --on-lvl: var(--m3-on-success);
  }
  .level-ok {
    --lvl: var(--m3-warning);
    --on-lvl: var(--m3-on-warning);
  }
  .level-bad {
    --lvl: var(--m3-error);
    --on-lvl: var(--m3-on-error);
  }
  .level-unset {
    --lvl: var(--m3-surface-container-highest);
    --on-lvl: var(--m3-on-surface-variant);
  }

  /* display:block is implicit in real HA but has no default here, so it's
     explicit — otherwise an undefined custom element defaults to
     display:inline and collapses. */
  ha-card {
    display: block;
    position: relative;
    border-radius: var(--m3-shape-xl);
    border: none;
    overflow: hidden;
    contain: content;
    /* container-type lives here (a shadow-DOM descendant), not on :host —
       :host is the actual element HA's sections-view grid measures for
       auto-row sizing, and container-type forces containment onto whatever
       it's set on. */
    container-type: inline-size;
    background: var(--m3-surface-container-low);
    color: var(--m3-on-surface);
    box-shadow: var(--m3-elevation-1);
  }

  .wrap {
    padding: 16px;
  }

  /* ---------------------------------------------------------------- header */

  .header {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
    border-radius: var(--m3-shape-l);
    outline: none;
  }
  /* The header carries the only expand/collapse control on this card (no
     nested per-region toggle) — clicking it reveals .legend-wrap below,
     which stays fully absent from the collapsed view rather than peeking
     through as a persistent list. */
  .header.toggle {
    cursor: pointer;
    user-select: none;
  }
  .header:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 3px;
  }

  .leading-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: var(--m3-shape-l);
    background: var(--m3-primary-container);
    color: var(--m3-on-primary-container);
  }
  /* --mdc-icon-size sizes the glyph ha-icon actually draws internally;
     width/height alone size the host box, and real HA's ha-icon can leave the
     drawn glyph at its own default size regardless. The flex/line-height
     block is the companion fix, and it is the one that actually works: real
     ha-icon inherits surrounding line-height, which inflates its box
     asymmetrically and renders the glyph visibly off-centre. A translateY
     nudge was tried on this card first — backed by a pixel measurement off a
     live screenshot — and did not hold up, because it is not a
     transform-shaped problem. Neither issue reproduces in the dev harness,
     whose mock ha-icon has no inherited line-height to begin with. */
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
  }

  .chevron {
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
    color: var(--m3-on-surface-variant);
    transition: transform var(--m3-spring-spatial-default-duration) var(--m3-spring-spatial-default);
  }
  .chevron.collapsed {
    transform: rotate(-90deg);
  }

  /* Weight/BMI don't map to a body part cleanly (see compute.ts) — they get
     a tonal read-out tile in the header instead of a silhouette region. */
  .weight-chip {
    position: relative;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    padding: 6px 12px;
    border: none;
    border-radius: var(--m3-shape-m);
    background: var(--m3-surface-container-high);
    color: var(--m3-on-surface);
    font: inherit;
    cursor: pointer;
    outline: none;
    overflow: hidden;
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
  }
  .weight-chip::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--m3-on-surface);
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .weight-chip:hover::before,
  .weight-chip.hovered::before {
    opacity: var(--m3-state-hover);
  }
  .weight-chip:active::before {
    opacity: var(--m3-state-pressed);
  }
  .weight-chip:active {
    border-radius: var(--m3-shape-l);
    transform: scale(0.95);
  }
  .weight-chip:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }
  .wc-value {
    position: relative;
    color: var(--lvl);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .weight-chip.level-unset .wc-value {
    color: var(--m3-on-surface);
  }
  .wc-sub {
    position: relative;
    margin-top: 1px;
    color: var(--m3-on-surface-variant);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* --- Body map ------------------------------------------------------- */

  .body-map-wrap {
    position: relative;
    width: 100%;
    max-width: 200px;
    margin: 18px auto 0;
  }
  /* Tiny tap targets on an SVG silhouette stop being usable below this
     width — the legend list is the reliable interactive surface at every
     size, so the decorative silhouette just steps aside rather than
     shrinking into something unreadable/untappable. */
  @container (max-width: 260px) {
    .body-map-wrap {
      display: none;
    }
  }

  .silhouette {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }

  /* ---- the figure's ink ----
     The edge separating one coloured body part from the next. It is
     surface-container-lowest — near-black in dark, pure white in light —
     which is the one declaration that lands correctly in both themes.

     It used to be a fixed dark tone in both, on the reasoning that its job
     is separating segments rather than blending with the card. That held
     while the fills were the old scheme's pastels, but M3's light-theme
     semantic colours are much darker (T40 tones), and a dark ink on a dark
     green leg measured 2.08:1 — the line-art all but vanished. Measured
     across the three levels: the old fixed ink gave 4.04/3.91/3.49 dark and
     2.91/3.06/2.47 light; this gives 11.29/11.33/11.36 and 6.44/6.46/6.46. */
  .structure {
    fill: var(--m3-surface-container-highest);
    stroke: var(--m3-outline);
    stroke-width: 2;
  }

  .region {
    cursor: pointer;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast),
      fill var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default),
      stroke var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
    transform-box: fill-box;
    transform-origin: center;
    outline: none;
  }
  .region:hover {
    opacity: 0.88;
  }

  /* Filled regions (head, torso) — a solid status colour with an ink edge so
     adjacent segments read as distinct body parts rather than one blob. */
  .region-fill {
    fill: var(--lvl);
    stroke: var(--m3-surface-container-lowest);
    stroke-width: 2.5;
    stroke-linejoin: round;
  }
  /* An unset region has no status colour, so the ink would have nothing to
     separate it from — it takes the outline role instead, which is the one
     that reads against a neutral fill AND against the card behind it
     (3.86:1 / 3.46:1 on the fill, 5.41:1 / 4.04:1 against the card). */
  .region-fill.level-unset {
    stroke: var(--m3-outline);
    cursor: default;
  }
  .region-fill.hovered,
  .region-fill:focus-visible {
    stroke: var(--m3-on-surface);
    stroke-width: 3;
  }

  /* Eyes: small flat dots in the exact same fill+edge language as every
     other region (no contrasting sclera/cartoon-eye treatment — that read
     as out of place against the rest of the flat, coloring-book figure).
     Just a scaled-down .region-fill with a thinner edge to suit something
     this small. */
  .eye-dot {
    stroke-width: 1px;
  }
  .eye-dot.hovered,
  .eye-dot:focus-visible {
    stroke-width: 1.5px;
  }

  /* Stroked regions (arms, legs) — a thick round-capped centerline stroke
     reads as a tapered limb far better than a filled rectangle. Each is
     drawn twice: a wider ink pass underneath, then the status-coloured
     stroke slightly narrower on top, giving the limb the same edge the
     torso and head get from their own stroke. */
  .limb-outline {
    fill: none;
    stroke: var(--m3-surface-container-lowest);
    stroke-width: 34;
    stroke-linecap: round;
    pointer-events: none;
  }
  /* Same rule as .region-fill.level-unset: an unset limb has no colour for
     the ink to separate, and in light theme a white ink pass under a pale
     grey stroke on a near-white card left the limb with no discernible edge
     at all (1.29:1). The outline role reads against both. */
  .limb-outline.level-unset {
    stroke: var(--m3-outline);
  }
  .region-stroke {
    fill: none;
    stroke: var(--lvl);
    stroke-width: 28;
    stroke-linecap: round;
  }
  .region-stroke.level-unset {
    cursor: default;
  }
  .region-stroke.hovered,
  .region-stroke:focus-visible {
    stroke-width: 30;
  }

  /* Small pins for vitals that don't fill a whole body part — heart rate
     sits on the chest, water/protein sit at the waistline like a belt.

     The plate is the ink tone, NOT the pin's own level colour, and the ring
     and glyph carry the level instead. A tonal pin was tried and is wrong
     here for a reason specific to this card: a pin's level is usually the
     same as the level of the region it sits on (a bad water reading tends to
     accompany a bad torso), so a level-coloured plate on a level-coloured
     body part is 1.00:1 by construction — the pin dissolves into the limb.
     The adjacency that matters for a pin is plate-against-region, not
     glyph-against-plate; measuring only the latter is what missed it.
     Against the ink tone the plate reads 11.29:1 dark / 6.44:1 light on
     every coloured region. */
  .badge {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 25px;
    height: 25px;
    padding: 0;
    border: 2px solid var(--lvl);
    border-radius: var(--m3-shape-full);
    background: var(--m3-surface-container-lowest);
    color: var(--lvl);
    transform: translate(-50%, -50%);
    cursor: pointer;
    outline: none;
    transition: transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      background var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default),
      color var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }
  .badge:hover,
  .badge.hovered {
    transform: translate(-50%, -50%) scale(1.15);
  }
  .badge:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }
  /* An unset pin on an unset limb is the one case the ink plate can't carry
     (1.57:1 dark / 1.29:1 light against a neutral region) — the ring takes
     the outline role, which reads against it at 3.86:1 / 3.46:1. */
  .badge.level-unset {
    border-color: var(--m3-outline);
    color: var(--m3-on-surface-variant);
    cursor: default;
  }
  /* See .leading-icon ha-icon above for why this block exists. */
  .badge ha-icon {
    width: 13px;
    height: 13px;
    min-width: 13px;
    min-height: 13px;
    --mdc-icon-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
  }
  /* A "sub reason" badge (visceral fat, sitting on the torso it colours
     alongside body fat) — smaller and thinner-bordered than a standalone
     vital's pin, so it reads as a detail of the region under it rather
     than its own body part. */
  .badge.sub {
    width: 19px;
    height: 19px;
    border-width: 1.5px;
  }
  .badge.sub ha-icon {
    width: 10px;
    height: 10px;
    min-width: 10px;
    min-height: 10px;
    --mdc-icon-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
  }

  /* --- Legend ---------------------------------------------------------- */

  /* The animated wrapper itself carries no spacing/border of its own —
     .legend carries the margin/padding/border — so a collapsed
     (max-height:0) body truly renders nothing, rather than leaving that
     spacing as a stray gap outside the clipped content area. A spring's
     overshoot on max-height would be invisible anyway, so this takes the
     emphasized easing instead. */
  .legend-wrap {
    overflow: hidden;
    transition: max-height var(--m3-spring-spatial-slow-duration) var(--m3-ease-emphasized);
  }
  .legend {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--m3-outline-variant);
  }
  .legend-row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 40px;
    padding: 6px 10px;
    border: none;
    border-radius: var(--m3-shape-m);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    outline: none;
    overflow: hidden;
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
  }
  .legend-row::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--m3-on-surface);
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .legend-row:hover::before,
  .legend-row.hovered::before {
    opacity: var(--m3-state-hover);
  }
  .legend-row:active::before {
    opacity: var(--m3-state-pressed);
  }
  .legend-row:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: -3px;
  }
  /* Unlike a silhouette region (which can be "unset" because no entity was
     ever configured for it), every legend row that reaches the DOM has an
     entity — "unset" here only means its current state is unknown, so the
     row stays clickable (more-info still helps diagnose that), just dimmed. */
  .legend-row.level-unset {
    opacity: 0.55;
  }
  /* A "sub reason" row (visceral fat under body fat, eyesight under sleep,
     BMI under weight) — indented under the row above it, with a thin
     connector so the hierarchy reads the same way it does on the body map
     (a small badge sitting on its parent region). */
  .legend-row.sub {
    /* width:100% resolves against the parent regardless of this row's own
       margin, so margin-left alone would push the row 22px past the
       parent's right edge — width has to shrink by the same amount or the
       value column runs into (or past) the card's padding. */
    width: calc(100% - 22px);
    margin-left: 22px;
    padding-left: 10px;
    border-left: 2px solid var(--m3-outline-variant);
    border-radius: var(--m3-shape-xs) var(--m3-shape-m) var(--m3-shape-m) var(--m3-shape-xs);
  }
  .legend-row.sub .legend-icon {
    width: 14px;
    height: 14px;
    min-width: 14px;
    min-height: 14px;
    --mdc-icon-size: 14px;
  }
  .legend-dot {
    position: relative;
    width: 10px;
    height: 10px;
    border-radius: var(--m3-shape-full);
    flex-shrink: 0;
    background: var(--lvl);
    transition: background var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }
  .legend-icon {
    position: relative;
    width: 18px;
    height: 18px;
    min-width: 18px;
    min-height: 18px;
    --mdc-icon-size: 18px;
    flex-shrink: 0;
    color: var(--m3-on-surface-variant);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
  }
  .legend-label {
    position: relative;
    flex: 1;
    min-width: 0;
    color: var(--m3-on-surface-variant);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .legend-value {
    position: relative;
    color: var(--m3-on-surface);
    white-space: nowrap;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  .empty {
    margin-top: 16px;
    padding: 24px 16px;
    text-align: center;
    color: var(--m3-on-surface-variant);
    background: var(--m3-surface-container-high);
    border-radius: var(--m3-shape-l);
  }
`;
