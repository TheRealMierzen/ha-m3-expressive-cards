/**
 * Named colours for medallions, as [dark-mode, light-mode] pairs. Two ramps
 * rather than one because a medallion's colour is drawn on a near-black
 * plate in dark mode and a near-white one in light mode — a single hex that
 * reads well on one is washed out or glaring on the other.
 *
 * Unlike schedule-timeline-card's palette, these are *chosen* per toggle
 * rather than auto-assigned, so this is a lookup table, not an ordered ramp.
 *
 * **Generated, not hand-picked** (see ../../M3-EXPRESSIVE.md): each entry is
 * the M3 tonal palette of that hue sampled at **tone 80 for dark and tone 40
 * for light** — the tones M3 uses for `primary` in its dark and light
 * schemes. The seeds are the previous hand-picked dark hexes, so the hues are
 * unchanged; only the tones are standardised.
 *
 * That was a correctness fix, not a coat of paint. The glyph is drawn in this
 * colour on a plate that is a tint of the same colour, and the old
 * hand-picked light ramp was not dark enough for that to work: measured
 * against the light-mode plate, 8 of 14 colours fell below the 3:1 WCAG
 * requires for graphical objects (cyan 2.62, teal 2.37, yellow 2.44, amber
 * 2.38, orange 2.46, green 2.69, lime 2.50, pink 2.90), and none reached
 * 4.5:1. On the tonal ramp the worst case is 4.05:1 and every colour passes.
 * Dark mode also becomes consistent — 7.6-7.7:1 across the board, where the
 * old ramp ranged from 5.29 to 9.49.
 *
 * If you re-seed these, re-run that contrast check; the tone pair is what
 * makes the medallion legible, not the hue.
 */
const NAMED: Record<string, [string, string]> = {
  neutral: ["#bdc8d4", "#55606a"],
  grey: ["#bdc8d4", "#55606a"],
  red: ["#ffb3b0", "#ae2f34"],
  pink: ["#ffafd3", "#a43073"],
  purple: ["#d4bbff", "#7046b8"],
  indigo: ["#bac3ff", "#4457b3"],
  blue: ["#a2c9ff", "#0060a9"],
  cyan: ["#42d8f0", "#006876"],
  teal: ["#41deb8", "#006b56"],
  green: ["#64dd97", "#006d3f"],
  lime: ["#abd54a", "#4c6700"],
  yellow: ["#e2c54e", "#705d00"],
  amber: ["#ffb955", "#835500"],
  orange: ["#ffb68d", "#9a4600"],
  brown: ["#e7bfa3", "#775842"],
};

export const COLOR_NAMES: string[] = Object.keys(NAMED).filter((n) => n !== "grey");

/** The colour a toggle uses when its config names none. */
export function defaultColor(darkMode: boolean): string {
  return NAMED.blue[darkMode ? 0 : 1];
}

/**
 * Accepts a palette name, a raw CSS colour (`#rrggbb`, `rgb(...)`,
 * `hsl(...)`) or a `var(--...)` reference, so a user's own theme token works
 * as well as the built-in names. Anything unrecognised falls back rather
 * than rendering an invisible medallion.
 */
export function resolveColor(value: string | undefined, darkMode: boolean, fallback: string): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (trimmed === "") return fallback;
  const named = NAMED[trimmed.toLowerCase()];
  if (named) return named[darkMode ? 0 : 1];
  if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) return trimmed;
  if (/^(rgb|rgba|hsl|hsla|color|color-mix|oklch|lab)\(/i.test(trimmed)) return trimmed;
  if (/^var\(\s*--/.test(trimmed)) return trimmed;
  return fallback;
}

/**
 * Ink for text sitting inside a coloured fill — the numeric badge. Picked by
 * the fill's own luminance so palette colours and user-supplied hex both
 * clear contrast (same approach as schedule-timeline-card's palette.ts).
 *
 * A colour this can't parse (a var() reference, a named CSS colour) falls
 * back to white with no attempt to guess, since the card can't read the
 * theme token's actual value.
 */
export function readableTextColor(color: string): string {
  const hex = color.trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) return "#ffffff";
  const digits = match[1];
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((c) => c + c)
          .join("")
      : digits;
  const channel = (start: number): number => parseInt(full.slice(start, start + 2), 16) / 255;
  const linearize = (c: number): number => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance =
    0.2126 * linearize(channel(0)) + 0.7152 * linearize(channel(2)) + 0.0722 * linearize(channel(4));
  return luminance > 0.45 ? "#0b0b0b" : "#ffffff";
}
