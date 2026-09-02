# Material 3 Expressive — the house style for these cards

This is the standard visual language for every card in this repo. It
supersedes the older shared `--pc-` custom-property scheme.

**[CONTRIBUTING.md](CONTRIBUTING.md) remains the source of truth for structure** — layout,
non-negotiables, collapsibles, container queries, testing, deploy. This file
covers only the design system: tokens, component recipes, and the pitfalls
that cost real time to find. Don't restate CONTRIBUTING.md rules here; link to them.

## Status

| Card | State | What it demonstrates |
|---|---|---|
| `geyser-control` | **Migrated** | Single accent that swaps with state, over neutral surfaces. Wavy progress, connected button group, switch, shape morph, ambient glow that carries the state. |
| `quick-toggles` | **Migrated** | Many accents at once. Neutral surfaces, generated per-item tonal palette, shared token split with its editor. |
| `garage-control` | **Migrated** | Extended semantic colour (a generated `success` role alongside `error`). Shared switch + leading-icon header. **Press-and-hold** on a physical-consequence action, rendering only the one control that applies, with a progress fill deliberately outside the motion tokens and a shape morph on the critically-damped spring. |
| `pc-control` | **Migrated** | The dense one: eight tiles, a shared linear progress component, a connected power group with the destructive action deliberately outside it, and four semantic states aliased behind `.good`/`.warn`/`.bad`/`.info`. |
| `irrigation-control` | **Migrated** | Wavy progress used for its actual purpose — a timer that really is counting down — flattening when paused. Two switches from one helper. |
| `schedule-timeline-card` | **Migrated** | The second data-colour card: M3 chrome over a categorical lane palette kept in `palette.ts`. M3 filter chips with real selected/deselected states. |
| `activity-heatmap` | **Migrated** | Chrome on M3, data colour deliberately outside it. Tooltip on inverse-surface. |
| `gym-tracker` | **Migrated** | House-neutral surfaces under an unrelated accent hue. Extended semantic colour as an ordered scale (success/warning/error) aliased behind one host attribute; determinate circular progress with an active/gap/track split. |
| `body-stats` | **Migrated** | Semantic colour as a *fill*, not a mark: an SVG figure whose regions carry the three-step scale, with a theme-relative ink edge. |

Copy from whichever migrated card is closer in shape: one accent driven by
state, or many accents chosen in config.

**Every card is migrated.** New cards start here; update the table when you
add one.

## "Expressive" means shape, motion and type — not the colour variant

Material 3 Expressive is the 2025 update to M3. Its substance for our purposes
is a bigger shape scale, spring-based motion with real overshoot, heavier
"emphasized" type weights, and a set of components (wavy progress, connected
button groups, shape morphing on press) that read as more confident than
plain M3.

It is **not** `SchemeExpressive` from `@material/material-color-utilities`.
That is a colour-scheme variant that deliberately rotates the seed hue, and
it will happily turn your semantic colour into something that means nothing.
See pitfall 1.

---

# The token contract

Each card carries `src/m3.css.ts`, exporting two Lit `CSSResult` chunks:

```ts
export const m3Tokens = css`...`;   // :host custom properties
export const m3Type   = css`...`;   // .m3-* type-scale classes
```

`src/card.css.ts` pulls both in at the top of its own sheet:

```ts
import { css } from "lit";
import { m3Tokens, m3Type } from "./m3.css";

export const cardStyles = css`
  ${m3Tokens}
  ${m3Type}
  /* component styles below */
`;
```

(If the card's editor also renders card components, see *Splitting the token
file* below — the editor needs the system half without the colour half.)

**The rule: no literal colour, corner radius, or duration below that line.**
Everything is `var(--m3-*)`. This is what makes "reseed the palette" or "make
it bouncier" a one-file change instead of a grep. The only permitted literals
in `card.css.ts` are inside SVG data-URIs, which cannot reference custom
properties (pitfall 8).

## Colour roles

Standard M3 role names, prefixed `--m3-`:

```
primary / on-primary / primary-container / on-primary-container
secondary / on-secondary / secondary-container / on-secondary-container
tertiary / on-tertiary / tertiary-container / on-tertiary-container
error / on-error / error-container / on-error-container
surface / on-surface / surface-variant / on-surface-variant
surface-dim / surface-bright
surface-container-lowest / -low / (none) / -high / -highest
outline / outline-variant
inverse-surface / inverse-on-surface / inverse-primary
```

Plus the state-layer opacities, because M3 interaction feedback is a tinted
overlay of the *content* colour, never a different background colour:

```
--m3-state-hover: 0.08
--m3-state-focus: 0.1
--m3-state-pressed: 0.1
```

### Rough guide to which surface goes where

| Role | Use |
|---|---|
| `surface-container-low` | the card at rest |
| `surface-container` | the card in its "active" state |
| `surface-container-high` | tonal cards/tiles sitting on the card |
| `surface-container-highest` | inert value read-outs, switch track when off |
| `secondary-container` | interactive controls (button-group segments, chips) |
| `primary-container` | the one element carrying the card's state colour |
| `tertiary-container` | a distinct aside — a banner that shouldn't compete |
| `outline` | switch borders, off-state thumb |
| `outline-variant` | hairline dividers |

### State colour swaps

Swap only the **accent** roles (primary/secondary/tertiary + containers) via
an attribute on the host, and leave the surface/neutral roles alone. Surfaces
stay seeded from one hue so the card keeps a single identity while its state
colour changes underneath it:

```css
:host([data-mode="cooling"]) {
  --m3-primary: #00d9ff;
  /* ...accent roles only... */
}
```

Because the tokens are inherited custom properties on `:host`, every
descendant picks the change up for free and **not one component rule has to
know that modes exist.** Set the attribute in the `hass` setter alongside
`data-theme`.

Light theme uses the same mechanism — `:host([data-theme="light"])`, driven
by `hass.themes.darkMode`, never `prefers-color-scheme` (see CONTRIBUTING.md).

## Shape scale

```
--m3-shape-none: 0     --m3-shape-l: 16px
--m3-shape-xs: 4px     --m3-shape-l-increased: 20px
--m3-shape-s: 8px      --m3-shape-xl: 28px
--m3-shape-m: 12px     --m3-shape-xl-increased: 32px
                       --m3-shape-xxl: 48px
                       --m3-shape-full: 999px
```

