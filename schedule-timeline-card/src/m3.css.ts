import { css } from "lit";

/**
 * Material 3 Expressive design tokens for this card.
 * See ../../M3-EXPRESSIVE.md for the system; this file is the card's copy.
 *
 * **Accents from `SchemeVibrant` seeded #4da3ff, surfaces from
 * `SchemeNeutral` seeded #4da3ff** — the shared house neutral, byte-identical
 * to `activity-heatmap` and `quick-toggles`, so the cards agree on a
 * dashboard. This card has no identity colour of its own to seed from: its
 * colour is the lane palette, which is data, not theme.
 *
 * **The lane colours are not in here and must not be.** The categorical ramp
 * lives in palette.ts, hand-validated for adjacent-pair colourblind safety in
 * both themes. That is a categorical-scale problem, which M3's tonal palette
 * does not model — M3 gives a lightness ramp of one hue and has no notion of
 * a set of mutually distinguishable categories. Chrome is M3; the lanes,
 * their chips, their blocks and their trigger markers are palette.ts. See
 * M3-EXPRESSIVE.md, "Cards that render data colour".
 *
 * This replaced a chrome built on HA's own theme variables
 * (`var(--card-background-color, ...)` and friends). Those made the card
 * inherit whatever HA theme was active, which sounds desirable but meant it
 * matched neither the rest of this repo nor itself across themes — and the
 * standalone fallbacks were light-only, so the dev harness had to define HA
 * variables to test dark mode at all.
 */
