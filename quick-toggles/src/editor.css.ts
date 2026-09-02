import { css } from "lit";
import { m3System } from "./m3.css";

/** Deliberately plain: an editor should look like the rest of HA's config
 * panels, not like the card it configures. The one exception is the live
 * medallion preview in each row header, which is the card's own component. */
export const editorStyles = css`
  ${m3System}

  :host,
  :host *,
  :host *::before,
  :host *::after {
    box-sizing: border-box;
  }

  /* Shape, motion and state-layer opacities come from m3System above. The
     colour roles are defined here rather than imported from m3Tokens, and
     deliberately so: they're theme-neutral greys keyed off HA's own CSS
     variables, so the editor keeps looking like an HA config panel instead
     of like the card. medallionStyles reads these same role names, which is
     what lets the live previews render with identical code at a smaller
     size. */
  :host {
    display: block;
    --qt-plate: 34px;
    --qt-glyph: 18px;
    --qt-badge: 8px;
    --qt-ring: 2px;
    --m3-surface-container-high: rgba(127, 127, 127, 0.09);
    --m3-surface-container-low: var(--card-background-color, #ffffff);
    --m3-outline: rgba(127, 127, 127, 0.32);
    --m3-outline-variant: rgba(127, 127, 127, 0.2);
    --m3-on-surface: var(--primary-text-color, #212121);
    --m3-on-surface-variant: var(--secondary-text-color, #8b8b8b);
  }

  .section {
    margin-top: 20px;
  }

  .section-head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--m3-on-surface-variant);
    margin-bottom: 8px;
  }

  .hint {
    font-size: 12px;
    line-height: 1.45;
    color: var(--m3-on-surface-variant);
    margin: 4px 0 10px;
  }

  .notice {
    font-size: 12px;
    line-height: 1.45;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px dashed var(--m3-outline);
    color: var(--m3-on-surface-variant);
    margin: 8px 0;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    cursor: pointer;
  }

  .preview {
    flex: 0 0 auto;
    line-height: 0;
  }

  .row-text {
    flex: 1 1 auto;
    min-width: 0;
  }
  .row-title {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .row-sub {
    font-size: 11px;
    color: var(--m3-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
  .icon-btn.danger:hover {
    color: var(--error-color, #e35b5b);
  }

  /* Rows expand by rendering, not by animating a max-height: an ha-form's
     height isn't known up front and a fixed max-height clips it. */
  .row-body {
    padding: 4px 10px 12px;
    border-top: 1px solid var(--m3-outline-variant);
  }

  .sub-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 14px 0 6px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--m3-on-surface-variant);
  }
  .sub-head .spacer {
    flex: 1 1 auto;
  }

  .srow {
    border: 1px solid var(--m3-outline-variant);
    border-radius: 8px;
    margin-bottom: 6px;
    overflow: hidden;
  }
  .srow-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    cursor: pointer;
    font-size: 12px;
  }
  .srow-body {
    padding: 2px 8px 10px;
    border-top: 1px solid var(--m3-outline-variant);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--m3-surface-container-high);
    border: 1px solid var(--m3-outline-variant);
    font-family: ui-monospace, monospace;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 55%;
  }
  .arrow {
    color: var(--m3-on-surface-variant);
    flex: 0 0 auto;
  }
  .effect {
    flex: 1 1 auto;
    color: var(--m3-on-surface-variant);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* One ANDed test inside a condition list. */
  .trow {
    border: 1px solid var(--m3-outline-variant);
    border-radius: 8px;
    padding: 2px 8px 6px;
    margin-bottom: 6px;
  }
  .trow-head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--m3-on-surface-variant);
    padding-top: 4px;
  }
  .and {
    font-weight: 700;
    color: var(--primary-color, #4da3ff);
  }
  .cond-empty {
    font-size: 12px;
    color: var(--m3-on-surface-variant);
    padding: 6px 8px;
    border: 1px dashed var(--m3-outline-variant);
    border-radius: 8px;
    margin-bottom: 6px;
  }

  .add-row {
    display: flex;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: wrap;
  }

  .text-btn {
    appearance: none;
    font: inherit;
    font-size: 13px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--m3-outline);
    background: none;
    color: var(--primary-color, #4da3ff);
    cursor: pointer;
  }
  .text-btn:hover {
    background: var(--m3-surface-container-high);
  }
  .text-btn ha-icon {
    --mdc-icon-size: 16px;
    width: 16px;
    height: 16px;
    min-width: 16px;
    min-height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
  }

  .empty {
    font-size: 13px;
    color: var(--m3-on-surface-variant);
    padding: 12px;
    border: 1px dashed var(--m3-outline);
    border-radius: 10px;
    text-align: center;
  }
`;