`ha-card` uses `--m3-shape-xl`. Tonal tiles and banners use `--m3-shape-l`.

## Motion

M3 Expressive's **spatial** springs are underdamped — damping 0.6–0.8, versus
0.9 in the standard motion scheme. They overshoot and settle, and that visible
bounce is the entire point. **Effects** springs are critically damped (1.0):
no overshoot, for colour and opacity where an overshoot reads as a glitch.

| Token | damping | stiffness | duration |
|---|---|---|---|
| `--m3-spring-spatial-fast` | 0.6 | 800 | 360ms |
| `--m3-spring-spatial-default` | 0.8 | 380 | 435ms |
| `--m3-spring-spatial-slow` | 0.8 | 200 | 600ms |
| `--m3-spring-effects-fast` | 1.0 | 3800 | 150ms |
| `--m3-spring-effects-default` | 1.0 | 1600 | 231ms |
| `--m3-spring-effects-slow` | 1.0 | 800 | 327ms |

The generator emits all six; `geyser-control` currently ships the first five,
since nothing there needed `effects-slow`. Add it to `m3.css.ts` if you use it
— referencing a token that isn't defined fails silently.

Each spring ships as a `linear()` easing plus a matching
`--m3-spring-<name>-duration`. Always use them as a pair:

```css
transition: left var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
```

Also available for the few things that must not bounce:
`--m3-ease-emphasized: cubic-bezier(0.2, 0, 0, 1)`. Use it for `max-height`
on collapsibles — a spring's overshoot there is invisible anyway (it just
means the clip is briefly larger than the content), so the extra duration
buys nothing.

### Reduced motion

Collapse the **duration** tokens to `1ms` in one `@media
(prefers-reduced-motion: reduce)` block inside `m3.css.ts`, rather than having
each component rule opt out separately. Keyframe animations (ambient glow,
wave scroll) still need their own `animation: none`, and the imperative
collapse animation in the card element still needs its `_prefersReducedMotion()`
early return.

## Type scale

`m3Type` provides `.m3-*` classes; apply them in the template rather than
restating sizes in component rules.

```
.m3-display-small(-emphasized)   36/44   hero numerals
.m3-title-medium-emphasized      16/24   card title, tile values
.m3-title-small                  14/20
.m3-body-medium                  14/20   row labels
.m3-body-small                   12/16   supporting text
.m3-label-large(-emphasized)     14/20   section headers, buttons
.m3-label-medium                 12/16   tile labels, chips
.m3-label-small                  11/16   captions
```

The `-emphasized` variants are the Expressive addition — heavier weights that
carry the more confident voice. Use them for anything that should be read
first.

---

# Generating the palette

Colour roles are **generated, not picked.** Do not hand-author hexes.

> **Pin `@0.2.7`.** Two separate reasons, both verified:
>
> - `@0.4.0` does not load under plain Node at all — extensionless internal
>   ESM imports, dying with `ERR_MODULE_NOT_FOUND` on
>   `dynamiccolor/dynamic_color`. 0.3.0 and 0.2.7 load fine.
> - **0.3.0 and 0.2.7 produce different colours.** Same seed, same variant,
>   different output for some light-scheme roles. The tokens currently shipped
>   in `geyser-control` were generated with **0.2.7**, so regenerating on
>   0.3.0 silently changes the light theme. See pitfall 13.

Run this in the session scratchpad, not the repo — the output is pasted into
`m3.css.ts` and the card ships no colour dependency:

```js
// npm i @material/material-color-utilities@0.2.7
const m = require('@material/material-color-utilities');
const M = m.MaterialDynamicColors;

const ROLES = [
  ['primary','primary'], ['on-primary','onPrimary'],
  ['primary-container','primaryContainer'], ['on-primary-container','onPrimaryContainer'],
  ['secondary','secondary'], ['on-secondary','onSecondary'],
  ['secondary-container','secondaryContainer'], ['on-secondary-container','onSecondaryContainer'],
  ['tertiary','tertiary'], ['on-tertiary','onTertiary'],
  ['tertiary-container','tertiaryContainer'], ['on-tertiary-container','onTertiaryContainer'],
  ['error','error'], ['on-error','onError'],
  ['error-container','errorContainer'], ['on-error-container','onErrorContainer'],
  ['surface','surface'], ['on-surface','onSurface'],
  ['surface-variant','surfaceVariant'], ['on-surface-variant','onSurfaceVariant'],
  ['surface-dim','surfaceDim'], ['surface-bright','surfaceBright'],
  ['surface-container-lowest','surfaceContainerLowest'],
  ['surface-container-low','surfaceContainerLow'],
  ['surface-container','surfaceContainer'],
  ['surface-container-high','surfaceContainerHigh'],
  ['surface-container-highest','surfaceContainerHighest'],
  ['outline','outline'], ['outline-variant','outlineVariant'],
  ['inverse-surface','inverseSurface'], ['inverse-on-surface','inverseOnSurface'],
  ['inverse-primary','inversePrimary'],
];
// Accent-only subset, for a state colour swap.
const ACCENT = ROLES.filter(([n]) => /^(on-)?(primary|secondary|tertiary)(-container)?$/.test(n));

function emit(seed, dark, roles) {
  const s = new m.SchemeVibrant(m.Hct.fromInt(m.argbFromHex(seed)), dark, 0);
  return roles.map(([n, k]) => `    --m3-${n}: ${m.hexFromArgb(M[k].getArgb(s))};`).join('\n');
}

console.log(emit('#ff8a3d', true,  ROLES));   // dark base
console.log(emit('#22c1e2', true,  ACCENT));  // dark, alternate state accents
console.log(emit('#ff8a3d', false, ROLES));   // light base
console.log(emit('#22c1e2', false, ACCENT));  // light, alternate state accents
```

## Extended semantic colours (success, warning, …)

M3 ships exactly one semantic role beyond the accents: `error`. Cards often
need more — `garage-control` has a genuine third state ("home") that isn't an
accent and isn't an error.

Generate them as M3 **custom colours** rather than hand-mixing an rgba: a tonal
palette from one seed, sampled at the standard custom-colour tones.

```js
const p = m.TonalPalette.fromInt(m.argbFromHex('#0f9f78'));
const tone = (t) => m.hexFromArgb(p.tone(t));
// light: colour T40, on-colour T100, container T90, on-container T10
// dark:   colour T80, on-colour T20,  container T30, on-container T90
```

