import { css } from "lit";
import { m3Tokens, m3Type } from "./m3.css";

/**
 * Material 3 Expressive surface for the schedule timeline card.
 *
 * Every colour here is an M3 role from m3.css.ts — with one deliberate
 * exception, spelled out because it would otherwise look like an oversight:
 * the lane colours are applied inline from palette.ts, on the chips' dots,
 * the schedule blocks and the trigger markers. Those are data, not theme.
 * Chrome is M3; the values being visualised are not. See M3-EXPRESSIVE.md,
 * "Cards that render data colour".
 */
export const cardStyles = css`
  ${m3Tokens}
  ${m3Type}

  /* Without this, any element that mixes a percentage width with its own
     padding (.block: width set from time-of-day percent, padding added
     later for the inline time label) renders wider than its percentage —
     padding adds on top of a content-box width instead of eating into it.
     That's an invisible few px for most blocks, but a real overflow past
     the track for anything ending at the 100% (midnight) edge. */
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
    /* container-type lives here (a shadow-DOM descendant), never on :host —
       :host is the actual schedule-timeline-card element HA's sections-view
       grid places and measures for auto-row sizing, and container-type
       forces size/layout containment onto whatever it's set on.

       Note this card ALSO puts container-type on every .block, for the
       label-hiding queries down there. Those resolve against the block, the
       nearest container ancestor, so the two don't interact. */
    container-type: inline-size;
    border-radius: var(--m3-shape-xl);
    border: none;
    background: var(--m3-surface-container-low);
    color: var(--m3-on-surface);
    box-shadow: var(--m3-elevation-1);
    padding: 16px;
  }

  /* --------------------------------------------------------------- header */

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
  }
  .title {
    color: var(--m3-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .day-switch {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 0 0 auto;
  }
  .day-label {
    color: var(--m3-on-surface-variant);
    min-width: 76px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    /* Needed once the narrow-width rule below lets this flex: without it a
       long day name renders straight over the next-day arrow instead of
       shortening. */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ----------------------------------------------------------- M3 buttons */

  /* Icon button, standard variant: circular, state layer on hover/press, and
     a shape morph to a rounded square while pressed. */
  .icon-button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    border-radius: var(--m3-shape-full);
    background: transparent;
    color: var(--m3-on-surface-variant);
    font: inherit;
    line-height: 1;
    cursor: pointer;
    outline: none;
    overflow: hidden;
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
  }
  .icon-button:active {
    border-radius: var(--m3-shape-s);
    transform: scale(0.92);
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

  /* Outlined button, for the two range-extend actions: secondary to the day
     navigation beside them, so an outline rather than a fill. */
  .outlined-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    height: 32px;
    padding: 0 12px;
    border: 1px solid var(--m3-outline);
    border-radius: var(--m3-shape-full);
    background: transparent;
    color: var(--m3-on-surface);
    font: inherit;
    white-space: nowrap;
    cursor: pointer;
    outline: none;
    overflow: hidden;
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .outlined-button:active {
    border-radius: var(--m3-shape-s);
    transform: scale(0.94);
  }
  .outlined-button:disabled {
    opacity: 0.38;
    cursor: default;
  }
  .outlined-button:disabled:active {
    border-radius: var(--m3-shape-full);
    transform: none;
  }

  /* Text button, for the low-emphasis inline actions (Show all / Hide all /
     Reset). These were underlined text before; M3 text buttons use colour
     and a state layer instead, so they stop reading as hyperlinks. */
  .text-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    height: 32px;
    padding: 0 10px;
    border: none;
    border-radius: var(--m3-shape-full);
    background: transparent;
    color: var(--m3-primary);
    font: inherit;
    white-space: nowrap;
    cursor: pointer;
    outline: none;
    overflow: hidden;
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
  }
  .text-button:active {
    border-radius: var(--m3-shape-s);
    transform: scale(0.94);
  }

  /* One state layer for every button on the card. M3 interaction feedback is
     a tinted overlay of the content colour, never a different background. */
  .icon-button::before,
  .outlined-button::before,
  .text-button::before,
  .chip::before {
    content: "";
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
    pointer-events: none;
  }
  .icon-button:hover::before,
  .outlined-button:hover:not(:disabled)::before,
  .text-button:hover::before,
  .chip:hover::before {
    opacity: var(--m3-state-hover);
  }
  .icon-button:active::before,
  .outlined-button:active:not(:disabled)::before,
  .text-button:active::before,
  .chip:active::before {
    opacity: var(--m3-state-pressed);
  }

  /* The original card had no focus styling at all on any of its controls. */
  .icon-button:focus-visible,
  .outlined-button:focus-visible,
  .text-button:focus-visible,
  .chip:focus-visible,
  .lane-label:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }

  .range-extend {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    margin-bottom: 12px;
    color: var(--m3-on-surface-variant);
  }
  .range-summary {
    white-space: nowrap;
  }

  /* ---------------------------------------------------------------- chips */

  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 14px;
  }
  .chip-action-divider {
    width: 1px;
    height: 16px;
    background: var(--m3-outline-variant);
    margin: 0 2px;
    flex-shrink: 0;
  }

  /* M3 filter chip. Selected (lane visible) is a filled tonal chip;
     deselected (lane hidden) is an outlined transparent one. That is the
     real M3 selected/unselected pair, and it replaces a 0.4 opacity wash —
     which dimmed the lane's own colour dot along with the chip, making a
     hidden lane's identity colour hard to read at exactly the moment you
     need it to find the lane again. */
  .chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 12px;
    border: 1px solid transparent;
    border-radius: var(--m3-shape-s);
    background: var(--m3-secondary-container);
    color: var(--m3-on-secondary-container);
    font: inherit;
    cursor: pointer;
    outline: none;
    overflow: hidden;
    max-width: 100%;
    transition: background var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast),
      color var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast),
      border-color var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast),
      border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
  }
  .chip.hidden {
    background: transparent;
    border-color: var(--m3-outline-variant);
    color: var(--m3-on-surface-variant);
  }
  .chip:active {
    border-radius: var(--m3-shape-full);
    transform: scale(0.94);
  }
  .chip-label {
    position: relative;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* Lane colour, straight from palette.ts via an inline style. */
  .chip-dot {
    position: relative;
    width: 10px;
    height: 10px;
    border-radius: var(--m3-shape-full);
    flex: 0 0 auto;
  }

  /* --------------------------------------------------------------- ruler */

  .ruler {
    display: flex;
    margin-bottom: 4px;
  }
  .ruler-label {
    width: var(--lane-label-width, 132px);
    flex: 0 0 var(--lane-label-width, 132px);
  }
  .ruler-track {
    flex: 1;
    position: relative;
    height: 18px;
  }
  .ruler-tick {
    position: absolute;
    top: 0;
    color: var(--m3-on-surface-variant);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* Hairline hour gridlines, shared by the ruler and every lane track so
     they line up in one continuous column. Evenly spaced by construction
     (hourTicksForWidth always produces evenly-spaced ticks), so a single
     repeating gradient can draw every line at once instead of one element
     per tick. --tick-interval is set once on ha-card and inherited down. */
  .ruler-track,
  .lane-track {
    background-image: repeating-linear-gradient(
      to right,
      var(--m3-outline-variant) 0,
      var(--m3-outline-variant) 1px,
      transparent 1px,
      transparent var(--tick-interval, 12.5%)
    );
  }

  /* ---------------------------------------------------------------- lanes */

  .lanes {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .lane {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* A real button: clicking a lane opens HA's more-info dialog for that
     schedule, so it must be reachable by keyboard and announce itself. The
     track beside it stays a plain click target — it fires the same action,
     and making it focusable too would double every lane's tab stop for no
     extra reach. */
  .lane-label {
    width: var(--lane-label-width, 132px);
    flex: 0 0 var(--lane-label-width, 132px);
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0;
    border: none;
    border-radius: var(--m3-shape-xs);
    background: transparent;
    color: var(--m3-on-surface);
    font: inherit;
    text-align: left;
    cursor: pointer;
    outline: none;
  }
  /* Ellipsis has to live on the text span, not the flex container above —
     text-overflow does nothing on a flex box with multiple children, it
     would just hard-clip with no "…" shown. */
  .lane-label span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .lane-label ha-icon {
    flex: 0 0 auto;
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
    color: var(--m3-on-surface-variant);
  }

  .lane-track {
    flex: 1;
    position: relative;
    height: 28px;
    background-color: var(--m3-surface-container-high);
    border-radius: var(--m3-shape-s);
    cursor: pointer;
  }

  /* ------------------------------------------------------- blocks (data) */

  /* Fill colour comes from palette.ts, inline. Everything else is M3. */
  .block {
    position: absolute;
    top: 2px;
    bottom: 2px;
    border-radius: var(--m3-shape-xs);
    min-width: 3px;
    /* Lets the label spans inside query the block's own rendered width
       (a dashboard column's width has no fixed relationship to the
       viewport), so they can hide themselves rather than clip or
       overflow when a block is too narrow to hold text. */
    container-type: inline-size;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .block.clipped-start {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .block.clipped-end {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  .block-label,
  .block-duration {
    display: none;
    white-space: nowrap;
    line-height: 1;
  }
  /* Padding lives on the labels, not on .block itself: a display:none
     element contributes nothing to layout (padding included), so a block
     too narrow to show a label shrinks to its true min-width instead of
     being forced wide enough for padding it isn't using — that forced
     minimum was exactly what pushed a block past its track at the day
     boundary (see the right:0 comment on the "continues to next day"
     case in schedule-timeline-card.ts). The 4px right margin on
     .block-label doubles as the gap before .block-duration when both show. */
  .block-label {
    margin: 0 4px;
  }
  .block-duration {
    margin-right: 4px;
    opacity: 0.85;
  }

  /* Thresholds are measured text width (canvas-measured at this font/size)
     plus the block's own horizontal padding plus a margin for cross-OS
     font metric variance — not eyeballed. "range" ("08:00-17:00", 11 chars)
     and "arrow" ("to 06:30", 7 chars) need different minimums, so each gets
     its own query rather than sharing one that's either too tight (clips
     the longer variant) or too conservative (hides the shorter one
     needlessly). See time-utils/formatDuration and the card's _renderBlock
     for where each variant is produced. */
  @container (min-width: 64px) {
    .block-label.arrow {
      display: inline;
    }
  }
  @container (min-width: 80px) {
    .block-label.range {
      display: inline;
    }
  }
  @container (min-width: 132px) {
    .block-duration {
      display: inline;
    }
  }

  /* Marker fill is the lane's palette colour; the ring is the card beneath,
     which is a different tone from the track, so a dot sitting on the track
     still reads as a separate object. */
  .trigger-marker {
    position: absolute;
    top: 50%;
    width: 11px;
    height: 11px;
    border-radius: var(--m3-shape-full);
    transform: translate(-50%, -50%);
    box-shadow: 0 0 0 2px var(--m3-surface-container-low);
  }
  .trigger-label {
    position: absolute;
    top: 50%;
    transform: translate(9px, -50%);
    color: var(--m3-on-surface-variant);
    white-space: nowrap;
    pointer-events: none;
    font-variant-numeric: tabular-nums;
  }
  .trigger-label.trigger-label-left {
    transform: translate(calc(-100% - 9px), -50%);
  }

  .empty-lane-hint {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
    pointer-events: none;
  }
  /* Ellipsis needs a plain block/inline box, not the flex container above
     (same reason the lane-label truncation lives on an inner span — see
     that comment) — otherwise a narrow track wraps this to two lines and
     overflows the row's fixed height instead of truncating cleanly. */
  .empty-lane-hint span {
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--m3-on-surface-variant);
  }

  /* Red for "now" is the calendar convention (every major calendar draws
     this line red), and it is what the original card used deliberately. M3
     would normally reserve error for "something is wrong" — see
     M3-EXPRESSIVE.md's warning about reaching for error just because
     something is red — so this is a considered exception, not a default. */
  .now-line {
    position: absolute;
    top: -1px;
    bottom: -1px;
    width: 2px;
    background: var(--m3-error);
    z-index: 2;
    pointer-events: none;
  }

  .empty {
    color: var(--m3-on-surface-variant);
    padding: 16px 0;
    text-align: center;
  }

  /* ------------------------------------------------------ narrow widths */

  /* @container, not @media: a dashboard column's width has no fixed
     relationship to the viewport, so a media query never fires for a narrow
     card sitting in a wide window. The header's two clusters cannot share a
     line once the day switcher has both arrows and both range-extend
     buttons in it. */
  @container (max-width: 420px) {
    .header {
      flex-wrap: wrap;
      row-gap: 8px;
    }
    .title {
      flex: 1 0 100%;
    }
    .day-switch {
      flex: 1;
      justify-content: space-between;
      width: 100%;
    }
  }

  /* Below ~340px the five controls in the day switcher cannot hold their
     natural widths: two 56px range buttons, two 36px arrows and a 76px day
     label need 276px of a 228px content box, and it overflowed by 31px at
     260px wide. The day label gives up its minimum and truncates instead —
     it is the only one of the five that degrades gracefully.

     Deliberately NOT reflowed into two rows. An earlier attempt reordered
     the range buttons onto a second row with CSS order, which fit fine and
     then put both of them on the same side — and which one means "earlier"
     and which means "later" is encoded in nothing but their position either
     side of the arrows. Truncating a day name costs less than that. */
  @container (max-width: 340px) {
    .day-label {
      flex: 1;
      min-width: 0;
    }
  }
`;
