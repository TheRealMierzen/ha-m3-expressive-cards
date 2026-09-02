import { css } from "lit";
import { m3System, m3Tokens, m3Type } from "./m3.css";

/**
 * Material 3 Expressive chrome for the heatmap — see ../../M3-EXPRESSIVE.md.
 * The --ah-* tokens are this card's own geometry and data surfaces, set
 * inline on .grid from the config; --ah-l1..l9 come from palette.ts and are
 * deliberately outside the M3 token system (see m3.css.ts for why).
 */
export const cardStyles = css`
  ${m3System}
  ${m3Tokens}
  ${m3Type}

  /* The grid mixes percentage-derived track widths with its own padding, and
     the legend swatches mix a fixed size with a border. */
  :host,
  :host *,
  :host *::before,
  :host *::after {
    box-sizing: border-box;
  }

  :host {
    /* Heatmap geometry defaults. The cell size and gap are measured and set
       on .grid at render time (see cellMetrics); only the radius and the
       empty-cell colour are plain config. */
    --ah-radius: 2px;
    /* The empty cell sits at the *low end of the scale*, past the faintest
       filled shade — that ordering is what every palette's floor is tuned
       against, and if it inverts, a blank day reads as a busier one.

       Which direction "low end" points flips with the theme, because the
       ramp does: palette.ts climbs in lightness in dark mode (so the faintest
       filled shade is the darkest) and descends in light mode (so it is the
       lightest). A wash toward --m3-surface-container-lowest expresses that
       once — it is near-black in dark and pure white in light, so the empty
       cell lands below the scale in both without a per-theme override.

       Measured, this matters more than it looks. Writing it as a wash of
       --m3-on-surface (the obvious move) inverts it in dark mode, where
       on-surface is near-white: the faintest filled shade went from 1.66:1
       against the empty cell to 1.00:1 — identical luminance, the scale's
       floor gone entirely. */
    --ah-empty: color-mix(in srgb, var(--m3-surface-container-lowest) 50%, transparent);
    --ah-today-ring: color-mix(in srgb, var(--m3-on-surface) 55%, transparent);
    --ah-label: 9.5px;

    display: block;
  }

  /* display:block is implicit in real HA but an undefined custom element
     defaults to display:inline in the dev harness and collapses. */
  ha-card {
    display: block;
    position: relative;
    overflow: hidden;
    /* container-type lives on ha-card, never :host — :host is the element
       HA's sections-view grid measures for auto-row sizing, and
       container-type would force containment onto it. */
    container-type: inline-size;
    color: var(--m3-on-surface);
    border: none;
    border-radius: var(--m3-shape-xl);
    background: var(--m3-surface-container-low);
    box-shadow: var(--m3-elevation-1);
  }

  .wrap {
    position: relative;
    z-index: 1;
    padding: 14px 16px 12px;
  }

  /* ------------------------------------------------------------------ head */

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin: 0 0 12px;
  }

  .title {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.005em;
    color: var(--m3-on-surface);
    margin: 0;
  }

  .range-note {
    font-size: 10.5px;
    color: var(--m3-outline);
    white-space: nowrap;
    flex: 0 0 auto;
  }

  /* ----------------------------------------------------------------- board */

  /* The inset panel the grid sits in. Its own surface rather than the card's
     bare gradient, so the empty cells have something to be quiet against. */
  .board {
    position: relative;
    padding: 8px 10px 6px;
    border-radius: 12px;
    background: var(--m3-surface-container-high);
    border: 1px solid var(--m3-outline-variant);
  }

  .scroll {
    /* Only reachable once the cells hit their configured floor and the grid
       can no longer shrink to the card's width. */
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
    scrollbar-color: var(--m3-outline) transparent;
  }
  .scroll::-webkit-scrollbar {
    height: 6px;
  }
  .scroll::-webkit-scrollbar-thumb {
    background: var(--m3-outline);
    border-radius: 3px;
  }

  .grid {
    display: grid;
    /* Provisional, until the first measurement lands — flexible tracks with
       no minimum, so the very first paint can't overflow and trigger a
       bogus scroll-to-newest. */
    gap: 2px;
    grid-auto-columns: minmax(0, 1fr);
    width: 100%;
    /* Not the default "normal", which behaves as "stretch" and inflates any
       auto-sized track to swallow the leftover width — that put the weekday
       labels in a 200px column and then fed that width back into the next
       measurement, pinning the cells at their minimum size. */
    justify-content: start;
    /* Focus lands on the whole grid, not 365 individual tab stops — arrow
       keys move a cursor inside it instead. */
    outline: none;
  }
  /* Set when the cells hit their size cap and the grid no longer fills the
     card, so the leftover reads as deliberate margin instead of a ragged
     right edge. */
  .grid.centred {
    justify-content: center;
  }
  .grid:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 4px;
    border-radius: 4px;
  }

  .corner {
    /* Placeholder that keeps the month row aligned with the cell columns. */
  }

  .mlab {
    position: relative;
    height: 13px;
    min-width: 0;
  }
  .mlab span {
    position: absolute;
    left: 0;
    bottom: 0;
    font-size: var(--ah-label);
    line-height: 1;
    letter-spacing: 0.02em;
    color: var(--m3-outline);
    white-space: nowrap;
  }

  .dlab {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 3px;
    font-size: var(--ah-label);
    line-height: 1;
    color: var(--m3-outline);
    white-space: nowrap;
  }

  .cell {
    aspect-ratio: 1;
    min-width: 0;
    border-radius: var(--ah-radius);
    background: var(--ah-empty);
    transition: outline-color 90ms var(--m3-ease-emphasized), filter 90ms var(--m3-ease-emphasized);
    outline: 2px solid transparent;
    outline-offset: 1px;
  }
  .cell.lvl-1 {
    background: var(--ah-l1);
  }
  .cell.lvl-2 {
    background: var(--ah-l2);
  }
  .cell.lvl-3 {
    background: var(--ah-l3);
  }
  .cell.lvl-4 {
    background: var(--ah-l4);
  }
  .cell.lvl-5 {
    background: var(--ah-l5);
  }
  .cell.lvl-6 {
    background: var(--ah-l6);
  }
  .cell.lvl-7 {
    background: var(--ah-l7);
  }
  .cell.lvl-8 {
    background: var(--ah-l8);
  }
  .cell.lvl-9 {
    background: var(--ah-l9);
  }

  /* Week-alignment padding with align_weeks: false — the track still exists
     so the columns stay square, it just draws nothing. */
  .cell.blank {
    background: none;
  }

  /* Dates that haven't happened yet, in the trailing week column. */
  .cell.future {
    background: none;
    box-shadow: inset 0 0 0 1px var(--m3-outline-variant);
  }
  .cell.future.hide {
    box-shadow: none;
  }

  .cell.today {
    box-shadow: inset 0 0 0 1.5px var(--ah-today-ring);
  }

  .cell.active {
    outline-color: var(--m3-on-surface);
    filter: brightness(1.12);
  }
  /* The day whose breakdown is open — held while the pointer moves elsewhere,
     so it stays obvious which day the panel is describing. */
  .cell.selected {
    outline-color: var(--m3-primary);
    outline-width: 2px;
  }
  .grid.selectable .cell[data-i] {
    cursor: pointer;
  }

  /* --------------------------------------------------------------- tooltip */

  .tip {
    position: absolute;
    left: 0;
    top: 0;
    transform: translate(calc(var(--tip-x, 0px) - 50%), calc(var(--tip-y, 0px) - 100% - 9px));
    padding: 5px 8px;
    border-radius: 8px;
    background: var(--m3-inverse-surface);
    border: none;
    box-shadow: var(--m3-elevation-2);
    font-size: 11.5px;
    line-height: 1.35;
    white-space: nowrap;
    color: var(--m3-inverse-on-surface);
    pointer-events: none;
    opacity: 0;
    transition: opacity 110ms var(--m3-ease-emphasized);
    z-index: 4;
  }
  .tip.show {
    opacity: 1;
  }
  .tip::after {
    content: "";
    position: absolute;
    left: 50%;
    bottom: -4px;
    width: 7px;
    height: 7px;
    margin-left: -3.5px;
    background: var(--m3-inverse-surface);
    transform: rotate(45deg);
  }
  .tip .tip-value {
    font-weight: 650;
  }
  .tip .tip-date {
    color: color-mix(in srgb, var(--m3-inverse-on-surface) 72%, transparent);
  }

  /* --------------------------------------------------------------- loading */

  .board.loading .grid {
    opacity: 0.45;
  }
  /* A single sweep over the whole board rather than a per-cell shimmer —
     365 staggered animations is a lot of compositing for a state that lasts
     one round-trip. */
  .board.loading::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(
      100deg,
      transparent 20%,
      color-mix(in srgb, var(--m3-on-surface) 7%, transparent) 50%,
      transparent 80%
    );
    background-size: 220% 100%;
    animation: ah-sweep 1.5s linear infinite;
  }
  @keyframes ah-sweep {
    from {
      background-position: 160% 0;
    }
    to {
      background-position: -60% 0;
    }
  }

  /* ------------------------------------------------------------- breakdown */

  /* The 0fr -> 1fr grid row is what makes this slide rather than appear: it
     animates to the content's own height, with no magic max-height to guess
     at and outgrow when a day has nine states instead of two. */
  .slot {
    display: grid;
    grid-template-rows: 0fr;
    opacity: 0;
    transition: grid-template-rows 240ms var(--m3-ease-emphasized), opacity 160ms var(--m3-ease-emphasized);
  }
  .slot.open {
    grid-template-rows: 1fr;
    opacity: 1;
  }
  .slot > .panel {
    /* Both required for the row to be able to collapse to nothing. */
    overflow: hidden;
    min-height: 0;
  }

  .panel-inner {
    margin-top: 11px;
    padding: 10px 12px 11px;
    border-radius: 12px;
    background: var(--m3-surface-container-high);
    border: 1px solid var(--m3-outline-variant);
  }

  .panel-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 9px;
  }
  .panel-date {
    font-size: 12px;
    font-weight: 600;
    color: var(--m3-on-surface);
  }
  .panel-total {
    font-size: 12px;
    color: var(--m3-outline);
    font-variant-numeric: tabular-nums;
  }
  /* Discoverability for the summary mode: without it the panel looks static
     and there's nothing to suggest the cells are clickable. */
  .panel-hint {
    margin-left: auto;
    font-size: 10px;
    color: var(--m3-outline);
    white-space: nowrap;
  }

  .panel-close {
    appearance: none;
    -webkit-appearance: none;
    margin-left: auto;
    border: 0;
    background: none;
    color: var(--m3-outline);
    font: inherit;
    font-size: 15px;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 6px;
    cursor: pointer;
  }
  .panel-close:hover {
    color: var(--m3-on-surface);
  }
  .panel-close:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 1px;
  }

  /* One bar, segments proportional to time — the shape of the day before any
     of the numbers are read. */
  .bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: var(--ah-empty);
    margin-bottom: 9px;
  }
  .bar span {
    display: block;
    height: 100%;
    min-width: 2px;
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    line-height: 1.2;
  }
  .row .dot {
    width: 9px;
    height: 9px;
    border-radius: 3px;
    flex: 0 0 auto;
  }
  .row .name {
    color: var(--m3-on-surface);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .row.other .name {
    color: var(--m3-outline);
    font-style: italic;
  }
  .row .times {
    font-size: 10.5px;
    color: var(--m3-outline);
    white-space: nowrap;
  }
  .row .dur {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
    color: var(--m3-on-surface);
    white-space: nowrap;
  }
  .row .share {
    font-variant-numeric: tabular-nums;
    color: var(--m3-outline);
    width: 34px;
    text-align: right;
    white-space: nowrap;
  }

  .panel-empty {
    font-size: 12px;
    color: var(--m3-outline);
  }

  /* ------------------------------------------------------------------ foot */

  .foot {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px 16px;
    flex-wrap: wrap;
    margin-top: 11px;
  }

  .stats {
    display: flex;
    align-items: flex-end;
    gap: 18px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .stat-label {
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--m3-outline);
    white-space: nowrap;
  }
  .stat-figure {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }
  .stat-value {
    font-size: 16px;
    font-weight: 650;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    color: var(--m3-on-surface);
  }
  .stat-detail {
    font-size: 10px;
    color: var(--m3-outline);
    white-space: nowrap;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-left: auto;
    font-size: 10px;
    color: var(--m3-outline);
    flex: 0 0 auto;
  }
  .legend .sw {
    width: 10px;
    height: 10px;
    border-radius: var(--ah-radius);
    background: var(--ah-empty);
    flex: 0 0 auto;
  }

  /* ---------------------------------------------------------------- notices */

  .notice {
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--m3-outline);
    margin-top: 10px;
  }
  .notice.error {
    color: var(--m3-error);
  }
  .setup {
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--m3-on-surface-variant);
  }

  /* A dashboard column's width has no fixed relationship to the viewport,
     so this is a container query, not @media. */
  @container (max-width: 400px) {
    .wrap {
      padding: 12px 12px 10px;
    }
    .title {
      font-size: 14px;
    }
    .range-note {
      display: none;
    }
    .board {
      padding: 7px 8px 5px;
    }
    .stats {
      gap: 14px;
    }
    .stat-value {
      font-size: 15px;
    }
    /* Crowds the total out of the header long before it stops fitting. */
    .panel-hint {
      display: none;
    }
  }
  @container (max-width: 300px) {
    :host {
      --ah-label: 9px;
    }
    .foot {
      align-items: flex-start;
    }
    .legend {
      margin-left: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cell {
      transition: none;
    }
    .tip {
      transition: none;
    }
    .board.loading::after {
      animation: none;
    }
    .slot {
      transition: none;
    }
  }

  /* The light colour roles all live in m3.css.ts. What remains here is the
     handful of rules whose *values* genuinely differ by theme rather than
     just resolving a token. */
`;
