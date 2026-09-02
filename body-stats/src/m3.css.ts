import { css } from "lit";

/**
 * Material 3 Expressive design tokens for this card.
 * See ../../M3-EXPRESSIVE.md for the system; this file is the card's copy.
 *
 * **Accents from `SchemeVibrant` seeded #3fb8ff** (this card's original
 * blue). **Surfaces from `SchemeNeutral` seeded #4da3ff** — the shared house
 * neutral, byte-identical to every other migrated card, so they agree on a
 * dashboard. The silhouette carries this card's colour; the plate under it
 * stays out of the way.
 *
 * **`--m3-success-*` and `--m3-warning-*` are M3 *custom colours*, not roles
 * M3 ships.** The spec defines `error` and nothing else semantic, but every
 * reading on this card is a three-step health scale — good, borderline,
 * concerning — driving the silhouette regions, the vital pins and the legend
 * dots alike. They're built the way M3 builds custom colours: a tonal palette
 * from one seed (#0f9f78 and #c98513, the same two the other migrated cards
 * use) sampled at the standard custom-colour tones — light takes
 * T40/T100/T90/T10 and dark T80/T20/T30/T90.
 *
 * These are semantic, not categorical: unlike `schedule-timeline-card`'s lane
 * palette, the three levels are an ordered scale with fixed meanings, which
 * is exactly what M3 custom colours model. So they belong in here rather than
 * in a separate palette module.
 *
 * `SchemeExpressive` is deliberately not used: it rotates the seed hue, and
 * "Expressive" here means the shape, motion and type system this file
 * encodes, not a colour variant.
 */
export const m3Tokens = css`
  :host {
    /* ---- colour: dark scheme ---- */
    /* accents: SchemeVibrant #3fb8ff */
    --m3-primary: #8cceff;
    --m3-on-primary: #00344e;
    --m3-primary-container: #004b6f;
    --m3-on-primary-container: #cae6ff;
    --m3-secondary: #b5c7e9;
    --m3-on-secondary: #1e314c;
    --m3-secondary-container: #354763;
    --m3-on-secondary-container: #d5e3ff;
    --m3-tertiary: #bac4fa;
    --m3-on-tertiary: #232d5a;
    --m3-tertiary-container: #3a4472;
    --m3-on-tertiary-container: #dde1ff;
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
    /* custom colours: tonal palettes at the standard custom-colour tones */
    --m3-success: #63dbb0;
    --m3-on-success: #003828;
    --m3-success-container: #00513b;
    --m3-on-success-container: #81f8cb;
    --m3-warning: #ffb958;
    --m3-on-warning: #462b00;
    --m3-warning-container: #643f00;
    --m3-on-warning-container: #ffddb5;

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
    --m3-spring-spatial-slow: linear(0, 0.0517, 0.1706, 0.3166, 0.464, 0.5984, 0.7127, 0.8047, 0.8755, 0.9274, 0.9638, 0.9878, 1.0027, 1.0108, 1.0144, 1.0151, 1.0141, 1.0122, 1.0099, 1.0077, 1.0057, 1.0041, 1.0027, 1.0017, 1);
    --m3-spring-spatial-slow-duration: 600ms;
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
    --m3-primary: #006492;
    --m3-on-primary: #ffffff;
    --m3-primary-container: #cae6ff;
    --m3-on-primary-container: #001e2f;
    --m3-secondary: #4d5f7c;
    --m3-on-secondary: #ffffff;
    --m3-secondary-container: #d5e3ff;
    --m3-on-secondary-container: #071c36;
    --m3-tertiary: #525c8b;
    --m3-on-tertiary: #ffffff;
    --m3-tertiary-container: #dde1ff;
    --m3-on-tertiary-container: #0d1744;
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
    --m3-success: #006c50;
    --m3-on-success: #ffffff;
    --m3-success-container: #81f8cb;
    --m3-on-success-container: #002116;
    --m3-warning: #845400;
    --m3-on-warning: #ffffff;
    --m3-warning-container: #ffddb5;
    --m3-on-warning-container: #2a1800;
    --m3-elevation-1: 0 1px 2px rgba(48, 48, 49, 0.12), 0 1px 3px 1px rgba(48, 48, 49, 0.08);
  }

  /* Springs are the whole point of the motion system, but they're also the
     first thing to drop when the user has asked for less movement. Durations
     collapse rather than the rules being rewritten one by one. */
  @media (prefers-reduced-motion: reduce) {
    :host {
      --m3-spring-spatial-fast-duration: 1ms;
      --m3-spring-spatial-default-duration: 1ms;
      --m3-spring-spatial-slow-duration: 1ms;
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
  .m3-title-small-emphasized {
    font-size: 14px;
    line-height: 20px;
    font-weight: 700;
    letter-spacing: 0.1px;
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