That gives the same contrast guarantees as the built-in roles, and the
container/on-container pair is what tonal badges and chips should use.

**Don't reach for `error` just because something is red.** `error` means
"something is wrong". A state that is merely *notable* — away, paused, stale —
is `tertiary` or a custom colour. `garage-control` keeps red for "away"
because that was the original card's deliberate at-a-glance signal, and its
CONTRIBUTING.md says so explicitly rather than letting a future reader assume M3
recommended it.

## Cards with many accent colours at once

`geyser-control` has one accent that changes with state. `quick-toggles` has
up to fifteen on screen simultaneously, one per toggle, chosen in config.
M3's palette is single-seed, so that needs a deliberate split:

- **Surfaces from `SchemeNeutral`, accents from `SchemeVibrant`**, same seed.
  A tinted surface (Vibrant's neutrals are chroma ~10) puts every accent on a
  plate that fights it; `SchemeNeutral` is ~2 and acts as a neutral stage.
  This is the "surface tint and accent vividness are independent" lever below,
  pulled hard.
- **Per-toggle colours live in a lookup table, not in the token file.** They
  are part of the card's *config surface*, not its theme. Keep them out of
  `m3.css.ts`.
- **Generate them as tonal pairs anyway.** Sample each hue's tonal palette at
  **tone 80 for dark, tone 40 for light** — M3's own `primary` tones. Hand-
  picked ramps drift out of contrast: quick-toggles' did, with 8 of 14
  colours below 3:1 in light theme against their own tinted plate. The tonal
  ramp fixed every one of them and made contrast consistent
  (see its DESIGN.md for the measurements).

```js
const tone = (seed, t) =>
  m.hexFromArgb(m.TonalPalette.fromInt(m.argbFromHex(seed)).tone(t));
// [dark, light] for each named colour
[tone(seed, 80), tone(seed, 40)]
```

**Always re-measure contrast after re-seeding a multi-accent palette.** The
glyph is usually drawn in the accent on a tint of the same accent, and that
pairing is exactly where a plausible-looking hex fails. WCAG wants 3:1 for
graphical objects, not 4.5:1 — but aim past it.

## Cards that render data colour

A heatmap ramp, a chart series, a category legend — these are **data**
encodings, and M3 does not model them. Its tonal palette is a lightness ramp of
one hue; it has no notion of an ordered scale, of perceptual uniformity across
a series, or of a faintest step that must clear an empty slot. `activity-heatmap`
keeps its ramp in `palette.ts`, built in OKLab with a per-theme
monotone-lightness schedule, and that is the right call — swapping in M3 tones
would be a regression.

**Draw the line at chrome.** Card surface, board, tooltip, labels, legend
furniture, controls, focus rings — M3 tokens. The values being visualised —
their own colour module, outside the token system. Say so in the card's
`m3.css.ts` so nobody "finishes the migration" later.

`schedule-timeline-card` is the second one, and the split is the same:
its chrome is M3, its lane colours are a *categorical* set hand-validated
for adjacent-pair colourblind safety. M3 has no more notion of a set of
mutually distinguishable categories than it does of an ordered ramp, so that
palette stays where it is too.

Two things to watch when you migrate a card like this:

- **The data colours are tuned against the old surfaces.** Changing the card or
  board colour silently moves every contrast margin the palette was built to
  hold. Measure the relevant adjacency before and after — for a heatmap that's
  the faintest filled shade against the empty cell, per theme, per palette;
  for the timeline it's all eight lane colours against the lane track. Do it
  as an explicit before/after table with a regression count, not a glance:
  the timeline's board landed on `surface-container-high` **because** that
  was the candidate that held every margin (dark identical, light a touch
  better), while `surface-container-highest` would have cost the worst dark
  pair 2.90 -> 2.48.
- **Some of those margins may already be under 3:1, and that can be correct.**
  The timeline's palette clears 3:1 against the track for three of eight
  colours in light theme. That is not a bug introduced by migrating: the
  blocks are large filled shapes carrying their own contrast-checked text
  label, and the palette was validated for lane-versus-lane distinction, not
  lane-versus-track. Know which guarantee a data palette was built to make
  before "fixing" it.
- **Empty/zero states must sit past the end of the scale, and which direction
  that points can flip with the theme.** A ramp that climbs in lightness in
  dark mode and descends in light mode needs its empty slot darkest in one and
  lightest in the other. A wash toward `--m3-surface-container-lowest` expresses
  that in one declaration — near-black in dark, pure white in light. See
  pitfall 14.

## Splitting the token file

When a card's editor renders live previews of card components (quick-toggles
does — medallions in its row headers), the editor's shadow root needs the same
tokens. Export the theme-independent half separately:

```ts
export const m3System = css`...`;  // shape, motion, state-layer opacities
export const m3Tokens = css`...`;  // colour roles, light + dark
export const m3Type   = css`...`;
```

The card takes all three. The editor takes `m3System` plus its own neutral
colour roles, so it keeps looking like an HA config panel instead of like the
card, without duplicating five spring curves. Shared component CSS then reads
the same role names in both hosts.

## Choosing a scheme variant

`SchemeVibrant` is the default here: it keeps the seed hue and gives high
chroma. The variants differ mainly in how much chroma the *neutral* palette
carries, i.e. how strongly the surfaces are tinted toward the seed:

| Variant | Surface chroma | Reads as |
|---|---|---|
| `SchemeVibrant` | ~10 | strongly tinted (an orange seed gives brown surfaces) |
| `SchemeTonalSpot` | ~6 | clearly warm/cool but calmer |
| `SchemeNeutral` | ~2 | near-grey |
| `SchemeMonochrome` | ~1 | grey |

Accents are near-identical between Vibrant and TonalSpot (both give `#ffb68d`
primary for the `#ff8a3d` seed), so **surface tint and accent vividness are
independent choices.** If a card's background reads as too tinted, take the
surface/neutral roles from a lower-chroma variant and keep the accent roles
from Vibrant.

**Seed the surfaces from the house neutral, not from the card's own accent.**
`SchemeNeutral` seeded `#4da3ff` is the block `activity-heatmap` and
`quick-toggles` both ship byte-for-byte, and `garage-control` within a hair;
`gym-tracker` adopted it too. Take the accent roles from whatever hue the card
means, and the surfaces from there, so cards sharing a dashboard sit on the
same plate. See pitfall 17 for why seeding the neutrals from the card's own
hue, and then over-correcting to `SchemeMonochrome`, both came out wrong.

