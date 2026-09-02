import { css } from "lit";
import { m3Tokens, m3Type } from "./m3.css";

/**
 * Material 3 Expressive surface for the gym tracker card.
 *
 * Every colour here is an M3 role from m3.css.ts — no literal hexes below
 * this line. Shape, motion and type likewise come from the token scale, so
 * "make it bouncier" or "reseed the palette" is a change in one file.
 */
export const cardStyles = css`
  ${m3Tokens}
  ${m3Type}

  /* Without this, any element that mixes a percentage width with its own
     padding renders wider than intended — padding adds on top of a
     content-box width instead of eating into it. */
  :host,
  :host *,
  :host *::before,
  :host *::after {
    box-sizing: border-box;
  }

  :host {
    display: block;
    color: var(--m3-on-surface);

    /* Adherence level, aliased once here so no component rule has to know
       that levels exist — data-level on the host swaps these three and the
       ring, the leading icon and the settings header all follow through
       inheritance. They are aliases of M3 roles, not roles themselves. */
    --gym-level: var(--m3-outline);
    --gym-level-container: var(--m3-surface-container-highest);
    --gym-on-level-container: var(--m3-on-surface-variant);
  }
  :host([data-level="good"]) {
    --gym-level: var(--m3-success);
    --gym-level-container: var(--m3-success-container);
    --gym-on-level-container: var(--m3-on-success-container);
  }
  :host([data-level="ok"]) {
    --gym-level: var(--m3-warning);
    --gym-level-container: var(--m3-warning-container);
    --gym-on-level-container: var(--m3-on-warning-container);
  }
  :host([data-level="bad"]) {
    --gym-level: var(--m3-error);
    --gym-level-container: var(--m3-error-container);
    --gym-on-level-container: var(--m3-on-error-container);
  }

  /* display:block is implicit in real HA (ha-card sets it internally) but
     has no default here, so it's explicit — otherwise an undefined custom
     element defaults to display:inline and collapses. */
  ha-card {
    display: block;
    position: relative;
    overflow: hidden;
    contain: content;
    /* container-type lives here (a shadow-DOM descendant), never on :host —
       :host is the actual gym-tracker-card element HA's sections-view grid
       places and measures for auto-row sizing, and container-type forces
       size/layout containment onto whatever it's set on. Keeping it on
       ha-card leaves the container queries below working for descendants
       without applying containment to the element the outer grid depends
       on. */
    container-type: inline-size;
    border-radius: var(--m3-shape-xl);
    border: none;
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
  .header.toggle {
    cursor: pointer;
    user-select: none;
  }
  .header:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 3px;
  }

  /* M3 leading icon in a shape-morphing container, carrying the adherence
     level's tonal pair. The morph is part of the signal: a full circle is
     the settled, on-target form, and anything short of the goal squares off
     to a rounded square. Colour alone would be the weaker read at a glance,
     and it is the only cue for anyone who can't separate green from amber. */
  .leading-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: var(--m3-shape-l);
    background: var(--gym-level-container);
    color: var(--gym-on-level-container);
    transition: border-radius var(--m3-spring-spatial-default-duration) var(--m3-spring-spatial-default),
      background var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default),
      color var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }
  :host([data-level="good"]) .leading-icon {
    border-radius: var(--m3-shape-full);
  }
  /* --mdc-icon-size sizes the glyph ha-icon actually draws internally;
     width/height alone size the host box, and real HA's ha-icon can leave
     the drawn glyph at its own default size regardless. The flex/line-height
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

  /* ------------------------------------------------------------------ hero */

  .hero {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-top: 16px;
  }

  /* ---- determinate circular progress, M3 Expressive shape ----
     Active arc, a gap, then the remaining track — the circular counterpart
     of the expressive linear indicator's active/gap/track split, and the
     reason the track is drawn as its own dashed arc rather than a full
     circle sitting underneath. No wave and no animation: an animated
     indicator implies work in progress, and year-to-date gym adherence is
     a standing figure, not a running task. */
  .ring-block {
    position: relative;
    width: 116px;
    height: 116px;
    flex-shrink: 0;
  }
  .ring {
    display: block;
    width: 100%;
    height: 100%;
    /* Rotates the SVG's default 3-o'clock start point to 12 o'clock. */
    transform: rotate(-90deg);
  }
  .ring-track {
    fill: none;
    stroke: var(--m3-outline-variant);
    stroke-width: 9;
    /* Butt caps here, round on the active arc: two round caps facing each
       other would each eat half a stroke width out of the gap between
       them, closing a 10-unit gap down to about 1. */
    stroke-linecap: butt;
    transition: stroke-dasharray var(--m3-spring-spatial-slow-duration) var(--m3-spring-spatial-slow),
      stroke-dashoffset var(--m3-spring-spatial-slow-duration) var(--m3-spring-spatial-slow);
  }
  .ring-fill {
    fill: none;
    stroke: var(--gym-level);
    stroke-width: 9;
    stroke-linecap: round;
    transition: stroke-dasharray var(--m3-spring-spatial-slow-duration) var(--m3-spring-spatial-slow),
      stroke var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }
  /* Two nested flex boxes on purpose: the outer one centres the read-out in
     the ring, the inner one puts the percent sign on the numeral's baseline.
     Doing both on one box does not work — align-items:baseline on a
     full-height container aligns the whole line to the top of the ring
     rather than to its centre. */
  .ring-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .ring-value {
    display: flex;
    align-items: baseline;
  }
  .ring-pct {
    color: var(--m3-on-surface);
    font-variant-numeric: tabular-nums;
  }
  /* The percent sign is set small so the numeral itself can stay at display
     size inside the ring's 87px inner circle — "100%" at 36px would not
     clear the stroke. */
  .ring-unit {
    margin-left: 1px;
    color: var(--m3-on-surface-variant);
  }

  /* ---- money read-out ----
     Two stacked rows rather than one figure: money wasted on its own reads
     as pure guilt-tripping with no context for whether that's a little or a
     lot, and pairing it with what the attended visits are worth gives the
     same cost model both a good and a bad side. */
  .money-block {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    border-radius: var(--m3-shape-l);
    background: var(--m3-surface-container-high);
    overflow: hidden;
  }
  .money-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    min-width: 0;
  }
  .money-row + .money-row {
    border-top: 1px solid var(--m3-outline-variant);
  }
  .money-row.good {
    --money-colour: var(--m3-success);
    --money-container: var(--m3-success-container);
    --money-on-container: var(--m3-on-success-container);
  }
  .money-row.bad {
    --money-colour: var(--m3-error);
    --money-container: var(--m3-error-container);
    --money-on-container: var(--m3-on-error-container);
  }
  .money-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: var(--m3-shape-full);
    background: var(--money-container);
    color: var(--money-on-container);
  }
  .money-badge ha-icon {
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
  .money-text {
    flex: 1;
    min-width: 0;
  }
  .money-label {
    color: var(--m3-on-surface-variant);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .money-value {
    color: var(--money-colour);
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ------------------------------------------------------------- settings */

  /* The animated wrapper carries no spacing or border of its own — .section
     carries the padding and the divider — so a collapsed (max-height:0)
     body truly renders nothing, rather than leaving that padding as a stray
     gap outside the clipped content area. A spring's overshoot on
     max-height would be invisible anyway (the clip is briefly larger than
     the content), so this one takes the emphasized easing instead. */
  .card-body {
    overflow: hidden;
    transition: max-height var(--m3-spring-spatial-slow-duration) var(--m3-ease-emphasized);
  }
  .section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--m3-outline-variant);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .section-title {
    color: var(--m3-on-surface-variant);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 40px;
  }
  /* The label side shrinks and truncates first; every control on the right
     carries flex-shrink:0 so it never gets squeezed below a usable size. */
  .row > :first-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--m3-on-surface-variant);
  }

  /* ------------------------------------------- connected button group (M3E) */

  /* One connected pill divided by 2px seams, with a shape morph on press
     where the pressed segment rounds off and shrinks.

     Inner corners are square, not the shape-s the house recipe used to
     specify. Rounding both sides of a 2px seam puts two facing curves at
     each junction and opens an hourglass-shaped void through the middle of
     the group, which makes the segments read as separate pills — the exact
     thing a connected group exists to avoid. Squaring them leaves a clean
     seam down the full height. */
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
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      background var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast),
      color var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
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
  /* The read-out between the two steppers is a segment too, so the group
     reads as one connected control rather than a value with buttons
     floating either side of it. */
  .segment.value {
    min-width: 56px;
    padding: 0 10px;
    background: var(--m3-surface-container-highest);
    color: var(--m3-on-surface);
    border-radius: var(--m3-shape-none);
    font-variant-numeric: tabular-nums;
    cursor: default;
  }
  /* The selected unit is filled with the accent itself, not with
     primary-container. Measured: primary-container against the group's
     secondary-container is 1.00:1 in dark and 1.01:1 in light — the same
     luminance, so in light theme (two pale tints) the selected segment was
     simply invisible, and dark only got away with it on hue. Filled primary
     is 5.51:1 / 4.98:1 against its unselected sibling and carries its own
     text at 7.72:1 / 6.46:1. */
  .segment.selected {
    background: var(--m3-primary);
    color: var(--m3-on-primary);
  }
  button.segment.unit {
    width: 42px;
  }

  /* The cost field is the last segment of its own connected group, so
     editing the number reads as part of the same control as the /mo and
     /yr choice rather than a stray input parked beside it. */
  input.segment.cost-input {
    width: 78px;
    padding: 0 10px;
    text-align: right;
    background: var(--m3-surface-container-highest);
    color: var(--m3-on-surface);
    font-variant-numeric: tabular-nums;
    cursor: text;
  }
  input.segment.cost-input:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
    z-index: 1;
  }
  /* The browser's built-in number spinner arrows don't match this design
     language and get visually cramped by the segment's padding — hidden in
     favour of the /mo and /yr segments already sitting next to the field. */
  input.cost-input::-webkit-inner-spin-button,
  input.cost-input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input.cost-input[type="number"] {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  /* Inert read-out pill, same tone as the value segment above so the two
     read as the same kind of thing. */
  .value-readout {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    height: 40px;
    padding: 0 14px;
    border-radius: var(--m3-shape-full);
    background: var(--m3-surface-container-highest);
    color: var(--m3-on-surface);
    font-variant-numeric: tabular-nums;
  }

  /* ------------------------------------------------------ narrow widths */

  /* @container, not @media: a dashboard column's width has no fixed
     relationship to the viewport, so a media query never fires for a narrow
     card sitting in a wide window.

     The ring is 116px and the money block needs roughly 170px to keep
     "Invested this year" on one line beside its value, so the hero stacks
     before either has to give. */
  @container (max-width: 330px) {
    .hero {
      flex-direction: column;
      align-items: stretch;
    }
    .ring-block {
      align-self: center;
    }
  }

  /* Below 300px a label and a fixed-width control genuinely cannot share a
     line — squeezing the label still leaves the control overflowing — so
     the control moves under its label instead of the label truncating. */
  @container (max-width: 300px) {
    .row {
      flex-wrap: wrap;
      row-gap: 8px;
    }
    .row > :first-child {
      flex: 1 0 100%;
    }
    /* The 48px leading icon plus the chevron leave the title almost nothing
       at this width; the smaller container buys back 8px. */
    .header {
      gap: 10px;
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
  }
`;
