import { css } from "lit";

/**
 * Material 3 Expressive design tokens for this card.
 * See ../../M3-EXPRESSIVE.md for the system; this file is the card's copy.
 *
 * Surfaces from `SchemeNeutral`, accents from `SchemeVibrant`, both seeded
 * #24b2ff (this card's original accent). Neutral surfaces because the card
 * carries three semantic colours at once — auto-open on (primary), home
 * (success) and away (error) — and a tinted board would bias all three.
 *
 * **`--m3-success-*` is an M3 *custom colour*, not something M3 ships.** The
 * spec defines an `error` role but no success role, and "home" here is a
 * genuine third semantic state rather than a decorative accent. It's built
 * the way M3 builds custom colours: a tonal palette from one seed (#0f9f78,
 * the card's original "good" green), sampled at the standard custom-colour
 * tones — light takes T40/T100/T90/T10 and dark T80/T20/T30/T90 for
 * colour/on-colour/container/on-container. That gives the same contrast
 * guarantees as the built-in roles instead of a hand-mixed rgba.
 */
export const m3System = css`
  :host {
    --m3-state-hover: 0.08;
    --m3-state-focus: 0.1;
    --m3-state-pressed: 0.1;

    --m3-shape-none: 0px;
    --m3-shape-xs: 4px;
    --m3-shape-s: 8px;
    --m3-shape-m: 12px;
    --m3-shape-l: 16px;
    --m3-shape-xl: 28px;
    --m3-shape-full: 999px;

    /* Springs sampled from the real damped oscillator. Spatial springs are
       underdamped (0.6-0.8) and genuinely overshoot; effects springs are
       critically damped (1.0) for colour and opacity, where an overshoot
       would read as a glitch rather than a bounce. */
    --m3-spring-spatial-fast: linear(0, 0.0754, 0.2492, 0.458, 0.6588, 0.8269, 0.952, 1.0338, 1.0783, 1.0942, 1.0906, 1.0759, 1.0565, 1.037, 1.0201, 1.0072, 0.9984, 0.9934, 0.9912, 0.9912, 0.9924, 0.9942, 0.996, 0.9977, 1);
    --m3-spring-spatial-fast-duration: 360ms;
    --m3-spring-spatial-default: linear(0, 0.0516, 0.1705, 0.3163, 0.4636, 0.598, 0.7123, 0.8044, 0.8751, 0.9271, 0.9636, 0.9877, 1.0026, 1.0108, 1.0144, 1.0151, 1.0141, 1.0122, 1.01, 1.0077, 1.0058, 1.0041, 1.0027, 1.0017, 1);
    --m3-spring-spatial-default-duration: 435ms;
    --m3-spring-effects-fast: linear(0, 0.0576, 0.1807, 0.3214, 0.4558, 0.5737, 0.6718, 0.7508, 0.8128, 0.8606, 0.897, 0.9244, 0.9448, 0.9599, 0.9709, 0.979, 0.9849, 0.9892, 0.9923, 0.9945, 0.9961, 0.9972, 0.998, 0.9986, 1);
    --m3-spring-effects-fast-duration: 150ms;
    --m3-spring-effects-default: linear(0, 0.0576, 0.1805, 0.3211, 0.4555, 0.5733, 0.6714, 0.7504, 0.8125, 0.8604, 0.8968, 0.9242, 0.9446, 0.9597, 0.9708, 0.979, 0.9849, 0.9892, 0.9922, 0.9945, 0.9961, 0.9972, 0.998, 0.9986, 1);
    --m3-spring-effects-default-duration: 231ms;
    --m3-ease-emphasized: cubic-bezier(0.2, 0, 0, 1);

    --m3-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15);
  }

  @media (prefers-reduced-motion: reduce) {
    :host {
      --m3-spring-spatial-fast-duration: 1ms;
      --m3-spring-spatial-default-duration: 1ms;
      --m3-spring-effects-fast-duration: 1ms;
      --m3-spring-effects-default-duration: 1ms;
    }
  }
`;