**Re-measure every adjacency after moving the surfaces** — the margins all
shift for a change that touched nothing but the background. On `gym-tracker`
the ring against its track went 5.00 → 3.77 → 3.79:1 in light across the
three attempts (all clear of the 3:1 a graphical object needs, but it moved a
long way). `geyser-control` used to be the exception that kept Vibrant
surfaces; it no longer is — see pitfall 18. **Every card now takes its
surfaces from the house neutral.**

# Generating the springs

```js
const SPRINGS = {
  'spatial-fast':    { damping: 0.6, stiffness: 800 },
  'spatial-default': { damping: 0.8, stiffness: 380 },
  'spatial-slow':    { damping: 0.8, stiffness: 200 },
  'effects-fast':    { damping: 1.0, stiffness: 3800 },
  'effects-default': { damping: 1.0, stiffness: 1600 },
  'effects-slow':    { damping: 1.0, stiffness: 800 },
};

// Unit-step response of a damped harmonic oscillator, mass = 1.
function displacement(z, k, t) {
  const wn = Math.sqrt(k);
  if (z < 1) {
    const wd = wn * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * wn * t) * (Math.cos(wd * t) + ((z * wn) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-wn * t) * (1 + wn * t);
}

function settleTime(z, k) {                 // within 0.1% and staying there
  const dt = 0.001;
  for (let t = 0; t < 10; t += dt) {
    let ok = true;
    for (let u = t; u < t + 0.05; u += dt) {
      if (Math.abs(displacement(z, k, u) - 1) > 0.001) { ok = false; break; }
    }
    if (ok) return t;
  }
  return 10;
}

for (const [name, { damping, stiffness }] of Object.entries(SPRINGS)) {
  const T = settleTime(damping, stiffness);
  const N = 24;
  const pts = Array.from({ length: N + 1 }, (_, i) =>
    Number(displacement(damping, stiffness, (i / N) * T).toFixed(4)));
  pts[0] = 0; pts[N] = 1;
  console.log(`    --m3-spring-${name}: linear(${pts.join(', ')});`);
  console.log(`    --m3-spring-${name}-duration: ${Math.round(T * 1000)}ms;`);
}
```

24 samples is enough; the curve is smooth and `linear()` interpolates between
stops. Force the first and last samples to exactly 0 and 1 — the analytic
solution lands a hair off, and a non-1 endpoint leaves the property short of
its target.

> **Both generators above are verified against the shipped code.** Run on
> `material-color-utilities@0.2.7` they reproduce 98 of the 100 token lines in
> `geyser-control/src/m3.css.ts` exactly; the two that differ are
> `effects-slow`, which is generated but not currently shipped. If you change
> either script, re-run that comparison rather than assuming.

---

# Component recipes

Copy these from `geyser-control/src/card.css.ts`, which is the working
reference for all of them.

## State layers

Every interactive element gets a `::before` overlay of `currentColor` (or an
explicit `on-*` role), `inset: 0`, opacity 0, transitioning to the state-layer
opacity on hover/press. The element needs `position: relative` and
`overflow: hidden`; its content needs `position: relative` so the layer sits
behind it.

## Shape morph on press

The Expressive press feedback is **the corner radius changing**, not only a
tint. Standard treatment:

```css
.thing        { border-radius: var(--m3-shape-full);
                transition: border-radius var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast),
                            transform     var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast); }
.thing:active { border-radius: var(--m3-shape-s); transform: scale(0.94); }
```

Apply it to icon buttons, tonal tiles, value buttons and button-group
segments. A container that carries a state can morph on the state instead —
`geyser-control`'s leading icon goes circle→rounded-square when the geyser is
on, which reads at a glance where colour alone would be weaker.

## Switch

52×32 track, `--m3-shape-full`, 2px `outline` border when off. Thumb 16px off
/ 24px on / 28px while `:active`, positioned with `left` + a negative margin
of half its size, all on `--m3-spring-spatial-fast`. Checkmark icon inside the
thumb, `opacity` 0→1 on the effects spring so it doesn't pop mid-travel.

Render it from one helper method and share it between every switch on the card
so they're visibly the same control.

## Connected button group

Segments in a flex row with a 2px gap. Outer corners `--m3-shape-full`,
**inner corners `--m3-shape-none`**. Pressed segment rounds off to
`--m3-shape-s` and scales to `0.92`. A lone segment needs
`.segment:only-child { border-radius: var(--m3-shape-full) }` — otherwise the
`:last-child` rule wins over `:first-child` and it renders flat on one side.

**Inner corners are square, and that is a correction.** This recipe used to
say `--m3-shape-s` there, and it produced a group that visibly does not
connect: rounding both sides of a 2px seam puts two facing curves at every
junction, opening an hourglass-shaped void through the middle of the group so
the segments read as separate pills. Reported from a real card, then
confirmed by rendering four geometries side by side at 6x:

| Inner radius | Gap | Reads as |
|---|---|---|
| `shape-s` (8px) | 2px | three separate pills — the bug |
| `shape-xs` (4px) | 2px | still separate, hourglass just smaller |
| **`shape-none`** | **2px** | **one pill with clean seams — correct** |
| `shape-none` | 0 | one undivided blob, segment boundaries gone |

Closing the gap entirely is a step too far in the other direction, so the 2px
gap stays; it is the *corner radius* that was wrong. `pc-control`, `gym-tracker` and
`geyser-control` all carry the corrected geometry.

Put any read-out **between** the buttons as a non-interactive third segment
(`--m3-surface-container-highest`, `cursor: default`), so the group reads as
one connected control rather than a value with two buttons floating either
side of it. Give it square corners too — a rounded read-out reopens the same
seam the square inner corners just closed.

## Press and hold

For an action with a physical consequence that a mis-tap shouldn't trigger —
`garage-control`'s Open/Close, which moves a real garage door in a house the
card already knows is empty. A tap does nothing; the button fills over
`--hold-ms` and fires at the end.

