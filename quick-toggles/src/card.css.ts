import { css } from "lit";
import { m3System, m3Tokens, m3Type } from "./m3.css";

/**
 * Material 3 Expressive surface for the card chrome — see
 * ../../M3-EXPRESSIVE.md. Every colour, radius and duration below is an
 * --m3-* token; the only literals are the --qt-* geometry values, which are
 * this card's own layout vocabulary rather than theme values.
 *
 * The medallions themselves live in medallion.css.ts, shared with the
 * editor's live previews.
 */
export const cardStyles = css`
  ${m3System}
  ${m3Tokens}
  ${m3Type}

  /* Percentage sizes mixed with own padding (the medallion's inset layers,
     the badge's halo) would otherwise render wider than intended. */
  :host,
  :host *,
  :host *::before,
  :host *::after {
    box-sizing: border-box;
  }

  :host {
    /* Medallion geometry — overridden per size class below. Not themeable
       and not part of the M3 scale: these are the card's own anatomy. */
    --qt-plate: 48px;
    --qt-glyph: 24px;
    --qt-badge: 10px;
    --qt-ring: 2px;
    --qt-gap: 12px;

    display: block;
    color: var(--m3-on-surface);
  }

  /* Every toggle hidden by its own visibility rule — collapse rather than
     leave an empty panel behind. */
  :host([hidden]) {
    display: none !important;
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
    border: none;
    border-radius: var(--m3-shape-xl);
    background: var(--m3-surface-container-low);
    color: var(--m3-on-surface);
    box-shadow: var(--m3-elevation-1);
  }

  .wrap {
    position: relative;
    z-index: 1;
    padding: 14px 16px;
  }

  .title {
    color: var(--m3-on-surface-variant);
    margin: 0 0 12px;
  }

  /* No title means no reason for the extra top padding — a bare row of
     medallions should sit centred in its own card, not top-heavy. */
  .wrap.no-title {
    padding: 12px 16px;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--qt-gap);
  }
  .row.align-start {
    justify-content: flex-start;
  }
  .row.align-center {
    justify-content: center;
  }
  .row.align-space-between {
    justify-content: space-between;
  }
  /* The default. An auto-fit grid rather than flex space-evenly, because a
     flex gap *adds* to the distributed space: with gap:12 the outer gaps came
     out at 10.5px against 22.5px inner ones, which is not an even split.
     Equal 1fr tracks divide the width exactly, keep a medallion-width floor
     so nothing ever touches, and align medallions into columns across
     wrapped rows. */
  .row.align-even {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(var(--qt-plate), 1fr));
    justify-items: center;
    align-items: center;
  }
  /* Strict flex distribution: every gap identical, including the outer two,
     which means dropping the gap and letting free space do all the work.
     Spreads a partial last row across the full width instead of keeping it
     in columns — the trade-off against .align-even. */
  .row.align-space-evenly {
    justify-content: space-evenly;
    gap: 0;
  }
  /* A fixed column count needs a grid — flex-basis maths on a wrapping row
     can't guarantee N per line once the gap is in play. */
  .row.grid {
    display: grid;
    grid-template-columns: repeat(var(--qt-columns, 5), 1fr);
    justify-items: center;
  }

  .size-sm {
    --qt-plate: 40px;
    --qt-glyph: 22px;
    --qt-badge: 9px;
    --qt-ring: 2px;
  }
  .size-md {
    --qt-plate: 48px;
    --qt-glyph: 24px;
    --qt-badge: 10px;
    --qt-ring: 2px;
  }
  .size-lg {
    --qt-plate: 56px;
    --qt-glyph: 28px;
    --qt-badge: 11px;
    --qt-ring: 2.5px;
  }

  .slot {
    appearance: none;
    -webkit-appearance: none;
    background: none;
    border: 0;
    margin: 0;
    padding: 0;
    font: inherit;
    color: inherit;
    line-height: 0;
    border-radius: 50%;
    cursor: pointer;
    /* Presses are handled on pointer events; the browser's own 300ms
       touch delay and text selection both get in the way of a hold. */
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .slot:focus {
    outline: none;
  }
  .slot:focus-visible {
    outline: 3px solid var(--m3-secondary);
    outline-offset: 3px;
  }

  /* Its own element rather than a border: at 1px and half a medallion tall
     a hairline is effectively invisible, so this is a 2px rounded bar in the
     outline-variant role. */
  .divider {
    width: 2px;
    height: calc(var(--qt-plate) * 0.5);
    background: var(--m3-outline-variant);
    border-radius: var(--m3-shape-full);
    flex: 0 0 auto;
  }

  /* A dashboard column's width has no fixed relationship to the viewport,
     so this is a container query, not @media. */
  @container (max-width: 260px) {
    .row {
      --qt-gap: 8px;
    }
    .size-lg {
      --qt-plate: 48px;
      --qt-glyph: 24px;
    }
    .size-md {
      --qt-plate: 42px;
      --qt-glyph: 22px;
    }
    .size-sm {
      --qt-plate: 36px;
      --qt-glyph: 20px;
    }
  }
`;
