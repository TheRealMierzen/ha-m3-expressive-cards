import { css } from "lit";
import { m3Tokens, m3Type } from "./m3.css";

/**
 * Material 3 Expressive surface for the geyser card.
 *
 * Every colour here is an M3 role from m3.css.ts — no literal hexes below
 * this line except the two mask data-URIs, which can't take a custom
 * property. Shape, motion and type likewise come from the token scale, so
 * "make it bouncier" or "reseed the palette" is a change in one file.
 */
export const cardStyles = css`
  ${m3Tokens}
  ${m3Type}

  /* Without this, any element that mixes a percentage width with its own
     padding (e.g. the override banner's max-width:100% plus its padding)
     renders wider than intended — padding adds on top of a content-box
     width instead of eating into it. A real horizontal overflow for
     anything actually hitting its max-width at narrow card widths. */
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

  /* display:block is implicit in real HA (ha-card sets it internally) but
     has no default here, so it's explicit — otherwise an undefined custom
     element defaults to display:inline and collapses. */
  ha-card {
    display: block;
    position: relative;
    overflow: hidden;
    contain: content;
    /* container-type lives here (a shadow-DOM descendant), never on :host —
       :host is the actual <geyser-status-card> element HA's sections-view
       grid places and measures for auto-row sizing, and container-type
       forces size/layout containment onto whatever it's set on. Keeping it
       on ha-card leaves @container working for descendants without
       applying containment to the element the outer grid depends on. */
    container-type: inline-size;
    /* M3 shape scale: extra-large is the card's corner. */
    border-radius: var(--m3-shape-xl);
    border: none;
    background: var(--m3-surface-container-low);
    color: var(--m3-on-surface);
    box-shadow: var(--m3-elevation-1);
    transition: background var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }
  ha-card.on {
    background: var(--m3-surface-container);
  }

  /* Sits above the ambient glow layers, which paint behind it. */
  .wrap {
    position: relative;
    z-index: 1;
    padding: 16px;
  }

  /* Ambient glow while the geyser is on: two blurred radial blobs drifting
     behind the content, tinted by whichever accent the mode has swapped in.

     The drifting layers live inside this dedicated .glow element rather than
     on ha-card's own ::before/::after, and that placement is load-bearing.
     A transform contributes to its container's *scrollable overflow*, so
     scale(1.08) on a pseudo-element of ha-card inflated ha-card's
     scrollWidth/scrollHeight past its clientWidth/clientHeight — measured at
     up to 13px, varying continuously as the animation ran. inset:0 alone
     does not prevent this; it only keeps the layout box the right size, and
     the transform then puts the painted result back outside it. If HA's
     sections-view reflow logic reads scrollHeight rather than the visual
     box, that drifting mismatch is exactly what makes it under- or
     over-allocate the card's grid row. .glow is its own clipping context
     (overflow:hidden + contain:paint), so the transforms are contained and
     ha-card's scroll size now matches its client size exactly. */
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
  ha-card.on .glow {
    opacity: 1;
  }
  .glow::before,
  .glow::after {
    content: "";
    position: absolute;
    inset: 0;
    filter: blur(40px);
    opacity: 0.28;
    will-change: transform;
  }
  .glow::before {
    background: radial-gradient(circle at 18% 12%, var(--m3-primary), transparent 58%);
    animation: m3-glow-a 16s ease-in-out infinite;
  }
  .glow::after {
    background: radial-gradient(circle at 82% 88%, var(--m3-tertiary), transparent 58%);
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
    cursor: pointer;
    min-width: 0;
    border-radius: var(--m3-shape-l);
    outline: none;
  }
  .header:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 3px;
  }

  /* M3 leading icon in a shape-morphing container: a circle while off, a
     squircle-ish rounded square while on. The morph is the state change —
     colour alone would be a weaker signal at a glance. */
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
  ha-card.on .leading-icon {
    border-radius: var(--m3-shape-l);
    background: var(--m3-primary-container);
    color: var(--m3-on-primary-container);
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

  /* ---------------------------------------------------------------- switch */

  /* M3 switch: 52x32 track, 16px thumb when off, 24px when on, 28px while
     pressed. The thumb grows and travels on a spatial spring, so it visibly
     overshoots and settles — that bounce is the expressive motion scheme
     doing its job, not an accident of the easing curve. */
  .m3-switch {
    position: relative;
    width: 52px;
    height: 32px;
    flex-shrink: 0;
    border-radius: var(--m3-shape-full);
    background: var(--m3-surface-container-highest);
    border: 2px solid var(--m3-outline);
    cursor: pointer;
    outline: none;
    transition: background var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default),
      border-color var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }
  .m3-switch.on {
    background: var(--m3-primary);
    border-color: var(--m3-primary);
  }
  .m3-switch:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 3px;
  }
  .m3-switch-thumb {
    position: absolute;
    top: 50%;
    left: 14px;
    width: 16px;
    height: 16px;
    margin: -8px 0 0 -8px;
    border-radius: var(--m3-shape-full);
    background: var(--m3-outline);
    color: var(--m3-surface-container-highest);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: left var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      width var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      height var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      margin var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      background var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }
  .m3-switch.on .m3-switch-thumb {
    left: 34px;
    width: 24px;
    height: 24px;
    margin: -12px 0 0 -12px;
    background: var(--m3-on-primary);
    color: var(--m3-primary);
  }
  .m3-switch:active .m3-switch-thumb {
    width: 28px;
    height: 28px;
    margin: -14px 0 0 -14px;
  }
  /* The thumb icon only exists in the on state; it fades rather than
     appearing abruptly mid-travel. */
  .m3-switch-thumb ha-icon {
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
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .m3-switch.on .m3-switch-thumb ha-icon {
    opacity: 1;
  }

  /* --------------------------------------------------------------- banners */

  .block {
    margin-top: 16px;
  }

  /* Tonal banner for the active shower override — tertiary-container so it
     reads as a distinct, non-alarming aside rather than competing with the
     primary heat colour. */
  .override-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 100%;
    padding: 10px 10px 10px 14px;
    border-radius: var(--m3-shape-l);
    background: var(--m3-tertiary-container);
    color: var(--m3-on-tertiary-container);
  }
  .override-banner ha-icon.banner-icon {
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
    flex-shrink: 0;
  }
  .override-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ----------------------------------------------------------- icon button */

  /* M3 icon button, standard variant: 40x40 target, 24px glyph, state layer
     on hover/press, and a shape morph from circle to rounded-square when
     pressed. */
  .icon-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: var(--m3-shape-full);
    background: transparent;
    color: inherit;
    cursor: pointer;
    outline: none;
    overflow: hidden;
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
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

  /* ------------------------------------------------------------- hero temp */

  .hero {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 2px 10px;
  }
  .hero-temp {
    color: var(--m3-on-surface);
    font-variant-numeric: tabular-nums;
  }
  .hero-target {
    color: var(--m3-on-surface-variant);
  }

  /* -------------------------------------------------- wavy progress (M3E) */

  /* The signature M3 Expressive linear indicator: a wavy active track, a
     4dp gap, a flat remaining track, and a stop indicator at the end.
     The wave is a repeating SVG stroke used as a mask, not a background
     image, so its colour is still a custom property — a data-URI can't
     reference one. mask-size matches the SVG's 40px wavelength.

     The tile starts and ends at a wave *crest*, not at a zero-crossing,
     and that is what makes it tile without a seam. Matching y and slope
     across the boundary is NOT sufficient: a stroke's butt cap is drawn
     perpendicular to the path direction, so where the path crossed the
     edge on a slope the 4px-wide cap reached x = -1.03 and x = 41.03 —
     outside the SVG's own 40x14 viewport, which clips it. Every tile lost
     that triangular sliver, and the repeat showed a visible notch at each
     wavelength. At a crest the tangent is horizontal, so the cap is a
     vertical line lying exactly on the tile edge with nothing outside it,
     and consecutive tiles abut precisely.

     Hence cubic segments whose controls share their endpoint's y
     (horizontal tangents at x=0, 20 and 40) rather than the quadratics
     this started as. Crest y=4, trough y=10, centre 7, so with
     stroke-width 4 the ink spans y=2..12 — inside the 14px box. */
  .wave {
    position: relative;
    height: 14px;
    margin-top: 10px;
  }
  .wave-active {
    position: absolute;
    left: 0;
    top: 0;
    height: 14px;
    background: var(--m3-primary);
    -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='14'%3E%3Cpath d='M0 4 C6.67 4 13.33 10 20 10 S33.33 4 40 4' fill='none' stroke='white' stroke-width='4'/%3E%3C/svg%3E");
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='14'%3E%3Cpath d='M0 4 C6.67 4 13.33 10 20 10 S33.33 4 40 4' fill='none' stroke='white' stroke-width='4'/%3E%3C/svg%3E");
    -webkit-mask-size: 40px 14px;
    mask-size: 40px 14px;
    -webkit-mask-repeat: repeat-x;
    mask-repeat: repeat-x;
    -webkit-mask-position: 0 center;
    mask-position: 0 center;
    animation: m3-wave-scroll 1.4s linear infinite;
    transition: width var(--m3-spring-spatial-slow-duration) var(--m3-spring-spatial-slow);
  }
  /* Cooling: no active heating, so the wave flattens to the plain M3 linear
     indicator rather than animating a wave that implies work in progress. */
  .wave.flat .wave-active {
    -webkit-mask-image: none;
    mask-image: none;
    animation: none;
    height: 4px;
    top: 5px;
    border-radius: var(--m3-shape-full);
  }
  @keyframes m3-wave-scroll {
    from {
      -webkit-mask-position: 0 center;
      mask-position: 0 center;
    }
    to {
      -webkit-mask-position: 40px center;
      mask-position: 40px center;
    }
  }
  .wave-track {
    position: absolute;
    right: 0;
    top: 5px;
    height: 4px;
    border-radius: var(--m3-shape-full);
    background: var(--m3-secondary-container);
    transition: left var(--m3-spring-spatial-slow-duration) var(--m3-spring-spatial-slow);
  }
  /* M3's stop indicator: a dot pinned at the track's end, marking full
     scale so a nearly-complete bar still reads as "not done". */
  .wave-stop {
    position: absolute;
    right: 0;
    top: 50%;
    width: 4px;
    height: 4px;
    margin-top: -2px;
    border-radius: var(--m3-shape-full);
    background: var(--m3-primary);
  }
  .ready-by {
    margin-top: 8px;
    text-align: right;
    color: var(--m3-on-surface-variant);
  }

  /* ------------------------------------------------------------ card body */

  /* The animated wrapper carries no spacing or border of its own — the
     .section children inside it do — so a collapsed (max-height:0) body
     truly renders nothing rather than leaving a stray sliver of the first
     child's border outside the clipped area. */
  .card-body {
    overflow: hidden;
    transition: max-height var(--m3-spring-spatial-slow-duration) var(--m3-ease-emphasized);
  }
  .section {
    margin-top: 16px;
  }

  /* ------------------------------------------------------- tonal stat cards */

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  /* @container, not @media: a dashboard column's width has no fixed
     relationship to the viewport, so a media query would never fire for a
     narrow card sitting in a wide window. */
  @container (max-width: 300px) {
    .stat-grid {
      grid-template-columns: 1fr;
    }
  }
  .stat-card {
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
    cursor: pointer;
    outline: none;
    overflow: hidden;
    font: inherit;
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
  }
  .stat-card::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--m3-on-surface);
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .stat-card:hover::before {
    opacity: var(--m3-state-hover);
  }
  .stat-card:active::before {
    opacity: var(--m3-state-pressed);
  }
  /* Shape morph on press: the expressive system's press feedback is the
     corner radius changing, not just a tint. */
  .stat-card:active {
    border-radius: var(--m3-shape-xl);
    transform: scale(0.97);
  }
  .stat-card:focus-visible {
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
    color: var(--m3-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ---------------------------------------------------------- subsections */

  .subsection-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 0;
    cursor: pointer;
    user-select: none;
    border-radius: var(--m3-shape-s);
    color: var(--m3-on-surface-variant);
    outline: none;
  }
  .subsection-header:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }
  .subsection-header > span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chevron {
    transition: transform var(--m3-spring-spatial-default-duration) var(--m3-spring-spatial-default);
  }
  .subsection.collapsed .chevron {
    transform: rotate(-90deg);
  }
  /* Same collapsed-means-truly-empty structure as .card-body above. */
  .subsection-body {
    overflow: hidden;
    transition: max-height var(--m3-spring-spatial-slow-duration) var(--m3-ease-emphasized);
  }
  .subsection-body-inner {
    padding-top: 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* ---------------------------------------------------------------- rows */

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

  /* The expressive connected button group: segments separated by a 2px gap,
     outer corners full and inner corners small, and a shape morph on press
     where the pressed segment squares off and shrinks. */
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
  /* Inner corners are square, not shape-s. Rounding both sides of a 2px
     seam puts two facing curves at each junction and opens an hourglass
     void through the middle of the group, so the segments read as separate
     pills instead of one connected control. See M3-EXPRESSIVE.md's
     connected-button-group recipe for the four geometries this was compared
     against. */
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
  /* The read-out between the two buttons is a segment too, so the group
     reads as one connected control rather than a value with buttons
     floating either side of it. */
  .segment.value {
    min-width: 62px;
    padding: 0 10px;
    background: var(--m3-surface-container-highest);
    color: var(--m3-on-surface);
    border-radius: var(--m3-shape-none);
    font-variant-numeric: tabular-nums;
    cursor: default;
  }

  /* ------------------------------------------------------- assorted values */

  .value-button {
    position: relative;
    flex-shrink: 0;
    padding: 8px 14px;
    border: none;
    border-radius: var(--m3-shape-full);
    background: var(--m3-surface-container-highest);
    color: var(--m3-on-surface);
    cursor: pointer;
    outline: none;
    overflow: hidden;
    font: inherit;
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
  }
  .value-button::before {
    content: "";
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .value-button:hover::before {
    opacity: var(--m3-state-hover);
  }
  .value-button:active::before {
    opacity: var(--m3-state-pressed);
  }
  .value-button:active {
    border-radius: var(--m3-shape-s);
    transform: scale(0.94);
  }
  .value-button:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }

  /* M3 assist/filter chip, used for the read-only mode and efficiency
     read-outs in Details. */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    padding: 6px 12px;
    border-radius: var(--m3-shape-s);
    background: var(--m3-secondary-container);
    color: var(--m3-on-secondary-container);
    flex-shrink: 0;
  }
  .chip.accent {
    background: var(--m3-primary-container);
    color: var(--m3-on-primary-container);
  }
  .chip ha-icon {
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

  /* ------------------------------------------------------ narrow widths */

  /* Measured at a 190px-wide card: the label+control rows can't share a
     line at this width without one side being crushed — "Target temp"
     truncated to "Target t…" while the connected button group still ran
     4px past ha-card's client width (scrollWidth 194 vs clientWidth 190).
     Stacking the control under its label fixes both: the label gets the
     full width and every control keeps its real size. @container, not
     @media, for the same reason as .stat-grid above. */
  @container (max-width: 300px) {
    .row {
      flex-wrap: wrap;
      row-gap: 8px;
    }
    .row > :first-child {
      flex: 1 0 100%;
    }
    /* The 48px leading icon plus the 52px switch leave the title almost
       nothing at this width; the smaller icon container buys back 8px. */
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

  @media (prefers-reduced-motion: reduce) {
    .glow::before,
    .glow::after {
      animation: none;
    }
    .wave-active {
      animation: none;
    }
  }
`;