```css
.seg-fill         { position: absolute; inset: 0 auto 0 0; width: 100%;
                    background: currentColor; opacity: 0.32;
                    transform: scaleX(0); transform-origin: left center;
                    transition: transform 0ms linear; }
.segment.holding .seg-fill { transform: scaleX(1);
                    transition: transform var(--hold-ms, 600ms) linear; }
```

The 0ms base transition is what makes release feel right: dropping the
`.holding` class snaps the fill back with no rewind animation.

Four things that are easy to get wrong:

- **`--hold-ms` must not be a motion token.** The tokens collapse to 1ms under
  `prefers-reduced-motion`, which would leave a hold gesture with no
  indication of how long to hold. This fill is a progress readout of a real
  elapsed time, like the determinate progress bars — not decoration.
- **Only guard the *starting* action.** `garage-control` holds Open and Close
  but fires Stop on a plain tap: stopping a door already in motion is the
  safe direction, and a slow Stop would be the actual hazard.
- **Render the one action that applies, not all of them disabled.** The same
  card started as a permanent Open · Stop · Close group with two thirds
  greyed out at any moment; showing only the applicable control turned it
  back into a control rather than a picture of one, and freed the width for
  the button to say "Hold to open" in words.
- **Morph the shape on the effects spring, not the spatial one** — see the
  underdamped-radius pitfall below. A sustained hold makes the spatial
  spring's undershoot impossible to miss.
- **Capture the pointer** on `pointerdown` (`setPointerCapture`), or a finger
  that slides off the button never delivers its `pointerup` and the timer
  stays armed. Cancel on `pointerup`, `pointercancel`, `lostpointercapture`
  and `blur`, and clear it in `disconnectedCallback` too — a card removed
  mid-hold must not still have a timer queued to open a garage door.
- **A zero-length hold has to bypass the timer.** `hold_ms: 0` through
  `setTimeout(…, 0)` never fires: the timeout is a macrotask and the
  `pointerup` ending the same tap cancels it first. Act inline instead.

Keyboard needs `keydown` to start and `keyup` to cancel, with the repeat
guarded (auto-repeat re-fires `keydown`), and the synthesised `click`
swallowed so it can't act a second time.

## Wavy linear progress

The signature Expressive indicator: wavy active track, a 4px gap, the flat
remaining track, and a stop indicator dot marking full scale.

The wave is a repeating SVG stroke used as a **CSS mask**, not a background
image — see pitfall 8 for why. Layout is absolute so the gap lands in the
right place at any percentage:

```css
.wave         { position: relative; height: 14px; }
.wave-active  { position: absolute; left: 0; top: 0; height: 14px;
                background: var(--m3-primary);
                mask-image: url("data:image/svg+xml,...");
                mask-size: 40px 14px; mask-repeat: repeat-x;
                animation: wave-scroll 1.4s linear infinite; }
.wave-track   { position: absolute; right: 0; top: 5px; height: 4px;
                border-radius: var(--m3-shape-full);
                background: var(--m3-secondary-container); }
.wave-stop    { position: absolute; right: 0; top: 50%; width: 4px; height: 4px;
                margin-top: -2px; border-radius: var(--m3-shape-full);
                background: var(--m3-primary); }
```

```html
<div class="wave-active" style="width:calc(${p}% - 4px)"></div>
<div class="wave-track"  style="left:calc(${p}% + 4px)"></div>
${p < 99.5 ? html`<div class="wave-stop"></div>` : nothing}
```

`calc(0% - 4px)` clamps to 0 and a negative track width clamps to 0, so both
ends of the range behave without special-casing.

**The path must begin and end on a crest** (pitfall 7):

```
M0 4 C6.67 4 13.33 10 20 10 S33.33 4 40 4
```

Crest y=4, trough y=10, centre 7; with `stroke-width: 4` the ink spans y=2..12
inside a 14px box. Ship both `-webkit-mask-*` and unprefixed `mask-*`.

Flatten the wave (drop the mask, 4px tall, `--m3-shape-full`) when the card
isn't actively working — an animated wave implies progress that isn't
happening.

**Most bars on these cards should never wave at all.** CPU load, disk usage
and year-to-date adherence are standing readings, so `pc-control` and
`gym-tracker` use the flat determinate form (active / 4px gap / track / stop)
and no wave. `irrigation-control` is the clearest case for the wave: its bar
shows a timer that is genuinely running down, and it flattens the moment that
timer is paused. Ask what the bar measures before reaching for the mask.

One thing the recipe's name hides: a bar can legitimately *drain*.
`irrigation-control`'s is remaining/total, so it starts full and empties —
the conventional reading of a countdown. The layout maths is unchanged;
only the direction of travel differs.

## Tonal tiles, banners, chips

- **Tile** — `surface-container-high`, `--m3-shape-l`, state layer, shape
  morph on press. Use a real `<button>` when it's clickable.
- **Banner** — `tertiary-container` for an aside that shouldn't compete with
  the card's primary state colour; trailing icon button to dismiss.
- **Chip** — `secondary-container` (or `primary-container` for the one that
  carries state), `--m3-shape-s`, `flex-shrink: 0`.

## Focus rings

`outline: 3px solid var(--m3-secondary); outline-offset: 2px` (3px on larger
targets). Set `outline: none` on the resting state, never remove focus
styling altogether.

---

# Pitfalls

Each of these cost real debugging time. Symptom first, so a future session
recognises it.

### 1. `SchemeExpressive` rotates your seed hue

**Symptom** — you seed with orange for a "hot" card and the generated primary
is periwinkle (`#c5c0ff`).
**Cause** — `SchemeExpressive` is a colour variant that deliberately rotates
hue for visual interest. It has nothing to do with the Expressive *design
language*.
**Fix** — use `SchemeVibrant` (or `SchemeTonalSpot`). Reserve
`SchemeExpressive` for cards where the colour carries no meaning.

### 2. `material-color-utilities@0.4.0` won't load in Node

**Symptom** — `ERR_MODULE_NOT_FOUND ... dynamiccolor/dynamic_color`.
**Cause** — extensionless internal ESM imports the Node resolver rejects.
**Fix** — pin `@0.2.7`. Verified: 0.4.0 fails to load; 0.3.0 and 0.2.7 both
load, but 0.3.0 produces different colours (pitfall 13), so 0.2.7 is the one
to use.

### 3. `cubic-bezier()` cannot express a spring

