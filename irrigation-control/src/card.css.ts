import { css } from "lit";
import { m3Tokens, m3Type } from "./m3.css";

/**
 * Material 3 Expressive surface for the irrigation schedule card.
 *
 * Every colour here is an M3 role from m3.css.ts — no literal hexes below
 * this line except the wave mask data-URI, which cannot reference a custom
 * property (that is why it is a mask over a token-coloured element rather
 * than a background image). Shape, motion and type likewise come from the
 * token scale, so "make it bouncier" or "reseed the palette" is a change in
 * one file.
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
       :host is the actual irrigation-schedule-card element HA's sections-view
       grid places and measures for auto-row sizing, and container-type forces
       size/layout containment onto whatever it's set on. This replaced a
       plain max-width media query on the schedule grid, which never fires
       for a narrow card sitting in an otherwise-wide window. */
    container-type: inline-size;
    border-radius: var(--m3-shape-xl);
    border: none;
    background: var(--m3-surface-container-low);
    color: var(--m3-on-surface);
    box-shadow: var(--m3-elevation-1);
    transition: background var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }
  /* "Watering" is this card's active state, not "automation enabled" — the
     valve being open is the thing you'd want to notice from across a room. */
  ha-card.watering {
    background: var(--m3-surface-container);
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
    cursor: pointer;
    user-select: none;
    border-radius: var(--m3-shape-l);
    outline: none;
  }
  .header:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 3px;
  }

  /* M3 leading icon in a shape-morphing container: a circle at rest, a
     rounded square while the valve is open. This replaces a 10px status dot
     that encoded whether the scheduling automation was enabled — which is
     now the header switch, a control rather than a read-out, leaving the
     icon free to carry the state that actually matters at a glance. */
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
  .header-actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    cursor: default;
  }

  /* ---------------------------------------------------------------- switch */

  /* M3 switch: 52x32 track, 16px thumb when off, 24px when on, 28px while
     pressed. The thumb grows and travels on a spatial spring, so it visibly
     overshoots and settles — that bounce is the expressive motion scheme
     doing its job, not an accident of the easing curve.

     Rendered from one helper and shared by both switches on this card (the
     scheduling automation in the header and the valve below), so they are
     visibly the same control. The valve one replaced a hand-rolled 52x30
     toggle with a hard-coded off-white thumb that ignored the theme. */
  .m3-switch {
    position: relative;
    width: 52px;
    height: 32px;
    flex-shrink: 0;
    padding: 0;
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

  /* -------------------------------------------------------------- sections */

  /* The animated wrapper carries no spacing or border of its own — the
     .section children do — so a collapsed (max-height:0) body truly renders
     nothing, rather than leaving the first section's border-top as a stray
     sliver outside the clipped area. A spring's overshoot on max-height
     would be invisible anyway (the clip is briefly larger than the content),
     so these take the emphasized easing instead. */
  .card-body,
  .schedule-body {
    overflow: hidden;
    transition: max-height var(--m3-spring-spatial-slow-duration) var(--m3-ease-emphasized);
  }
  .section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--m3-outline-variant);
  }
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--m3-on-surface-variant);
    border-radius: var(--m3-shape-s);
    outline: none;
  }
  .section-title.toggle {
    cursor: pointer;
    user-select: none;
    justify-content: space-between;
    padding: 4px 0;
  }
  .section-title:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
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
    transition: transform var(--m3-spring-spatial-default-duration) var(--m3-spring-spatial-default);
  }
  .schedule-section.collapsed .chevron {
    transform: rotate(-90deg);
  }
  .schedule-body-inner {
    padding-top: 10px;
  }

  /* ------------------------------------------ wavy linear progress (M3E) */

  /* The signature Expressive indicator, and this is the case it was designed
     for: the timer is genuinely counting down while it shows, so an animated
     wave reports work actually in progress rather than decorating a standing
     figure. It flattens to the plain M3 linear indicator when the timer is
     paused — see .wave.flat.

     The wave is a repeating SVG stroke used as a mask, not a background
     image, so its colour is still a custom property — a data-URI cannot
     reference one. mask-size matches the SVG's 40px wavelength.

     The tile starts and ends at a wave *crest*, not at a zero-crossing, and
     that is what makes it tile without a seam. Matching y and slope across
     the boundary is NOT sufficient: a stroke's butt cap is drawn
     perpendicular to the path direction, so where the path crosses the edge
     on a slope a 4px-wide cap reaches outside the 40px viewport and gets
     clipped, losing a sliver at every wavelength. At a crest the tangent is
     horizontal, so the cap is a vertical line lying exactly on the tile edge
     with nothing outside it, and consecutive tiles abut precisely. Hence
     cubic segments whose control points share their endpoint's y. */
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
    transition: width 1s linear;
  }
  /* Paused: the countdown is not running, so the wave flattens to the plain
     M3 linear indicator rather than animating progress that isn't happening. */
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
    transition: left 1s linear;
  }
  /* M3's stop indicator: a dot pinned at the track's end, marking full scale
     so a nearly-complete bar still reads as "not done". */
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

  .timer-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: var(--m3-on-surface-variant);
  }
  .timer-countdown {
    color: var(--m3-on-surface);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  /* ----------------------------------------------------------------- rows */

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 40px;
  }
  .valve-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .valve-label {
    color: var(--m3-on-surface);
  }
  .valve-meta {
    color: var(--m3-on-surface-variant);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* -------------------------------------------------------- schedule tiles */

  .schedule-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  /* Tonal tile: surface-container-high, large corner. Not interactive on
     this card — these are read-outs of what the automation decided — so no
     state layer and no press morph, which would both promise a click that
     does nothing. */
  .tile {
    padding: 10px 12px;
    border-radius: var(--m3-shape-l);
    background: var(--m3-surface-container-high);
    min-width: 0;
  }
  .tile-label {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
    color: var(--m3-on-surface-variant);
    min-width: 0;
  }
  .tile-label span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tile-label ha-icon {
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
  .tile-value {
    color: var(--m3-on-surface);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ------------------------------------------------------ narrow widths */

  /* @container, not @media: a dashboard column's width has no fixed
     relationship to the viewport, so a media query never fires for a narrow
     card sitting in a wide window. The original rule here was
     "@media (max-width: 360px)", which only reflowed the tiles when the
     whole browser window was narrow. */
  @container (max-width: 380px) {
    .schedule-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @container (max-width: 260px) {
    .schedule-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  /* Below 300px a label and a fixed-width control genuinely cannot share a
     line — squeezing the label still leaves the control overflowing — so the
     control moves under its label instead of the label truncating. */
  @container (max-width: 300px) {
    .row {
      flex-wrap: wrap;
      row-gap: 8px;
    }
    .row > :first-child {
      flex: 1 0 100%;
    }
    /* The 48px leading icon plus the 52px switch leave the title almost
       nothing at this width; the smaller container buys back 8px. */
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
    .wave-active {
      animation: none;
    }
  }
`;
