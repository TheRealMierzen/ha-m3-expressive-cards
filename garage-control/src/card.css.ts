import { css } from "lit";
import { m3System, m3Tokens, m3Type } from "./m3.css";

/**
 * Material 3 Expressive surface for the garage card — see
 * ../../M3-EXPRESSIVE.md. Every colour, radius and duration is an --m3-*
 * token; there are no literals below this line.
 *
 * This card predated four of the root README's non-negotiables and was
 * missing all of them: the box-sizing reset, container queries (it used three
 * @media breakpoints, which never fire for a narrow card in a wide window),
 * --mdc-icon-size on its ha-icon rules, and container-type on ha-card. All
 * four are fixed here.
 */
export const cardStyles = css`
  ${m3System}
  ${m3Tokens}
  ${m3Type}

  /* Without this, any element mixing a percentage size with its own padding
     renders wider than intended — padding adds on top of a content-box width
     instead of being absorbed into it. */
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

  /* display:block is implicit in real HA (ha-card's own component sets it
     internally) but has no default here, so it's explicit — otherwise an
     undefined custom element defaults to display:inline and collapses. */
  ha-card {
    display: block;
    position: relative;
    overflow: hidden;
    contain: content;
    /* container-type lives here, never on :host — :host is the element HA's
       sections-view grid measures for auto-row sizing, and container-type
       would force size/layout containment onto it. */
    container-type: inline-size;
    border: none;
    border-radius: var(--m3-shape-xl);
    background: var(--m3-surface-container-low);
    color: var(--m3-on-surface);
    box-shadow: var(--m3-elevation-1);
    transition: background var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }
  ha-card.armed {
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
    cursor: pointer;
    min-width: 0;
    border-radius: var(--m3-shape-l);
    outline: none;
  }
  .header:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 3px;
  }

  /* Leading icon in a shape-morphing container — circle while the automation
     is off, rounded square while it's armed. Shape carries the state at a
     glance where the old 10px dot relied on colour alone. */
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
  ha-card.armed .leading-icon {
    border-radius: var(--m3-shape-l);
    background: var(--m3-primary-container);
    color: var(--m3-on-primary-container);
  }
  /* --mdc-icon-size sizes the glyph real HA's ha-icon actually draws;
     width/height alone size the host box and can leave the glyph at its own
     default. The flex + line-height:0 block is the companion fix: real
     ha-icon inherits surrounding line-height, which inflates its box
     asymmetrically and visibly off-centres the glyph in a circular
     container. Neither is reproducible in the dev harness. */
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

  /* The floor matters: .header-status's chips are flex-shrink:0, so without
     a minimum the title is the only thing that can give and it collapses to
     a single ellipsised letter once the row is carrying a door chip and an
     away chip at once. */
  .title-text {
    flex: 1;
    min-width: 96px;
  }
  .name {
    color: var(--m3-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .subtitle {
    margin-top: 2px;
    color: var(--m3-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mono {
    font-variant-numeric: tabular-nums;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    cursor: default;
    min-width: 0;
  }
  .header-status {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  /* ---------------------------------------------------------------- switch */

  /* The same M3 switch the other cards use — 52x32 track, thumb 16px off /
     24px on / 28px pressed, travelling on a spatial spring. This replaces a
     pair of icon buttons that swapped between mdi:toggle-switch-outline and
     mdi:toggle-switch-off-outline: the control was already drawing a switch,
     just as a picture of one that couldn't be dragged or read by a11y as a
     switch. */
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

  /* ----------------------------------------------------------------- chips */

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    max-width: 100%;
    min-width: 0;
    padding: 4px 10px;
    border-radius: var(--m3-shape-s);
    background: var(--m3-secondary-container);
    color: var(--m3-on-secondary-container);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }
  .chip .k {
    font-weight: 800;
    opacity: 0.7;
    flex: 0 0 auto;
  }
  .chip.away {
    background: var(--m3-error-container);
    color: var(--m3-on-error-container);
  }
  .chip.home {
    background: var(--m3-success-container);
    color: var(--m3-on-success-container);
  }
  /* A door chip is tertiary, not error: an open garage is worth surfacing
     while the card is collapsed, but it is not a fault, and sitting it next
     to the red "Away" chip in error-container would make the two states
     indistinguishable at chip size. */
  .chip.door {
    background: var(--m3-tertiary-container);
    color: var(--m3-on-tertiary-container);
  }
  .chip.door.off {
    background: var(--m3-surface-container-highest);
    color: var(--m3-on-surface-variant);
  }
  .chip-ic {
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
    flex: 0 0 auto;
  }
  .chip.door.moving .chip-ic {
    animation: door-pulse 1.1s var(--m3-ease-emphasized) infinite;
  }

  /* --------------------------------------------------------------- section */

  /* The animated wrapper carries no spacing or border of its own — those live
     on .section-inner — so a collapsed (max-height:0) section truly renders
     nothing rather than leaving a stray sliver of border outside the clip. */
  .section {
    overflow: hidden;
    transition: max-height var(--m3-spring-spatial-default-duration) var(--m3-ease-emphasized);
  }
  .section-inner {
    margin-top: 16px;
  }
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    color: var(--m3-on-surface-variant);
  }
  .section-title ha-icon {
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

  /* ----------------------------------------------------------- garage tiles */

  .garage-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  /* The tile stacks: presence on top, door controls underneath. Without a
     door configured it is a single row and renders exactly as it always
     did — justify-content:center keeps that row vertically centred in the
     56px minimum rather than pinned to the top. */
  .garage-pill {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    gap: 10px;
    min-height: 56px;
    min-width: 0;
    padding: 10px 12px;
    border: none;
    border-radius: var(--m3-shape-l);
    background: var(--m3-surface-container-high);
    color: var(--m3-on-surface);
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
  }
  /* M3 state layer, tinted with the tile's own semantic colour. */
  .garage-pill::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--m3-on-surface);
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .garage-pill.home::before {
    background: var(--m3-success);
  }
  .garage-pill.away::before {
    background: var(--m3-error);
  }
  .garage-pill[role="button"] {
    cursor: pointer;
  }
  @media (hover: hover) {
    .garage-pill[role="button"]:hover::before {
      opacity: var(--m3-state-hover);
    }
  }
  .garage-pill[role="button"]:active::before {
    opacity: var(--m3-state-pressed);
  }
  .garage-pill[role="button"]:active {
    border-radius: var(--m3-shape-xl);
    transform: scale(0.97);
  }
  .garage-pill[role="button"]:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }

  /* Oversized watermark glyph. Its box is bigger than the tile on purpose;
     the tile's own overflow:hidden clips it, and because it never moves it
     contributes nothing to scroll size. */
  .pill-bg-icon {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 128px;
    height: 128px;
    min-width: 128px;
    min-height: 128px;
    --mdc-icon-size: 128px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
    color: var(--m3-on-surface);
    /* The original drew this with a low-alpha colour *and* a low opacity, so
       its effective alpha was ~0.04. These roles are opaque, so the opacity
       has to carry the whole reduction on its own — at the old 0.12 the
       watermark competed with the label instead of sitting behind it. */
    opacity: 0.04;
    pointer-events: none;
    z-index: 0;
  }
  .garage-pill.home .pill-bg-icon {
    color: var(--m3-success);
    opacity: 0.05;
  }
  .garage-pill.away .pill-bg-icon {
    color: var(--m3-error);
    opacity: 0.05;
  }

  .pill-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
  }
  .pill-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    position: relative;
    z-index: 1;
  }
  .pill-dot {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
    border-radius: var(--m3-shape-full);
    background: var(--m3-error);
  }
  .garage-pill.home .pill-dot {
    background: var(--m3-success);
  }
  .pill-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .pill-label {
    color: var(--m3-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pill-badge {
    position: relative;
    z-index: 1;
    flex-shrink: 0;
    padding: 4px 10px;
    border-radius: var(--m3-shape-s);
    background: var(--m3-surface-container-highest);
    color: var(--m3-on-surface-variant);
    text-transform: uppercase;
  }
  .garage-pill.home .pill-badge {
    background: var(--m3-success-container);
    color: var(--m3-on-success-container);
  }
  .garage-pill.away .pill-badge {
    background: var(--m3-error-container);
    color: var(--m3-on-error-container);
  }

  /* ------------------------------------------------------- door controls */

  /* Separated from the presence row by a hairline rather than a gap alone:
     the two halves of the tile answer different questions ("is someone
     home?" vs "is the door shut?") and shouldn't read as one list. */
  .door-controls {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 10px;
    border-top: 1px solid var(--m3-outline-variant);
    min-width: 0;
  }
  .door-state {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: var(--m3-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .door-state.open {
    color: var(--m3-tertiary);
  }
  .door-state.moving {
    color: var(--m3-primary);
  }
  .door-state.unavailable {
    color: var(--m3-error);
  }
  .door-state ha-icon {
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
  /* The moving glyph is the one place a looping animation earns its keep:
     it is the card's only signal that the door is still travelling when the
     opener reports no position. */
  .door-state.moving ha-icon {
    animation: door-pulse 1.1s var(--m3-ease-emphasized) infinite;
  }
  @keyframes door-pulse {
    0%,
    100% {
      opacity: 0.4;
    }
    50% {
      opacity: 1;
    }
  }
  /* The connected button group — 2px gap, outer corners full, inner corners
     square. Rounding the inner corners opens an hourglass void through the
     seams and the segments stop reading as one control; see the recipe in
     ../../M3-EXPRESSIVE.md. */
  .button-group {
    display: flex;
    align-items: stretch;
    gap: 2px;
    width: 100%;
    min-width: 0;
  }
  .segment {
    flex: 1 1 0;
    min-width: 0;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 12px;
    border: none;
    font: inherit;
    outline: none;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    background: var(--m3-secondary-container);
    color: var(--m3-on-secondary-container);
    /* Nothing here selects, and a long press on a button that *does* select
       pops the mobile text-selection callout mid-hold. */
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    touch-action: manipulation;
    /* Shape morph on the *effects* spring, not the spatial one the recipe
       normally prescribes. The spatial springs are underdamped, and an
       underdamped 999px -> 8px radius undershoots its target: measured, it
       hit 0 and sat fully square for ~120ms, rebounded to 16.7px — double
       the target — and only settled at ~390ms. On a quick tap that is a
       bounce; under a 600ms hold it is a visible squared-then-rounded
       wobble. The effects spring is critically damped, so the same morph
       lands on 8px and stays there. */
    transition: border-radius var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast),
      transform var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast),
      background var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast),
      color var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  /* Stop is the emergency action and the only one that fires on a plain tap,
     so it is the only one carrying the error role. */
  .segment.stop:not(:disabled) {
    background: var(--m3-error-container);
    color: var(--m3-on-error-container);
  }
  .segment:disabled {
    cursor: default;
    background: var(--m3-surface-container-highest);
    color: var(--m3-on-surface-variant);
    opacity: 0.38;
  }
  .segment::before {
    content: "";
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  @media (hover: hover) {
    .segment:not(:disabled):hover::before {
      opacity: var(--m3-state-hover);
    }
  }
  .segment:not(:disabled):active::before {
    opacity: var(--m3-state-pressed);
  }
  .segment:first-child {
    border-radius: var(--m3-shape-full) var(--m3-shape-none) var(--m3-shape-none) var(--m3-shape-full);
  }
  .segment:last-child {
    border-radius: var(--m3-shape-none) var(--m3-shape-full) var(--m3-shape-full) var(--m3-shape-none);
  }
  /* Without this, :last-child beats :first-child on a lone segment and it
     renders flat down one side. Reachable here: an opener that supports
     only one direction leaves a single button in the group. */
  .segment:only-child {
    border-radius: var(--m3-shape-full);
  }
  /* One rule for both: a held button and a pressed button are the same
     shape. Two rules with different scales meant the transform re-animated
     the instant the hold completed and .holding came off while the pointer
     was still down. */
  .segment:not(:disabled):active,
  .segment.holding {
    border-radius: var(--m3-shape-s);
    transform: scale(0.92);
  }
  .segment:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
    z-index: 1;
  }
  /* A lone segment spells out its action; a pair (only reachable from an
     unknown state) stays icon-only, because two words don't fit across half
     a tile. */
  .seg-label {
    position: relative;
    z-index: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
    letter-spacing: 0.5px;
  }
  .segment ha-icon {
    position: relative;
    z-index: 1;
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

  /* The hold fill. Its duration is --hold-ms, set inline from the config,
     and deliberately *not* one of the motion tokens: it is a progress
     readout of a real elapsed time rather than decoration, so collapsing it
     under prefers-reduced-motion would leave a hold gesture with no
     indication of how long to hold. Releasing drops the .holding class and
     the base 0ms transition snaps it back with no rewind animation. */
  .seg-fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 100%;
    background: currentColor;
    opacity: 0.32;
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform 0ms linear;
    pointer-events: none;
  }
  .segment.holding .seg-fill {
    transform: scaleX(1);
    transition: transform var(--hold-ms, 600ms) linear;
  }

  /* ----------------------------------------------------- narrow container */

  /* @container, not @media: a dashboard column's width has no fixed
     relationship to the browser viewport, so the three @media breakpoints
     this card used to carry never fired for a narrow card sitting in a wide
     window — the layout they were written for was unreachable in practice. */
  @container (max-width: 400px) {
    .garage-grid {
      grid-template-columns: 1fr;
    }
    /* Below this width the status chips and the switch can't share the line
       with the title without crushing it, so they wrap to their own row.
       This used to sit at 320px, which was wide enough while the row only
       ever carried two "Away" chips; with a door chip per side it can now
       hold four, and the title was being squeezed out well above 320. */
    .header {
      flex-wrap: wrap;
    }
    /* width:100% is what forces the break — a flex item that wide cannot
       share a line with anything. The title needs no basis of its own; it
       just fills what the leading icon leaves on the first row. (It used to
       carry flex-basis: calc(100% - 50px), arithmetic that assumed the 10px
       gap set below 320px and pushed the icon onto a line by itself once
       this rule moved up to 400px, where the gap is still 14px.) */
    .header-actions {
      order: 3;
      width: 100%;
      justify-content: space-between;
    }
    .header-status {
      justify-content: flex-start;
    }
  }
  @container (max-width: 320px) {
    .wrap {
      padding: 12px;
    }
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