**Symptom** — spring tokens that don't bounce.
**Cause** — a cubic-bezier easing is clamped to the 0..1 output range, so it
mathematically cannot overshoot. Underdamped springs must exceed 1.
**Fix** — sample the analytic step response into a `linear()` easing (script
above). Verify by measuring, not by watching (see Verifying, below).

> **Browser support** — `linear()` needs Chrome 113+, Safari 17.2+,
> Firefox 112+. Older browsers treat `var(--m3-spring-*)` as an invalid
> `transition-timing-function` and fall back to `ease`, so motion still works,
> just without the bounce. Acceptable degradation; don't add a fallback layer.

### 4. Backticks inside a lit `css` / `html` comment terminate the template

**Symptom** — a wall of `TS1005: ',' expected` in a file whose CSS looks fine.
**Cause** — `css` and `html` are tagged **template literals**. A backtick
anywhere inside — including in a `/* comment */` — closes the template.
**Fix** — never use backticks in comments inside these templates. Write
`scale(1.08)`, not the markdown-quoted form. Same applies to `${`, which
starts an interpolation.

### 5. `adoptedStyleSheets` outrank an injected `<style>`

**Symptom** — you inject a `<style>` into the shadow root (from devtools or a
test) to override `--m3-*` tokens, and nothing changes, at any specificity.
**Cause** — Lit puts `static styles` into `adoptedStyleSheets`, which the
CSSOM orders **after** the shadow root's own `<style>` elements. The adopted
sheet wins.
**Fix** — to test a token change at runtime, set the properties **inline on
the host element** (`host.style.setProperty('--m3-primary', ...)`), which beats
any stylesheet. Or just edit `m3.css.ts`. This one is nasty because it fails
silently and looks like "the change had no visual effect" — it cost a wrong
conclusion about the palette before it was spotted.

### 6. Transforms contribute to scrollable overflow

**Symptom** — `ha-card.scrollHeight` exceeds `clientHeight` by a few px, and
the amount *drifts continuously* because an animation is running. HA's
sections view can then mis-allocate the card's grid row.
**Cause** — a decorative layer (ambient glow) animated with
`transform: scale()` on `ha-card`'s own `::before`/`::after`. A transform
contributes to its container's scrollable overflow region.
**`inset: 0` does not prevent this** — it keeps the *layout* box correct, and
the transform then puts the painted result back outside it. **Nor does
`overflow: hidden` on `ha-card`** — that clips the paint but still reports the
overflow region as scroll size.
**Fix** — give the decorative layer its own clipping context: a real child
element with `position: absolute; inset: 0; overflow: hidden; contain: paint`,
with the transformed pseudo-elements inside it. Then verify `scrollWidth ===
clientWidth` and `scrollHeight === clientHeight` *sampled across the whole
animation cycle*, not once.

This is the same class of bug as CONTRIBUTING.md's `getCardSize()` warning: anything
that makes a card's reported size disagree with its visual size is a footgun.

### 7. A repeating SVG stroke mask seams at every tile

**Symptom** — a visible notch at each wavelength of a wavy indicator, obvious
at 4–6× zoom.
**Cause** — the tile boundary fell where the path crosses on a *slope*. A
stroke's butt cap is drawn perpendicular to the path direction, so a 4px-wide
cap on a sloped path reaches outside the SVG's own viewport
(x = -1.03 and 41.03 for a 40px tile) — where the SVG clips it. Every tile
loses a triangular sliver.
**Matching y and slope across the boundary is NOT sufficient.** That's the
intuitive fix and it does not work.
**Fix** — make the tile begin and end at a **crest**, where the tangent is
horizontal: the cap becomes a vertical line lying exactly on the tile edge
with nothing outside it. That means cubic segments whose control points share
their endpoint's y, rather than quadratics through the zero-crossings.
Verify at several `mask-position` phases, not just at rest.

### 8. A data-URI cannot reference a CSS custom property

**Symptom** — you want a themed SVG shape and the colour won't follow the
token.
**Cause** — the data-URI is an opaque external image; `var()` doesn't resolve
inside it.
**Fix** — draw the shape in white and use it as a **mask** over an element
whose `background` is the token. Costs a `-webkit-` prefix pair, and gives a
shape that recolours with the theme and the state swap for free.

### 9. Fixed-width control clusters overflow narrow cards

**Symptom** — at ~190px the label truncates to "Target t…" *and* the control
still overflows (`scrollWidth` 194 vs `clientWidth` 190).
**Cause** — a connected button group has a fixed minimum width; a `.row` with
`justify-content: space-between` crushes the label side first and still can't
fit.
**Fix** — below 300px, stack instead of truncating:

```css
@container (max-width: 300px) {
  .row { flex-wrap: wrap; row-gap: 8px; }
  .row > :first-child { flex: 1 0 100%; }
}
```

Shrink oversized leading icons there too (48→40px) to buy the title back some
width. `@container`, never `@media` — see CONTRIBUTING.md.

### 10. Measure overflow against the host's rect, not its width

**Symptom** — an overflow probe reports every element in the card as
overflowing.
**Cause** — comparing `getBoundingClientRect().right` (viewport coordinates)
against `host.getBoundingClientRect().width` (a length). They're only
comparable if the host starts at x=0.
**Fix** — compare against the host's `.left` and `.right`. Better: check
`el.scrollWidth > el.clientWidth` on `ha-card` for a single yes/no, then walk
descendants only if it's positive.

### 11. `scrollWidth > clientWidth` on a text node is not a bug

Any element with `text-overflow: ellipsis` reports a `scrollWidth` wider than
its `clientWidth` — that's what makes the ellipsis appear. Don't chase it.
Only the **card root's** scroll size mismatching matters (pitfall 6).

### 12. Opaque roles are not drop-in replacements for low-alpha colours

**Symptom** — a decorative layer (watermark, tint, shimmer) becomes several
times stronger after migrating, and starts competing with the content.
**Cause** — the original drew it with a low-alpha *colour* (`rgba(255,255,255,
0.32)`) **and** a low `opacity` (`0.12`), so its effective alpha was the
product, ~0.04. M3 role tokens are opaque, so substituting one in leaves the
opacity carrying the whole reduction alone — 3× too strong in
`garage-control`'s case.
**Fix** — when swapping an rgba for a role token, multiply out the old alphas
and set `opacity` to the product. Check any rule where a token replaced a
colour that had its own alpha.