export const m3Tokens = css`
  :host {
    /* ---- dark ---- */
    --m3-surface: #131314;
    --m3-on-surface: #e4e2e3;
    --m3-surface-variant: #464748;
    --m3-on-surface-variant: #c7c6c7;
    --m3-surface-container-lowest: #0d0e0f;
    --m3-surface-container-low: #1b1c1d;
    --m3-surface-container: #1f2021;
    --m3-surface-container-high: #292a2b;
    --m3-surface-container-highest: #343536;
    --m3-outline: #919091;
    --m3-outline-variant: #464748;
    --m3-inverse-surface: #e4e2e3;
    --m3-inverse-on-surface: #303031;
    --m3-primary: #8ecdff;
    --m3-on-primary: #00344f;
    --m3-primary-container: #004b70;
    --m3-on-primary-container: #cae6ff;
    --m3-secondary: #b5c7e9;
    --m3-secondary-container: #364764;
    --m3-on-secondary-container: #d5e3ff;
    --m3-tertiary: #bbc3fa;
    --m3-tertiary-container: #3b4472;
    --m3-on-tertiary-container: #dee0ff;
    --m3-error: #ffb4ab;
    --m3-on-error: #690005;
    --m3-error-container: #93000a;
    --m3-on-error-container: #ffdad6;
    --m3-success: #63dbb0;
    --m3-on-success: #003828;
    --m3-success-container: #00513b;
    --m3-on-success-container: #81f8cb;
  }

  /* Keyed off HA's own theme (data-theme, from hass.themes.darkMode), not
     prefers-color-scheme — the OS setting and HA's toggle can disagree. */
  :host([data-theme="light"]) {
    --m3-surface: #fbf9fa;
    --m3-on-surface: #1b1c1d;
    --m3-surface-variant: #e4e2e3;
    --m3-on-surface-variant: #464748;
    --m3-surface-container-lowest: #ffffff;
    --m3-surface-container-low: #f5f3f4;
    --m3-surface-container: #efedee;
    --m3-surface-container-high: #eae8e9;
    --m3-surface-container-highest: #e4e2e3;
    --m3-outline: #777778;
    --m3-outline-variant: #c7c6c7;
    --m3-inverse-surface: #303031;
    --m3-inverse-on-surface: #f2f0f1;
    --m3-primary: #006494;
    --m3-on-primary: #ffffff;
    --m3-primary-container: #cae6ff;
    --m3-on-primary-container: #001e30;
    --m3-secondary: #4e5f7d;
    --m3-secondary-container: #d5e3ff;
    --m3-on-secondary-container: #071c36;
    --m3-tertiary: #535b8b;
    --m3-tertiary-container: #dee0ff;
    --m3-on-tertiary-container: #0e1744;
    --m3-error: #ba1a1a;
    --m3-on-error: #ffffff;
    --m3-error-container: #ffdad6;
    --m3-on-error-container: #410002;
    --m3-success: #006c50;
    --m3-on-success: #ffffff;
    --m3-success-container: #81f8cb;
    --m3-on-success-container: #002116;
    --m3-elevation-1: 0 1px 2px rgba(27, 28, 29, 0.12), 0 1px 3px 1px rgba(27, 28, 29, 0.08);
  }
`;

/** M3 Expressive type scale — only the steps this card uses. */
export const m3Type = css`
  .m3-title-medium-emphasized {
    font-size: 16px;
    line-height: 24px;
    font-weight: 700;
    letter-spacing: 0.15px;
  }
  .m3-title-small {
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: 0.1px;
  }
  .m3-body-small {
    font-size: 12px;
    line-height: 16px;
    font-weight: 400;
    letter-spacing: 0.4px;
  }
  .m3-label-large-emphasized {
    font-size: 14px;
    line-height: 20px;
    font-weight: 700;
    letter-spacing: 0.1px;
  }
  .m3-label-medium {
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
    letter-spacing: 0.5px;
  }
  .m3-label-small {
    font-size: 11px;
    line-height: 16px;
    font-weight: 500;
    letter-spacing: 0.5px;
  }
`;
