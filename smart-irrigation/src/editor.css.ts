import { css } from "lit";

/**
 * Shared look for this repo's visual editors, copied verbatim between cards
 * (each card stays independently buildable, so this is duplicated rather
 * than imported across folders).
 *
 * Deliberately plain: an editor should look like the rest of HA's config
 * panels, not like the card it configures. The colour roles below are
 * theme-neutral greys keyed off HA's own CSS variables for exactly that
 * reason — an editor that renders the card's seeded palette reads as a
 * second card sitting inside the dialog.
 */
export const editorStyles = css`
  :host,
  :host *,
  :host *::before,
  :host *::after {
    box-sizing: border-box;
  }

  :host {
    display: block;
    --m3-surface-container-high: rgba(127, 127, 127, 0.09);
    --m3-outline: rgba(127, 127, 127, 0.32);
    --m3-outline-variant: rgba(127, 127, 127, 0.2);
    --m3-on-surface: var(--primary-text-color, #212121);
    --m3-on-surface-variant: var(--secondary-text-color, #8b8b8b);
  }

  .intro {
    font-size: 12px;
    line-height: 1.45;
    color: var(--m3-on-surface-variant);
    margin: 0 0 4px;
  }

  .sections {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
  }

  .row {
    border: 1px solid var(--m3-outline-variant);
    border-radius: 10px;
    overflow: hidden;
    background: var(--m3-surface-container-high);
  }
  .row.open {
    border-color: var(--m3-outline);
  }

  .row-head {
    appearance: none;
    width: 100%;
    font: inherit;
    text-align: left;
    background: none;
    border: 0;
    color: inherit;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    cursor: pointer;
  }

  .row-text {
    flex: 1 1 auto;
    min-width: 0;
  }
  .row-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--m3-on-surface);
  }
  .row-sub {
    font-size: 11px;
    color: var(--m3-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Sections expand by rendering, not by animating a max-height: an
     ha-form's height isn't known up front and a fixed max-height clips it. */
  .row-body {
    padding: 4px 10px 12px;
    border-top: 1px solid var(--m3-outline-variant);
  }

  .hint {
    font-size: 12px;
    line-height: 1.45;
    color: var(--m3-on-surface-variant);
    margin: 6px 0 2px;
  }

  .notice {
    font-size: 12px;
    line-height: 1.45;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px dashed var(--m3-outline);
    color: var(--m3-on-surface-variant);
    margin: 16px 0 0;
  }

  /* What the wired-up entities are reporting right now. The whole point of
     these forms is picking the right entity out of a list of near-identical
     names, and the only proof you did is its current value. */
  .readout {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid var(--m3-outline-variant);
  }
  .readout-head {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--m3-on-surface-variant);
    margin-bottom: 2px;
  }
  .ro {
    display: flex;
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
  }
  .ro-label {
    flex: 1 1 auto;
    min-width: 0;
    color: var(--m3-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chip {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--m3-surface-container-high);
    border: 1px solid var(--m3-outline-variant);
    color: var(--m3-on-surface);
    font-family: ui-monospace, monospace;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 60%;
  }
  .chip.bad {
    border-color: var(--error-color, #e35b5b);
    color: var(--error-color, #e35b5b);
  }

  .section-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 22px 0 6px;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--m3-on-surface-variant);
  }

  .row-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 0 0 auto;
  }

  .icon-btn {
    appearance: none;
    background: none;
    border: 0;
    padding: 4px;
    border-radius: 6px;
    color: var(--m3-on-surface-variant);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 0;
  }
  .icon-btn:hover:not(:disabled) {
    background: var(--m3-surface-container-high);
    color: var(--primary-text-color, inherit);
  }
  .icon-btn:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .icon-btn ha-icon {
    --mdc-icon-size: 18px;
    width: 18px;
    height: 18px;
    min-width: 18px;
    min-height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
  }

  /* A lane's resolved colour, so the row is identifiable at a glance the way
     it is on the card itself. */
  .swatch {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    border-radius: 4px;
    border: 1px solid var(--m3-outline-variant);
  }

  .empty {
    font-size: 13px;
    color: var(--m3-on-surface-variant);
    padding: 12px;
    border: 1px dashed var(--m3-outline);
    border-radius: 10px;
    text-align: center;
  }

  .chev {
    flex: 0 0 auto;
    color: var(--m3-on-surface-variant);
  }
  .chev ha-icon {
    --mdc-icon-size: 20px;
    width: 20px;
    height: 20px;
    min-width: 20px;
    min-height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
  }
`;
