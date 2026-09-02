/**
 * Fixed-order categorical palette (validated for adjacent-pair colorblind
 * safety in both light and dark mode). Assigned in order to lanes, never
 * cycled arbitrarily — see the dataviz skill's color-formula guidance.
 *
 * Because every lane also carries a direct text label (the entity name),
 * color here is a quick-scan aid rather than the sole identity channel, so
 * wrapping back to slot 1 past 8 entities (rare, but "a lot of" helpers is
 * plausible) degrades gracefully instead of needing an "Other" bucket.
 */
const LIGHT: string[] = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

const DARK: string[] = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
];

export function paletteColor(index: number, darkMode: boolean): string {
  const ramp = darkMode ? DARK : LIGHT;
  return ramp[index % ramp.length];
}

/**
 * Per the dataviz mark spec: a label set inside a colored fill is the one
 * case where text departs from ink tokens — pick white or near-black by the
 * fill's own luminance so it always clears contrast. Works for palette
 * colors and arbitrary user-supplied `color:` overrides alike, since it's
 * computed from the actual hex rather than looked up per palette slot.
 */
export function readableTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance =
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  return luminance > 0.45 ? "#0b0b0b" : "#ffffff";
}