export const m3Tokens = css`
  :host {
    /* ---- colour: dark scheme ---- */
    /* accents: SchemeVibrant #4da3ff */
    --m3-primary: #a2c9ff;
    --m3-on-primary: #00315b;
    --m3-primary-container: #004881;
    --m3-on-primary-container: #d3e4ff;
    --m3-secondary: #bbc5ea;
    --m3-on-secondary: #252f4d;
    --m3-secondary-container: #3c4665;
    --m3-on-secondary-container: #dbe1ff;
    --m3-tertiary: #c3c1f9;
    --m3-on-tertiary: #2c2b59;
    --m3-tertiary-container: #424271;
    --m3-on-tertiary-container: #e2dfff;
    --m3-error: #ffb4ab;
    --m3-on-error: #690005;
    --m3-error-container: #93000a;
    --m3-on-error-container: #ffdad6;
    /* surfaces: SchemeNeutral #4da3ff — the shared house neutral */
    --m3-surface: #131314;
    --m3-on-surface: #e4e2e3;
    --m3-surface-variant: #474648;
    --m3-on-surface-variant: #c8c6c7;
    --m3-surface-dim: #131314;
    --m3-surface-bright: #39393a;
    --m3-surface-container-lowest: #0e0e0f;
    --m3-surface-container-low: #1b1b1d;
    --m3-surface-container: #1f1f21;
    --m3-surface-container-high: #2a2a2b;
    --m3-surface-container-highest: #353536;
    --m3-outline: #919092;
    --m3-outline-variant: #474648;
    --m3-inverse-surface: #e4e2e3;
    --m3-inverse-on-surface: #303031;

    /* State-layer opacities. M3 expects interaction feedback to be a tinted
       overlay of the *content* colour, not a different background colour. */
    --m3-state-hover: 0.08;
    --m3-state-focus: 0.1;
    --m3-state-pressed: 0.1;

    /* ---- shape scale ---- */
    --m3-shape-none: 0px;
    --m3-shape-xs: 4px;
    --m3-shape-s: 8px;
    --m3-shape-m: 12px;
    --m3-shape-l: 16px;
    --m3-shape-l-increased: 20px;
    --m3-shape-xl: 28px;
    --m3-shape-xl-increased: 32px;
    --m3-shape-xxl: 48px;
    --m3-shape-full: 999px;

    /* ---- motion: springs, sampled from the real damped oscillator ----
       M3 Expressive's spatial springs are underdamped (damping 0.6-0.8), so
       these curves genuinely overshoot and settle back — that visible bounce
       is the point, and it's why they're linear() samples of x(t) rather
       than a cubic-bezier approximation, which cannot exceed 1. Effects
       springs are critically damped (1.0): no overshoot, for things like
       colour and opacity where an overshoot would be a glitch, not a bounce. */
    --m3-spring-spatial-fast: linear(0, 0.0754, 0.2492, 0.458, 0.6588, 0.8269, 0.952, 1.0338, 1.0783, 1.0942, 1.0906, 1.0759, 1.0565, 1.037, 1.0201, 1.0072, 0.9984, 0.9934, 0.9912, 0.9912, 0.9924, 0.9942, 0.996, 0.9977, 1);
    --m3-spring-spatial-fast-duration: 360ms;
    --m3-spring-spatial-default: linear(0, 0.0516, 0.1705, 0.3163, 0.4636, 0.598, 0.7123, 0.8044, 0.8751, 0.9271, 0.9636, 0.9877, 1.0026, 1.0108, 1.0144, 1.0151, 1.0141, 1.0122, 1.01, 1.0077, 1.0058, 1.0041, 1.0027, 1.0017, 1);
    --m3-spring-spatial-default-duration: 435ms;
    --m3-spring-effects-fast: linear(0, 0.0576, 0.1807, 0.3214, 0.4558, 0.5737, 0.6718, 0.7508, 0.8128, 0.8606, 0.897, 0.9244, 0.9448, 0.9599, 0.9709, 0.979, 0.9849, 0.9892, 0.9923, 0.9945, 0.9961, 0.9972, 0.998, 0.9986, 1);
    --m3-spring-effects-fast-duration: 150ms;
    --m3-spring-effects-default: linear(0, 0.0576, 0.1805, 0.3211, 0.4555, 0.5733, 0.6714, 0.7504, 0.8125, 0.8604, 0.8968, 0.9242, 0.9446, 0.9597, 0.9708, 0.979, 0.9849, 0.9892, 0.9922, 0.9945, 0.9961, 0.9972, 0.998, 0.9986, 1);
    --m3-spring-effects-default-duration: 231ms;

    /* Emphasized easing, for the few things that shouldn't bounce at all. */
    --m3-ease-emphasized: cubic-bezier(0.2, 0, 0, 1);

    /* ---- elevation (M3 dark surfaces lean on tone, so shadows stay soft) ---- */
    --m3-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15);
  }

  /* ---- colour: light scheme ----
     Keyed off HA's own theme (data-theme, set from hass.themes.darkMode) and
     not prefers-color-scheme, since HA's theme toggle and the OS setting can
     disagree. */
  :host([data-theme="light"]) {
    --m3-primary: #0060a9;
    --m3-on-primary: #ffffff;
    --m3-primary-container: #d3e4ff;
    --m3-on-primary-container: #001c38;
    --m3-secondary: #535d7e;
    --m3-on-secondary: #ffffff;
    --m3-secondary-container: #dbe1ff;
    --m3-on-secondary-container: #0f1a37;
    --m3-tertiary: #5a598b;
    --m3-on-tertiary: #ffffff;
    --m3-tertiary-container: #e2dfff;
    --m3-on-tertiary-container: #161543;
    --m3-error: #ba1a1a;
    --m3-on-error: #ffffff;
    --m3-error-container: #ffdad6;
    --m3-on-error-container: #410002;
    --m3-surface: #fbf9fa;
    --m3-on-surface: #1b1b1d;
    --m3-surface-variant: #e4e2e3;
    --m3-on-surface-variant: #474648;
    --m3-surface-dim: #dcd9db;
    --m3-surface-bright: #fbf9fa;
    --m3-surface-container-lowest: #ffffff;
    --m3-surface-container-low: #f5f3f4;
    --m3-surface-container: #f0edee;
    --m3-surface-container-high: #eae7e9;
    --m3-surface-container-highest: #e4e2e3;
    --m3-outline: #787778;
    --m3-outline-variant: #c8c6c7;
    --m3-inverse-surface: #303031;
    --m3-inverse-on-surface: #f3f0f1;
    --m3-elevation-1: 0 1px 2px rgba(48, 48, 49, 0.12), 0 1px 3px 1px rgba(48, 48, 49, 0.08);
  }

  /* Springs are the whole point of the motion system, but they're also the
     first thing to drop when the user has asked for less movement. Durations
     collapse rather than the rules being rewritten one by one. */
  @media (prefers-reduced-motion: reduce) {
    :host {
      --m3-spring-spatial-fast-duration: 1ms;
      --m3-spring-spatial-default-duration: 1ms;
      --m3-spring-effects-fast-duration: 1ms;
      --m3-spring-effects-default-duration: 1ms;
    }
  }
`;

/**
 * M3 Expressive type scale, as a set of shorthand classes.
 *
 * Expressive adds "emphasized" weights on top of the 2021 scale — the
 * -emphasized variants below are what carry the heavier, more confident
 * voice the design language asks for.
 */
export const m3Type = css`
  .m3-title-medium-emphasized {
    font-size: 16px;
    line-height: 24px;
    font-weight: 700;
    letter-spacing: 0.15px;
  }
  .m3-body-medium {
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
    letter-spacing: 0.25px;
  }
  .m3-body-small {
    font-size: 12px;
    line-height: 16px;
    font-weight: 400;
    letter-spacing: 0.4px;
  }
  .m3-label-large {
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
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
