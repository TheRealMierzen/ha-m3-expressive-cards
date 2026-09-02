import { css } from "lit";
import { m3Tokens, m3Type } from "./m3.css";

/**
 * Material 3 Expressive surface for the PC overview card.
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
  }

  /* ---- semantic aliases ----
     This card shows four health states at once — good, warning, bad and
     info — across three different components (status badges, icon badges,
     the temperature tile). Rather than every component carrying four
     variants of its own, one class sets three custom properties and every
     component reads those. Adding a fifth state, or restyling one, is a
     change here and nowhere else. These are aliases of M3 roles, not roles.

     "info" is this card's own accent: the old scheme's info colour was the
     same cyan the whole card is seeded from, so it maps onto primary. */
  .good {
    --sem: var(--m3-success);
    --sem-container: var(--m3-success-container);
    --on-sem-container: var(--m3-on-success-container);
  }
  .warn {
    --sem: var(--m3-warning);
    --sem-container: var(--m3-warning-container);
    --on-sem-container: var(--m3-on-warning-container);
  }
  .bad {
    --sem: var(--m3-error);
    --sem-container: var(--m3-error-container);
    --on-sem-container: var(--m3-on-error-container);
  }
  .info {
    --sem: var(--m3-primary);
    --sem-container: var(--m3-primary-container);
    --on-sem-container: var(--m3-on-primary-container);
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
       :host is the actual pc-overview-card element HA's sections-view grid
       places and measures for auto-row sizing, and container-type forces
       size/layout containment onto whatever it's set on. Keeping it on
       ha-card leaves the container queries below working for descendants
       without applying containment to the element the outer grid depends
       on. This replaced a plain max-width media query, which never fires
       for a narrow card sitting in an otherwise-wide window. */
    container-type: inline-size;
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

  /* M3 leading icon in a shape-morphing container. This replaces the old
     card's 10px status dot: the dot only ever encoded powered-on vs
     powered-off, and a 48px container that changes both tone and corner
     radius says the same thing far more legibly — and says it a second way,
     through shape, for anyone who can't separate the two colours. */
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
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  /* Only the header's supporting line still uses these; the version section
     is a description list now. */
  .sep {
    color: var(--m3-outline);
  }
  .meta-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    /* The gap is the point: it separates the destructive button from the
       three reversible ones. See .power-off below. */
    gap: 8px;
    flex-shrink: 0;
    cursor: default;
  }

  /* ------------------------------------------- connected button group (M3E) */

  /* The power actions are one connected control, not several floating
     buttons: a single pill divided by 2px seams, with a shape morph on press
     where the pressed segment rounds off and shrinks.

     Inner corners are square, not the shape-s the house recipe used to
     specify. Rounding both sides of a 2px seam puts two facing curves at
     each junction, which opens an hourglass-shaped void through the middle
     of the group and makes three segments read as three separate pills —
     the exact thing a connected group is supposed to avoid. Squaring the
     inner corners leaves a clean 2px seam down the full height. Going
     further and closing the gap entirely was tried and is worse: the
     segments disappear into one undivided blob with no hint of where one
     button ends. */
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
    width: 40px;
    height: 40px;
    padding: 0;
    border: none;
    background: var(--m3-secondary-container);
    color: var(--m3-on-secondary-container);
    font: inherit;
    cursor: pointer;
    outline: none;
    position: relative;
    overflow: hidden;
    border-radius: var(--m3-shape-none);
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      background var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  /* Power off is NOT a segment. Reboot, suspend and hibernate are all
     recoverable and belong in one connected group; powering the machine off
     from a phone is the one action on this card you cannot undo, so it sits
     outside the group with a gap between.

     That separation is doing the real work, and it had to, because colour
     could not. Inside the group this button was error-container against
     secondary-container: 1.00:1 in both themes, all the container roles
     being the same tone, so it differed in hue and nothing else — see
     pitfall 16. Filling it with error instead passed the measurement at
     5.48:1 but looked wrong: M3's dark error role is a pale pink, which made
     the one button you rarely want to press the brightest object on the
     card, louder than the title (9.69:1 against the card, versus 12.76:1 for
     the title itself). Position is the honest channel here — it separates
     the control without competing for attention, and the tonal red then
     reinforces a distinction it no longer has to carry alone. */
  .power-off {
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
    background: var(--m3-error-container);
    color: var(--m3-on-error-container);
    cursor: pointer;
    outline: none;
    overflow: hidden;
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
  }
  .power-off::before {
    content: "";
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .power-off:hover::before {
    opacity: var(--m3-state-hover);
  }
  .power-off:active::before {
    opacity: var(--m3-state-pressed);
  }
  .power-off:active {
    border-radius: var(--m3-shape-s);
    transform: scale(0.92);
  }
  .power-off:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }
  .power-off ha-icon {
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
  .segment::before {
    content: "";
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .segment:hover::before {
    opacity: var(--m3-state-hover);
  }
  .segment:active::before {
    opacity: var(--m3-state-pressed);
  }
  .segment:first-child {
    border-radius: var(--m3-shape-full) var(--m3-shape-none) var(--m3-shape-none) var(--m3-shape-full);
  }
  .segment:last-child {
    border-radius: var(--m3-shape-none) var(--m3-shape-full) var(--m3-shape-full) var(--m3-shape-none);
  }
  /* A group can legitimately hold one button — the power actions are all
     individually optional in config. Without this the :last-child rule wins
     over :first-child and a lone segment renders flat on its left side. */
  .segment:only-child {
    border-radius: var(--m3-shape-full);
  }
  .segment:active {
    border-radius: var(--m3-shape-s);
    transform: scale(0.92);
  }
  .segment:focus-visible {
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

  /* ----------------------------------------------------------- M3 buttons */

  /* Filled button, for the single most important action on the card when
     it's off: waking the machine. Filled (not tonal) because there is
     nothing else to compete with it in that state. */
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-shrink: 0;
    height: 40px;
    padding: 0 16px 0 14px;
    border: none;
    border-radius: var(--m3-shape-full);
    background: var(--m3-secondary-container);
    color: var(--m3-on-secondary-container);
    font: inherit;
    cursor: pointer;
    outline: none;
    overflow: hidden;
    white-space: nowrap;
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
  }
  .btn.filled {
    background: var(--m3-primary);
    color: var(--m3-on-primary);
  }
  .btn::before {
    content: "";
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .btn:hover::before {
    opacity: var(--m3-state-hover);
  }
  .btn:active::before {
    opacity: var(--m3-state-pressed);
  }
  .btn:active {
    border-radius: var(--m3-shape-s);
    transform: scale(0.94);
  }
  .btn:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }
  /* While the wake request is in flight the button is inert: no state layer,
     no press morph, and the spinner carries the only motion. */
  .btn:disabled {
    cursor: default;
  }
  .btn:disabled::before {
    opacity: 0;
  }
  .btn:disabled:active {
    border-radius: var(--m3-shape-full);
    transform: none;
  }
  .btn ha-icon {
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
  .btn span {
    position: relative;
  }
  .btn ha-icon.spinner {
    animation: m3-spin 1s linear infinite;
  }
  @keyframes m3-spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ---------------------------------------------------------- metric tiles */

  .grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin-top: 16px;
  }

  /* A real button, not a div with a click handler: every tile opens HA's
     more-info dialog for its entity, so it has to be reachable by keyboard
     and announce itself as activatable. */
  .tile {
    position: relative;
    /* Grid rows stretch every tile to the tallest in the row, and only some
       tiles carry a progress bar. Centring the column keeps a short tile
       looking deliberate rather than top-heavy with dead space under it. */
    display: flex;
    flex-direction: column;
    justify-content: center;
    width: 100%;
    min-width: 0;
    text-align: left;
    padding: 10px 12px;
    border: none;
    border-radius: var(--m3-shape-l);
    background: var(--m3-surface-container-high);
    color: var(--m3-on-surface);
    font: inherit;
    outline: none;
    overflow: hidden;
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
  }
  .tile.clickable {
    cursor: pointer;
  }
  .tile::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--m3-on-surface);
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .tile.clickable:hover::before {
    opacity: var(--m3-state-hover);
  }
  .tile.clickable:active::before {
    opacity: var(--m3-state-pressed);
  }
  /* Shape morph on press: the expressive system's press feedback is the
     corner radius changing, not just a tint. */
  .tile.clickable:active {
    border-radius: var(--m3-shape-xl);
    transform: scale(0.96);
  }
  .tile:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }
  .tile-top {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
    color: var(--m3-on-surface-variant);
    min-width: 0;
  }
  .tile-top ha-icon {
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
  .tile-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tile-value {
    position: relative;
    color: var(--m3-on-surface);
    font-variant-numeric: tabular-nums;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* The temperature tile is the one whose value carries a health colour. */
  .tile-value.sem {
    color: var(--sem);
  }
  .tile-nvme {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .tile-nvme-row {
    color: var(--m3-on-surface);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tile-nvme-key {
    color: var(--m3-on-surface-variant);
    margin-right: 4px;
  }

  /* --------------------------------------- determinate linear progress (M3E) */

  /* One progress component, shared by the metric tiles and the drive bars so
     they are visibly the same control. Active track, a 4px gap, the flat
     remaining track, and a stop indicator marking full scale — the M3
     Expressive determinate shape, minus the wave. The wave is deliberately
     absent: an animated indicator implies work in progress, and CPU load and
     disk usage are standing readings, not running tasks.

     Absolute layout so the gap lands correctly at any percentage.
     calc(0% - 4px) clamps to 0 and a negative track width clamps to 0, so
     both ends of the range behave with no special-casing. */
  .progress {
    position: relative;
    height: 6px;
    margin-top: 6px;
  }
  .progress-active {
    position: absolute;
    left: 0;
    top: 0;
    height: 6px;
    border-radius: var(--m3-shape-full);
    background: var(--m3-primary);
    transition: width var(--m3-spring-spatial-slow-duration) var(--m3-spring-spatial-slow);
  }
  /* Ends 10px short of the right edge, not at it: the stop indicator is a
     6px dot pinned to that edge, and with both rounded the dot was drawn on
     top of the track's own end cap and read as a bulge in the track rather
     than as an indicator. Stopping the track 10px short leaves the same 4px
     gap on this side as the active track has on the other, so the component
     is symmetrical: active, gap, track, gap, stop. */
  .progress-track {
    position: absolute;
    right: 10px;
    top: 0;
    height: 6px;
    border-radius: var(--m3-shape-full);
    background: var(--m3-secondary-container);
    transition: left var(--m3-spring-spatial-slow-duration) var(--m3-spring-spatial-slow);
  }
  /* At full scale there is no stop indicator, so the track reclaims the gap
     it was leaving for one. */
  .progress.full .progress-track {
    right: 0;
  }
  .progress-stop {
    position: absolute;
    right: 0;
    top: 0;
    width: 6px;
    height: 6px;
    border-radius: var(--m3-shape-full);
    background: var(--m3-primary);
  }

  /* ----------------------------------------------------------- automations */

  .automations {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 16px;
    align-items: stretch;
  }
  .automation-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex: 1;
    min-width: 180px;
    min-height: 56px;
    padding: 8px 10px 8px 14px;
    border-radius: var(--m3-shape-l);
    background: var(--m3-surface-container-high);
  }
  .automation-label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--m3-on-surface-variant);
    min-width: 0;
  }
  /* Wraps rather than truncating. Two rows side by side leave the label
     under ~190px and "Sleep schedule shutdown" does not fit on one line;
     the row's 56px min-height already has room for the second line, and a
     half-readable automation name is worse than a taller row. */
  .automation-label span {
    min-width: 0;
    overflow-wrap: break-word;
  }
  .automation-label ha-icon {
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

  /* ---------------------------------------------------------------- switch */

  /* M3 switch: 52x32 track, 16px thumb when off, 24px when on, 28px while
     pressed. The thumb grows and travels on a spatial spring, so it visibly
     overshoots and settles — that bounce is the expressive motion scheme
     doing its job, not an accident of the easing curve. Rendered from one
     helper and shared by both automation rows so they are the same control.

     This replaced a text pill reading "On"/"Off", which was a button styled
     as a status read-out — it looked like something being reported rather
     than something you could change. */
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

  /* --------------------------------------------------------------- sections */

  .section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--m3-outline-variant);
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 4px 0;
    color: var(--m3-on-surface-variant);
    border-radius: var(--m3-shape-s);
    outline: none;
  }
  .section-header.toggle {
    cursor: pointer;
    user-select: none;
  }
  .section-header:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }
  .section-header-left {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .section-header-left span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .section-header ha-icon {
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
  .chevron {
    transition: transform var(--m3-spring-spatial-default-duration) var(--m3-spring-spatial-default);
  }
  .collapsed .chevron {
    transform: rotate(-90deg);
  }

  /* The animated wrapper carries no spacing or border of its own — the inner
     element carries the padding — so a collapsed (max-height:0) body truly
     renders nothing, rather than leaving that padding as a stray gap outside
     the clipped content area. A spring's overshoot on max-height would be
     invisible anyway (the clip is briefly larger than the content), so these
     take the emphasized easing instead. */
  .card-body,
  .section-body {
    overflow: hidden;
    transition: max-height var(--m3-spring-spatial-slow-duration) var(--m3-ease-emphasized);
  }
  .section-body-inner {
    padding-top: 10px;
  }

  /* -------------------------------------------------------------- drive bars */

  .bars {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .bar-top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    color: var(--m3-on-surface-variant);
  }
  .bar-value {
    color: var(--m3-on-surface);
    font-variant-numeric: tabular-nums;
  }

  /* --------------------------------------------------------------- webcam */

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .row-left {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    min-width: 0;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .camera {
    margin-top: 12px;
    border-radius: var(--m3-shape-l);
    overflow: hidden;
    background: var(--m3-surface-container-high);
  }

  /* ------------------------------------------------------- chips and badges */

  /* M3 assist chip, tinted by whichever semantic class sits on it. */
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    padding: 6px 12px;
    border-radius: var(--m3-shape-s);
    background: var(--sem-container, var(--m3-secondary-container));
    color: var(--on-sem-container, var(--m3-on-secondary-container));
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* System facts are a two-column list, not a run-on sentence.

     They were bullet-separated prose that wrapped, and every fix made it
     worse: separators orphaned at the end of a line, and grouping each
     bullet with its fact then pushed the bullet to the *start* of the next
     line, so the block read as a bullet list that it wasn't. Seven or eight
     label/value pairs are a description list — that is what the markup says
     now, it needs no separators at all, and the values line up so the block
     can be scanned down rather than read across. */
  .meta-grid {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 4px 12px;
    margin: 0;
  }
  .meta-key {
    color: var(--m3-on-surface-variant);
    white-space: nowrap;
  }
  .meta-val {
    min-width: 0;
    margin: 0;
    color: var(--m3-on-surface);
    overflow-wrap: anywhere;
  }
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    color: var(--m3-on-surface);
  }
  /* The inhibit chip is the one thing in this section that isn't a fact
     about the machine, so it sits below the list rather than in it. */
  .meta-chip-row {
    margin-top: 12px;
  }

  .icon-badges {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  /* Tonal icon container carrying a health state, with the same state layer
     and press morph as every other button on the card. */
  .icon-badge {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    padding: 0;
    border: none;
    border-radius: var(--m3-shape-m);
    background: var(--sem-container);
    color: var(--on-sem-container);
    cursor: pointer;
    outline: none;
    overflow: hidden;
    transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
      background var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default),
      color var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }
  .icon-badge::before {
    content: "";
    position: absolute;
    inset: 0;
    background: currentColor;
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .icon-badge:hover::before {
    opacity: var(--m3-state-hover);
  }
  .icon-badge:active::before {
    opacity: var(--m3-state-pressed);
  }
  .icon-badge:active {
    border-radius: var(--m3-shape-full);
    transform: scale(0.92);
  }
  .icon-badge:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 2px;
  }
  .icon-badge ha-icon {
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

  /* ------------------------------------------------------ narrow widths */

  /* @container, not @media: a dashboard column's width has no fixed
     relationship to the viewport, so a media query never fires for a narrow
     card sitting in a wide window. The original card used
     "@media (max-width: 520px)" for this grid, which meant the tiles only
     reflowed when the whole browser window was narrow — not when the card
     itself was. */
  @container (max-width: 560px) {
    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @container (max-width: 420px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  /* Below 300px a label and a fixed-width control genuinely cannot share a
     line — squeezing the label still leaves the control overflowing — so the
     control moves under its label instead of the label truncating. */
  @container (max-width: 300px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .row {
      row-gap: 10px;
    }
    .row > .row-left {
      flex: 1 0 100%;
    }
    /* The 48px leading icon plus a four-segment button group leave the title
       nothing at this width; the group wraps under the header instead. */
    .header {
      flex-wrap: wrap;
      gap: 10px;
      row-gap: 10px;
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
    .header-actions {
      flex: 1 0 100%;
    }
    /* flex:1, not width:100% — the group shares this row with the separated
       power-off button, and claiming the full width pushed that button 32px
       past the card's edge. */
    .button-group {
      flex: 1;
      min-width: 0;
    }
    .segment {
      flex: 1;
      width: auto;
      min-width: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .btn ha-icon.spinner {
      animation: none;
    }
  }
`;