### 13. The palette generator's output is version-dependent

**Symptom** — you regenerate the palette from the same seed with the same
scheme variant and some roles come out different from what's in the file.
**Cause** — `material-color-utilities` retunes role derivation between
versions. Concretely, for seed `#ff8a3d` with `SchemeVibrant`, light
`onPrimaryContainer` is `#321200` on 0.2.7 and `#763300` on 0.3.0 (both pass
WCAG AA against the container — 13.3:1 vs 7.2:1 — so it's a retune, not a
bug). Dark-scheme roles were identical across the two.
**Fix** — pin `@0.2.7`, which is what the shipped tokens were generated with.
If you deliberately move version, regenerate **all four blocks** and re-check
both themes; never regenerate one block and paste it next to older ones.

### 14. An empty/zero state can invert when you re-express it as a token

**Symptom** — after migrating surfaces, the faintest step of a data scale
becomes indistinguishable from the empty slot.
**Cause** — the empty slot was a fixed wash (`rgba(0,0,0,0.2)`) meaning
"recessed", and re-expressing it as a wash of `--m3-on-surface` inverts it in
dark mode, where `on-surface` is near-white. Measured on `activity-heatmap`,
that took the faintest filled shade from 1.66:1 against the empty cell to
**1.00:1** — identical luminance, the floor of the scale gone.
**Fix** — think in terms of the *scale*, not the surface: the empty slot sits
past the low end, and in a ramp that climbs in dark and descends in light,
"low end" flips direction. A wash toward `--m3-surface-container-lowest` is
near-black in dark and pure white in light, so one declaration lands correctly
in both. Then re-measure both themes.

**Measure the right adjacency.** The cells sit on the *board*, not on the card,
so the empty slot's visibility is its contrast against the board — sampling
the card gave a number that looked fine while the real one was 1.03:1. And
sample away from a rounded corner, or you measure the blend, not the fill.

**The same trap catches a line, not just a fill.** `body-stats` draws a body
silhouette whose regions are filled with the three semantic colours and
separated by an ink edge, and that edge was a fixed dark tone in both themes
on the reasoning that its job is separating segments rather than blending
with the card. That held while the fills were the old scheme's pastels. M3's
light-theme semantic colours are T40 tones — much darker — and the same ink
on them measured 2.08:1: the line art all but vanished. Re-expressing the
edge as `surface-container-lowest` (near-black in dark, pure white in light)
took it to 11.29:1 / 6.44:1.

**One edge colour could not do both jobs, though.** An unset region is filled
with a neutral surface tone, and `surface-container-lowest` against *that* is
1.29:1 — so the fix for the coloured regions would have erased the figure
wherever a region had no entity. Unset regions take `--m3-outline` instead
(3.86:1 / 3.46:1 on the fill, and 5.41:1 / 4.04:1 against the card behind
it). When one token can't serve two adjacencies, split the rule rather than
picking the lesser failure.

### 15. Cards that write state run per-tab and only while open

If a card calls a service in response to *observed* state rather than a user
action, be explicit about it:

- it fires only while a dashboard containing that card is open;
- every open tab fires it (keep the call idempotent — `turn_on`, not `toggle`);
- act on an observed **change**, never on the first value seen, or the card
  will act during load on state that was already there;
- make sure the reaction can't feed back into its own trigger.

Anything that must hold when nobody's looking belongs in a real HA automation,
not in a card. `geyser-control`'s shower-override auto-enable documents a
worked example of all four points.

### 16. Two different `*-container` roles are the same lightness

**Symptom** — a segmented/connected button group whose selected segment is
`primary-container` against unselected `secondary-container` reads fine in
dark theme and is *invisible* in light.
**Cause** — the container roles are all sampled at the same tone (T90 light,
T30 dark) off different hues, so they differ only in hue, not in luminance.
Measured on `gym-tracker`'s seed: `primary-container` against
`secondary-container` is **1.00:1 dark and 1.01:1 light**. Dark theme got
away with it because two saturated tints at that tone still separate by hue;
light theme is two pale near-whites and does not.
**Fix** — a selected state has to change *tone*, not hue. Fill the selected
segment with the accent itself — `primary` on `on-primary` — which measured
5.51:1 / 4.98:1 against the unselected sibling and 7.72:1 / 6.46:1 for its
own label. Generally: never encode a state as one container role versus
another. Pair a container with a *filled* role, or with a surface role.

**This has now bitten twice, and the second case is worse.** `pc-control`'s
power-off segment sat in `error-container` inside a `secondary-container`
button group: **1.00:1 in both themes**. Unlike the first case it *looked*
fine in dark, because red against blue is a wide hue gap — but the single
destructive control on the card was distinguishable by hue alone, which is
exactly the thing a contrast check exists to catch and an eyeball check does
not. Filled `error` on `on-error` measured 5.48:1 / 5.01:1 against its
neighbours. **Treat "two container roles adjacent to each other" as a bug
on sight**, and measure it rather than trusting the screenshot.

That card ended up not using filled `error` either, and the reason is worth
carrying: passing the measurement is necessary, not sufficient. Filled error
was 5.48:1 against its neighbours but 9.69:1 against the card, versus 12.76:1
for the card's own title — M3's dark `error` role is a pale pink, so the one
button you rarely want to press became the brightest object on screen. The
fix was to stop asking colour to carry the distinction: the destructive
button moved out of the connected group behind a gap, and took
`error-container` back. **Position is a channel too, and often the right one
— separation distinguishes a control without competing for attention.**

This is the counterpart to pitfall 14 — both are cases where a colour pairing
that looks obviously distinct in one theme collapses in the other, and only
measuring catches it.

### 18. A tinted surface has to survive the state it isn't named after

**Symptom** — a card seeded from "hot" renders a brown plate, and stays brown
while its own read-out says **Cooling**.
**Cause** — `geyser-control` seeded its surfaces from the heat colour and
swapped only the accent roles per mode, on the reasoning that the card should
keep one identity while its state colour changed underneath it. That reads
fine in the state the seed is named after. In the *other* state it is a brown
card with a cyan chip on it and nothing to explain the brown — and with the
geyser off, the ambient glow that would at least have tinted it cyan is
hidden, so nothing on the card accounts for the colour at all.
**Fix** — surfaces from the house neutral; let the accent swap and the glow
carry the state. The colour that changes should be the colour that means
something, and a plate that never changes shouldn't be arguing with it.

