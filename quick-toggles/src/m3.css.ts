import { css } from "lit";

/**
 * Material 3 Expressive design tokens for this card.
 * See ../../M3-EXPRESSIVE.md for the system; this file is the card's copy.
 *
 * **Surfaces come from `SchemeNeutral`, accents from `SchemeVibrant`**, both
 * seeded #4da3ff (the card's default toggle colour). That split is
 * deliberate and specific to this card: a medallion row shows up to fifteen
 * different accent colours at once, so the surfaces underneath them have to
 * be a neutral stage rather than a tinted one. `SchemeVibrant`'s neutral
 * palette carries chroma ~10 and would have every medallion sitting on a
 * blue-tinted plate fighting its own colour; `SchemeNeutral` is chroma ~2.
 * The accent roles stay Vibrant so the focus ring and chrome still have some
 * life. (M3-EXPRESSIVE.md documents that surface tint and accent vividness
 * are independent choices — this is that lever being pulled.)
 *
 * Per-toggle colours are NOT in here. They're a lookup table in colors.ts,
 * because they're part of this card's config surface rather than its theme.
 */
/**
 * The theme-independent half of the token set: shape, motion, state-layer
 * opacities. Split out from m3Tokens so the editor can share the exact same
 * springs and shape scale for its live medallion previews without also
 * inheriting the card's colour roles — the editor is deliberately plain, and
 * should look like HA's own config panels rather than like the card.
 */
export const m3System = css`
  :host {
    --m3-state-hover: 0.08;
    --m3-state-focus: 0.1;
    --m3-state-pressed: 0.1;

    /* ---- shape ---- */
    --m3-shape-xs: 4px;
    --m3-shape-s: 8px;
    --m3-shape-m: 12px;
    --m3-shape-l: 16px;
    --m3-shape-xl: 28px;
    --m3-shape-full: 999px;

    /* ---- motion: springs sampled from the real damped oscillator ----
       Spatial springs are underdamped (0.6-0.8) and genuinely overshoot;
       effects springs are critically damped (1.0) for colour and opacity,
       where an overshoot would be a glitch rather than a bounce. */
    --m3-spring-spatial-fast: linear(0, 0.0754, 0.2492, 0.458, 0.6588, 0.8269, 0.952, 1.0338, 1.0783, 1.0942, 1.0906, 1.0759, 1.0565, 1.037, 1.0201, 1.0072, 0.9984, 0.9934, 0.9912, 0.9912, 0.9924, 0.9942, 0.996, 0.9977, 1);
    --m3-spring-spatial-fast-duration: 360ms;
    --m3-spring-spatial-default: linear(0, 0.0516, 0.1705, 0.3163, 0.4636, 0.598, 0.7123, 0.8044, 0.8751, 0.9271, 0.9636, 0.9877, 1.0026, 1.0108, 1.0144, 1.0151, 1.0141, 1.0122, 1.01, 1.0077, 1.0058, 1.0041, 1.0027, 1.0017, 1);
    --m3-spring-spatial-default-duration: 435ms;
    --m3-spring-effects-fast: linear(0, 0.0576, 0.1807, 0.3214, 0.4558, 0.5737, 0.6718, 0.7508, 0.8128, 0.8606, 0.897, 0.9244, 0.9448, 0.9599, 0.9709, 0.979, 0.9849, 0.9892, 0.9923, 0.9945, 0.9961, 0.9972, 0.998, 0.9986, 1);
    --m3-spring-effects-fast-duration: 150ms;
    --m3-spring-effects-default: linear(0, 0.0576, 0.1805, 0.3211, 0.4555, 0.5733, 0.6714, 0.7504, 0.8125, 0.8604, 0.8968, 0.9242, 0.9446, 0.9597, 0.9708, 0.979, 0.9849, 0.9892, 0.9922, 0.9945, 0.9961, 0.9972, 0.998, 0.9986, 1);
    --m3-spring-effects-default-duration: 231ms;
    --m3-ease-emphasized: cubic-bezier(0.2, 0, 0, 1);

  }
`;

export const m3Tokens = css`
  :host {
    /* ---- dark ---- */
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
    --m3-primary: #a2c9ff;
    --m3-on-primary: #00315b;
    --m3-primary-container: #004881;
    --m3-on-primary-container: #d3e4ff;
    --m3-secondary: #bbc5ea;
    --m3-secondary-container: #3c4665;
    --m3-on-secondary-container: #dbe1ff;
    --m3-error: #ffb4ab;

    --m3-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15);
  }

  /* Keyed off HA's own theme (data-theme, from hass.themes.darkMode), not
     prefers-color-scheme — the OS setting and HA's toggle can disagree. */
  :host([data-theme="light"]) {
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
    --m3-primary: #0060a9;
    --m3-on-primary: #ffffff;
    --m3-primary-container: #d3e4ff;
    --m3-on-primary-container: #001c38;
    --m3-secondary: #535d7e;
    --m3-secondary-container: #dbe1ff;
    --m3-on-secondary-container: #0f1a37;
    --m3-error: #ba1a1a;
    --m3-elevation-1: 0 1px 2px rgba(27, 27, 29, 0.12), 0 1px 3px 1px rgba(27, 27, 29, 0.08);
  }

  /* Durations collapse in one place rather than each rule opting out.
     Keyframe animations still need their own animation:none — and note
     that in this card losing motion loses a *state channel*, which is why
     resolveItems() substitutes a static badge and full-strength ring for
     anything that would have animated. */
  @media (prefers-reduced-motion: reduce) {
    :host {
      --m3-spring-spatial-fast-duration: 1ms;
      --m3-spring-spatial-default-duration: 1ms;
      --m3-spring-effects-fast-duration: 1ms;
      --m3-spring-effects-default-duration: 1ms;
    }
  }
`;

/** M3 Expressive type scale — only the steps this card actually uses. */
export const m3Type = css`
  .m3-title-small {
    font-size: 14px;
    line-height: 20px;
    font-weight: 500;
    letter-spacing: 0.1px;
  }
  .m3-label-large {
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
`;
