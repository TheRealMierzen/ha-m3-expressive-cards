/**
 * Colour ramps for the heatmap.
 *
 * A palette is stored as a *hue path* — one seed colour per waypoint — and the
 * lightness and chroma come from a fixed schedule applied on top, per theme.
 * Two properties fall out of that which a table of hand-picked hex values
 * kept getting wrong:
 *
 * - **Monotone lightness.** Every shade is lighter than the one below it in
 *   dark mode and darker in light mode, so the ramp still reads as an ordered
 *   scale in greyscale or to a colour-blind viewer, not only by hue.
 * - **A floor that clears the empty cell.** The faintest shade has to be
 *   visibly *something* against an unfilled day. Tuned by hand, roughly half
 *   the palettes had a first shade within a hair of the empty cell's own
 *   luminance and were separated only by hue — invisible at an 8px cell.
 *
 * The schedule also means `color: "#2ea043"` produces exactly the ramp that
 * `palette: github` does, and that any level count from 1 to 9 is sampled from
 * the same curve rather than interpolated out of four fixed stops.
 */

type Triple = [number, number, number];

/**
 * Hue waypoints, faintest end first. A single entry is a one-hue ramp; several
 * walk from one hue to the next, which carries magnitude faster than
 * lightness alone at a glance. Waypoints are adjacent hues on purpose —
 * interpolation runs straight through the a/b plane, and opposite hues would
 * pass through grey on the way.
 */
const PALETTES: Record<string, string[]> = {
  github: ["#2ea043"],
  emerald: ["#10b981"],
  teal: ["#14b8a6"],
  cyan: ["#06b6d4"],
  blue: ["#3b82f6"],
  indigo: ["#6366f1"],
  purple: ["#a855f7"],
  pink: ["#ec4899"],
  red: ["#ef4444"],
  orange: ["#f97316"],
  amber: ["#f59e0b"],
  lime: ["#84cc16"],
  mono: ["#8a98a6"],
  heat: ["#facc15", "#f97316", "#ef4444"],
  ocean: ["#10b981", "#0ea5e9", "#4f46e5"],
  aurora: ["#34d399", "#22d3ee", "#818cf8", "#c084fc"],
};

/**
 * Lightness and chroma envelopes, faintest → strongest.
 *
 * Dark mode climbs out of the card's background and light mode descends into
 * it, and the two floors (0.36 and 0.83) are where the faintest shade clears
 * the empty cell by a comfortable margin in each theme. Chroma is held back at
 * the faint end so a low day reads as a tint rather than as a small saturated
 * dot.
 */
const SCHEDULE = {
  dark: { lightness: [0.36, 0.8], chroma: [0.55, 1] },
  light: { lightness: [0.83, 0.42], chroma: [0.62, 1] },
};

export const PALETTE_NAMES: string[] = Object.keys(PALETTES);

export const DEFAULT_PALETTE = "github";

/* ---------------------------------------------------------------- colour IO */

function parseHex(color: string): Triple | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim());
  if (!match) return null;
  const digits = match[1];
  const full =
    digits.length <= 4
      ? digits
          .slice(0, 3)
          .split("")
          .map((c) => c + c)
          .join("")
      : digits.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as Triple;
}