**The general rule: if a card has modes, look at the tinted surface in every
mode, in both themes, with the card both on and off.** A seed-tinted surface
is only ever validated against the mode it was seeded from, which is exactly
the one where it looks right. `geyser-control` shipped like that for months
because nobody had opened it while the geyser was cooling.

### 17. A neutral grey is not the same thing as a grey that matches

**Symptom** — "the background still feels like a yellowish tinted grey",
about a card whose surface hexes are `#1b1b1b` and `#f3f3f3`: literally
equal-channel, mathematically neutral.
**Cause** — two mistakes in a row, and the second is the interesting one.
First, `SchemeNeutral` seeded from the card's own accent is *not* neutral: at
chroma ~2 a red seed gives `#1e1b1b` / `#faf2f1`, a warm pink-grey that reads
plainly as tinted. Over-correcting to `SchemeMonochrome` then produced a
perfectly neutral grey that **still** read yellowish — because grey is judged
relative to its neighbours, and the other cards on the dashboard use a
slightly *cool* grey (`#1b1b1d`, blue channel two steps up). A true neutral
next to a cool neutral looks warm.
**Fix** — match the neighbours rather than chasing neutrality in isolation.
Seed the surface roles from the house neutral (`SchemeNeutral` @ `#4da3ff`)
and the accent roles from whatever hue the card actually means. Verify by
diffing the surface block against `activity-heatmap`'s line by line, not by
eye — the differences are one or two hex steps and invisible in a screenshot
of a single card.

The general lesson: "is this colour neutral" is the wrong question. "Does
this colour match the card sitting next to it" is the one that gets
complained about.

---

### 19. A card's stylesheet is one flat namespace, and modifiers collide

Symptom: an element takes on layout it never asked for — in `garage-control`,
a header chip suddenly rendered its two spans stacked vertically instead of
side by side, at 55px tall, pushing the header out of shape. No rule
targeting chips had changed.

A card has exactly one shadow stylesheet, so every class in it is global to
that card. The chip was `class="chip door open"`, and a new
`.door { display: flex; flex-direction: column }` container rule elsewhere in
the same file matched it on the bare `door` modifier. Nothing errors; the
chip just quietly inherits a column layout and a `border-top`.

Modifier names that read fine beside their base (`.chip.door`) are exactly
the ones that collide with a block of the same name. Either scope the rule
(`.chip.door`, never bare `.door`) or — better, since it survives the next
person's edit — give the block a compound name: `.door-controls`, matching
the `.door-row` / `.door-state` / `.door-hint` already inside it.

Worth measuring rather than eyeballing: `getComputedStyle(el).flexDirection`
returning `column` on something you only ever wrote as a row is the tell.

### 20. An underdamped spring undershoots a *shrinking* radius, and it clamps

Symptom, reported from `garage-control`'s press-and-hold button: "the hold is
a bit jittery, going from a squared look to standard rounded look."

The shape-morph recipe puts `border-radius` on `--m3-spring-spatial-fast`,
which is underdamped (ζ≈0.6-0.8) and overshoots by design. Overshoot is a
bounce when a value grows. When the value *shrinks* — `--m3-shape-full`
(999px) down to `--m3-shape-s` (8px) — the same overshoot is an undershoot,
and it aims well below zero. `border-radius` clamps at 0, so instead of
dipping and recovering, the corner sits **fully square** for the whole
excursion and then rebounds past its target.

Sampled per rAF on the real element:

| | spatial-fast (underdamped) | effects-fast (critically damped) |
|---|---|---|
| 140-240ms | **0px — square, ~120ms** | 14 → 8px, settling |
| peak after | **16.7px (2× the 8px target)** | never exceeds 8px |
| settled | ~390ms | ~173ms |

A quick tap hides this; the press is over before the excursion finishes. A
600ms press-and-hold does not, and neither does any control that stays
pressed. Put a shrinking radius on `--m3-spring-effects-*`, which is
critically damped and lands on its target.

Two rules setting *different* pressed values compound it. `garage-control`
had `.segment:active { transform: scale(0.92) }` and
`.segment.holding { transform: scale(0.96) }`; the class comes off when the
hold completes while the pointer is still down, so the button re-animated
mid-gesture for no reason. Give the pressed and held states one shared rule.

# Verifying

The dev harness catches most of this; some things need measuring. Install
Playwright into the session scratchpad (see CONTRIBUTING.md) and drive `npm run dev`.

**Card size honesty** — the single most valuable probe, because it's invisible
by eye and breaks HA's layout:

```js
const d = await page.evaluate(() => {
  const c = document.querySelector('my-card').shadowRoot.querySelector('ha-card');
  return { w: c.scrollWidth - c.clientWidth, h: c.scrollHeight - c.clientHeight };
});
// must be 0/0 — sample repeatedly, animations make it drift
```

**Spring overshoot** — proves the easing is real, not decorative:

```js
// sample getComputedStyle(thumb).left each rAF during the transition;
// peak should exceed the target and settle back to it.
```
For reference, `geyser-control`'s switch thumb travels 14→34px and peaks at
35.85px — the ζ=0.6 spring predicts ~9.4% of a 20px travel = 1.9px, measured
1.85px.

**Rendering detail** — screenshot with `deviceScaleFactor: 6` and a tight
`clip` to inspect things like mask seams. A 1× screenshot will not show them.

**Comparing design options** — render each variant, then compose the PNGs
into one strip via a `page.setContent` with data-URI `<img>` tags. There is no
ImageMagick or PIL in this environment.

**Assert every scripted edit.** Migrations are mostly find-and-replace over
CSS, and a `.replace()` whose anchor has drifted does nothing and says nothing.
Two silent no-ops happened while migrating these cards; one left three colour
roles undefined in the dark theme, which renders as an invisible tooltip rather
than an error. Assert the anchor exists before replacing, and grep for the
result afterwards.

**Fixtures** — derive dependent fixture values from a single source. A harness
where `next_shower`'s "default" didn't actually equal `default_shower_time`
made a correct card look broken. If the card compares two entities, the
fixtures must agree.

**Not reproducible locally** — `--mdc-icon-size`, `ha-icon` glyph centring,
and HA's real sections-view grid. See CONTRIBUTING.md; flag them as unverified rather
than claiming they work.
