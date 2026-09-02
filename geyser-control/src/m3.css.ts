import { css } from "lit";

/**
 * Material 3 Expressive design tokens for this card.
 *
 * Colour roles are a real M3 tonal palette, not hand-picked hexes: generated
 * with @material/material-color-utilities. **Accents from `SchemeVibrant`
 * seeded #ff8a3d** (the geyser's heat colour), swapping to #22c1e2 in cooling
 * mode. Note that the library's `SchemeExpressive` variant is deliberately
 * NOT used — it rotates the seed hue hard (orange lands on periwinkle), which
 * would throw away the one thing this card's colour has to say: hot.
 * "Expressive" here means the shape, motion and typography system, which is
 * what the rest of this file encodes.
 *
 * **Surfaces from `SchemeNeutral` seeded #4da3ff** — the shared house
 * neutral, byte-identical to every other card in this repo.
 *
 * The surfaces used to be seeded from heat too, on the reasoning that the
 * card should keep one identity while its accent changed underneath it. In
 * practice that meant a brown card: Vibrant's neutrals carry chroma ~10, so
 * an orange seed tints every surface. It read as wrong in real HA whenever
 * the geyser was *cooling* — a brown plate under a cyan accent — and it left
 * this card the only tinted one on a dashboard of neutral ones. Surface tint
 * and accent vividness are independent choices; the accent and the ambient
 * glow carry the heat/cool state, and the plate stays out of it.
 */
export const m3Tokens = css`
  :host {
    /* ---- colour: dark scheme, heat seed #ff8a3d ---- */
    --m3-primary: #ffb68d;
    --m3-on-primary: #532200;
    --m3-primary-container: #763300;
    --m3-on-primary-container: #ffdbc9;
    --m3-secondary: #edbe92;
    --m3-on-secondary: #472a0a;
    --m3-secondary-container: #60401e;
    --m3-on-secondary-container: #ffdcbe;
    --m3-tertiary: #ecbf78;
    --m3-on-tertiary: #432c00;
    --m3-tertiary-container: #5f4103;
    --m3-on-tertiary-container: #ffdead;
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
    --m3-inverse-primary: #9a4600;

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
    --m3-ease-standard: cubic-bezier(0.2, 0, 0, 1);

    /* ---- elevation (M3 dark surfaces lean on tone, so shadows stay soft) ---- */
    --m3-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15);
    --m3-elevation-2: 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15);
  }

  /* Cooling mode: accent roles only, regenerated from seed #22c1e2. Scoped to
     the host so every descendant picks the swap up through inheritance
     without a single component rule needing to know about modes. */
  :host([data-mode="cooling"]) {
    --m3-primary: #00d9ff;
    --m3-on-primary: #003641;
    --m3-primary-container: #004e5d;
    --m3-on-primary-container: #aeecff;
    --m3-secondary: #a9cbe3;
    --m3-on-secondary: #0e3447;
    --m3-secondary-container: #294a5e;
    --m3-on-secondary-container: #c5e7ff;
    --m3-tertiary: #a6c9f5;
    --m3-on-tertiary: #043256;
    --m3-tertiary-container: #23496e;
    --m3-on-tertiary-container: #d1e4ff;
  }

  /* ---- colour: light scheme ----
     Keyed off HA's own theme (data-theme, set from hass.themes.darkMode) and
     not prefers-color-scheme, since HA's theme toggle and the OS setting can
     disagree. */
  :host([data-theme="light"]) {
    --m3-primary: #9a4600;
    --m3-on-primary: #ffffff;
    --m3-primary-container: #ffdbc9;
    --m3-on-primary-container: #321200;
    --m3-secondary: #7b5733;
    --m3-on-secondary: #ffffff;
    --m3-secondary-container: #ffdcbe;
    --m3-on-secondary-container: #2d1600;
    --m3-tertiary: #7a581b;
    --m3-on-tertiary: #ffffff;
    --m3-tertiary-container: #ffdead;
    --m3-on-tertiary-container: #281900;
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
    --m3-inverse-primary: #ffb68d;
    --m3-elevation-1: 0 1px 2px rgba(48, 48, 49, 0.12), 0 1px 3px 1px rgba(48, 48, 49, 0.08);
    --m3-elevation-2: 0 1px 2px rgba(48, 48, 49, 0.14), 0 2px 6px 2px rgba(48, 48, 49, 0.08);
  }

  :host([data-theme="light"][data-mode="cooling"]) {
    --m3-primary: #00687b;
    --m3-on-primary: #ffffff;
    --m3-primary-container: #aeecff;
    --m3-on-primary-container: #001f26;
    --m3-secondary: #416277;
    --m3-on-secondary: #ffffff;
    --m3-secondary-container: #c5e7ff;
    --m3-on-secondary-container: #001e2d;
    --m3-tertiary: #3d6187;
    --m3-on-tertiary: #ffffff;
    --m3-tertiary-container: #d1e4ff;
    --m3-on-tertiary-container: #001d36;
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
  .m3-display-small {
    font-size: 36px;
    line-height: 44px;
    font-weight: 400;
    letter-spacing: 0;
  }
  .m3-display-small-emphasized {
    font-size: 36px;
    line-height: 44px;
    font-weight: 700;
    letter-spacing: 0;
  }
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