function toHex(rgb: Triple): string {
  const channel = (v: number): string =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(rgb[0])}${channel(rgb[1])}${channel(rgb[2])}`;
}

const toLinear = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number): number => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function srgbToOklab([r, g, b]: Triple): Triple {
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToSrgb([L, a, b]: Triple): Triple {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** Sample an OKLab-interpolated ramp of explicit stops at `t` ∈ [0, 1]. Used
 * only for a user-supplied `palette` list; the named palettes go through
 * `scheduledRamp` instead. */
function sampleRamp(stops: Triple[], t: number): Triple {
  if (stops.length === 1) return stops[0];
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(x));
  const f = x - index;
  if (f === 0) return stops[index];
  const a = srgbToOklab(stops[index]);
  const b = srgbToOklab(stops[index + 1]);
  return oklabToSrgb([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
}

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

/**
 * One shade from a hue path plus the theme's lightness/chroma envelope.
 *
 * The hue direction is interpolated as a vector in OKLab's a/b plane and then
 * rescaled, rather than as an angle — no wrap-around to get wrong, and for the
 * adjacent hues these paths use, the straight line is the short way round.
 */
function scheduledRamp(seeds: Triple[], t: number, darkMode: boolean): Triple {
  const schedule = darkMode ? SCHEDULE.dark : SCHEDULE.light;
  const clamped = Math.min(1, Math.max(0, t));
  const lightness = lerp(schedule.lightness[0], schedule.lightness[1], clamped);
  const chromaScale = lerp(schedule.chroma[0], schedule.chroma[1], clamped);

  const labs = seeds.map(srgbToOklab);
  const x = clamped * (labs.length - 1);
  const index = Math.min(Math.max(labs.length - 2, 0), Math.floor(x));
  const f = labs.length === 1 ? 0 : x - index;
  const next = labs[Math.min(index + 1, labs.length - 1)];
  const a = lerp(labs[index][1], next[1], f);
  const b = lerp(labs[index][2], next[2], f);
  const chroma = lerp(Math.hypot(labs[index][1], labs[index][2]), Math.hypot(next[1], next[2]), f);

  const length = Math.hypot(a, b);
  if (length === 0) return oklabToSrgb([lightness, 0, 0]);
  const scale = (chroma * chromaScale) / length;
  return oklabToSrgb([lightness, a * scale, b * scale]);
}

/* -------------------------------------------------------------------- public */

export const MAX_LEVELS = 9;

export function clampLevels(levels: number | undefined): number {
  if (levels === undefined || !Number.isFinite(levels)) return 4;
  return Math.min(Math.max(Math.round(levels), 1), MAX_LEVELS);
}

/**
 * The colour for each filled level, low → high, `levels` entries long.
 *
 * Resolution order: an explicit `palette` list, then a named palette, then
 * `color` treated as a one-waypoint hue path, then the default. Only the
 * explicit list bypasses the schedule — if you spell out the colours, you get
 * exactly those colours, blended when the level count doesn't match.
 */
export function levelColors(
  palette: string | string[] | undefined,
  color: string | undefined,
  levels: number,
  darkMode: boolean
): string[] {
  const count = clampLevels(levels);
  const positions = Array.from({ length: count }, (_, i) => (count === 1 ? 1 : i / (count - 1)));

  if (Array.isArray(palette) && palette.length > 0) {
    const parsed = palette.map(parseHex);
    if (parsed.every((stop): stop is Triple => stop !== null)) {
      return positions.map((t) => toHex(sampleRamp(parsed, t)));
    }
    // Unparseable stops — a var() token, an rgb() string, a CSS colour name.
    // Those can't be blended, so they're passed through untouched and
    // distributed by nearest stop instead.
    return positions.map((t) => palette[Math.round(t * (palette.length - 1))]);
  }

  const named = typeof palette === "string" ? PALETTES[palette.trim().toLowerCase()] : undefined;
  const seedHexes = named ?? (color ? [color] : PALETTES[DEFAULT_PALETTE]);
  const seeds = seedHexes.map(parseHex).filter((seed): seed is Triple => seed !== null);
  const path = seeds.length > 0 ? seeds : (PALETTES[DEFAULT_PALETTE].map(parseHex) as Triple[]);
  return positions.map((t) => toHex(scheduledRamp(path, t, darkMode)));
}

/**
 * Ink for text drawn on a filled cell — used by the legend's optional value
 * labels. Falls back to white for anything it can't parse rather than
 * guessing at a theme token's real value.
 */
export function readableTextColor(color: string): string {
  const rgb = parseHex(color);
  if (!rgb) return "#ffffff";
  const luminance =
    0.2126 * toLinear(rgb[0]) + 0.7152 * toLinear(rgb[1]) + 0.0722 * toLinear(rgb[2]);
  return luminance > 0.45 ? "#0b0b0b" : "#ffffff";
}

/* --------------------------------------------------------------- categorical */

/**
 * Hues for the per-state breakdown, in a fixed order.
 *
 * A sequential ramp is exactly wrong here: those shades are ordered on purpose,
 * and using them for unordered categories would imply that "Elden Ring" ranks
 * above "Baldur's Gate 3" rather than merely differing from it. These are
 * spaced around the hue circle instead, at one lightness, so no state looks
 * more important than another. Hand-ordered rather than evenly divided so that
 * the first few — which is all most days need — are maximally distinct.
 */
const CATEGORICAL_HUES = [145, 250, 35, 320, 195, 80, 285, 10, 170, 55, 305, 220];

/** Lightness and chroma for a categorical swatch, per theme. */
const CATEGORICAL = {
  dark: { lightness: 0.74, chroma: 0.135 },
  light: { lightness: 0.56, chroma: 0.15 },
};

export function categoricalColors(count: number, darkMode: boolean): string[] {
  const { lightness, chroma } = darkMode ? CATEGORICAL.dark : CATEGORICAL.light;
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    // Past the hue list, the same hues come back a step darker rather than
    // repeating outright, so a long tail stays distinguishable.
    const cycle = Math.floor(i / CATEGORICAL_HUES.length);
    const radians = (CATEGORICAL_HUES[i % CATEGORICAL_HUES.length] * Math.PI) / 180;
    const shift = darkMode ? -0.12 * cycle : 0.12 * cycle;
    const c = chroma * (cycle > 0 ? 0.85 : 1);
    return toHex(oklabToSrgb([lightness + shift, Math.cos(radians) * c, Math.sin(radians) * c]));
  });
}

/**
 * The colour for a state, honouring a `state_colors` override. Ranks come from
 * the whole range rather than the selected day, so a state keeps its colour as
 * you click from day to day.
 */
export function stateColor(
  state: string,
  rank: number,
  overrides: Record<string, string> | undefined,
  palette: string[],
  darkMode: boolean
): string {
  const override = overrides?.[state];
  if (override) {
    const named = PALETTES[override.trim().toLowerCase()];
    // A palette name resolves to that palette's strongest shade, so
    // `state_colors: {Doom: red}` works without spelling out a hex value.
    if (named) return toHex(scheduledRamp(named.map(parseHex) as Triple[], 1, darkMode));
    return override;
  }
  return palette[rank % palette.length] ?? palette[0];
}
