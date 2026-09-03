# Geyser Status Card

A custom Lovelace card for geyser power/temperature status: power on/off,
a current-vs-target temperature progress bar (with a "ready by" estimate),
time-to-heat, and the next scheduled shower — plus a collapsible Settings
section (target temperature stepper, shower-time override) and a
collapsible Details section (heating/cooling mode, heating efficiency).
Same Lit + TypeScript project structure as the other cards in this family
(`garage-control/`, `pc-control/`, `irrigation-control/`), but **this card
is on Material 3 Expressive** and the others are still on the older shared
`--pc-` visual language, so it deliberately looks different next to them
until they follow.

Unlike the other three cards, the power toggle, temp progress bar, a
next-shower hint, and an active-override indicator all live in the
always-visible base area, not behind the collapsible body — this card is
meant to tell you what's happening at a glance without expanding. While
on, the card also shows an ambient glow behind its content, colored by
heating/cooling mode — purely decorative.

## The Material 3 Expressive layer

`src/m3.css.ts` holds the design tokens; `src/card.css.ts` consumes them and
contains no literal colour, radius, or duration of its own. Reseeding the
palette or retuning the motion is a change in one file.

### Colour: a generated tonal palette, not picked hexes

The colour roles are a real M3 tonal palette generated with
`@material/material-color-utilities` from seed `#ff8a3d` (the geyser's heat
colour), light and dark ramps both. Cooling mode swaps *only* the accent
roles — primary/secondary/tertiary and their containers — regenerated the
same way from seed `#22c1e2`. Surfaces stay seeded from heat in both modes,
so the card keeps one identity while its state colour changes underneath it.

The swap is a `data-mode` attribute on the host, set from the heating
automation's state. Because the tokens are custom properties on `:host`,
every descendant picks the change up through inheritance and not one
component rule has to know that modes exist.

**The library's `SchemeExpressive` variant is deliberately not used.** It
rotates the seed hue hard — orange lands on periwinkle — which would throw
away the one thing this card's colour has to say: hot. `SchemeVibrant` keeps
the hue and gives the high chroma the design language wants. "Expressive"
here refers to the shape, motion, and typography system, not that scheme.

### The surfaces used to be warm — they aren't any more

`SchemeVibrant`'s *neutral* palette carries chroma ~10, so heat-seeded
surfaces come out tinted rather than grey. That was originally deliberate,
and measured (HCT chroma on the bare painted background, 0 = neutral grey):

| | chroma |
|---|---|
| Vibrant surfaces + glow 0.28 (was shipped) | 14.5 |
| Vibrant surfaces, glow off | 10.6 |
| **Neutral surfaces, glow off (now shipped)** | **2.0** |

Roughly two-thirds of the old cast was the palette and one-third the ambient
glow. **It was revisited and reversed**, for two reasons the original
reasoning didn't weigh:

- **Cooling looked broken.** Surfaces were heat-seeded in cooling mode too, so
  cooling rendered cyan accents on a brown card. With the geyser *off* the
  glow is hidden entirely, leaving a flat brown plate with a cyan "Cooling"
  chip on it and nothing to explain the brown.
- **It was the last tinted card.** Every other card in the repo moved to the
  shared house neutral, so this one stood out on a dashboard rather than
  reading as part of a set.

Surfaces now come from `SchemeNeutral` seeded `#4da3ff` — the same block every
other card ships. The heat/cool state is carried entirely by the accent swap
and the ambient glow, which tints warm while heating and cyan while cooling
and disappears when the geyser is off. That is a better division of labour
than a permanently warm plate: the colour that changes is the colour that
means something.

The lever the old note described is exactly the one that was pulled — the
surface/neutral roles are independent of the accent roles, so this touched
neither primary, the wave, the switch, nor the chips. All 20 adjacencies were
re-measured across all four theme/mode combinations: 80 checks, 0 failures. Note that overriding
the tokens from a devtools-injected `<style>` will *not* work — Lit's
`adoptedStyleSheets` outrank a shadow-root `<style>` element, so test such a
change by editing `m3.css.ts` or by setting the custom properties inline on
the host element.

### Motion: real springs, sampled into `linear()`

M3 Expressive's spatial springs are *underdamped* (damping 0.6–0.8, versus
0.9 for the standard motion scheme) — they overshoot and settle, and that
visible bounce is the point. A `cubic-bezier()` cannot express it, because
it can't exceed 1. So `m3.css.ts` carries `linear()` easings sampled from the
actual damped-oscillator solution at each spring's damping/stiffness, with a
matching duration token for its settle time.

Measured on the switch thumb's 14px→34px travel: peak 35.85px, dipping to
33.8px, settling at 34.00px. The ζ=0.6 spring predicts ~9.4% overshoot on a
20px travel = 1.9px; measured 1.85px. The curves are doing real physics.

Effects springs (colour, opacity) are critically damped at 1.0 — no
overshoot, where an overshoot would read as a glitch rather than a bounce.

`prefers-reduced-motion` collapses the duration tokens to 1ms in one place
rather than each rule opting out separately.

### Shape and the expressive components

- **Wavy linear progress** — the signature M3E indicator: a wavy active
  track, a 4px gap, the flat remaining track, and a stop indicator marking
  full scale. The wave is a repeating SVG stroke used as a CSS *mask*, not a
  background image, so its colour is still a custom property (a data-URI
  can't reference one). `mask-size` matches the SVG's 40px wavelength and
  `mask-position` scrolls to animate it. **The wave
  flattens to a plain linear indicator while cooling** — an animated wave
  there would imply work in progress that isn't happening.
- **The wave tile starts and ends at a crest, and that's load-bearing.**
  Matching y and slope across the tile boundary is *not* enough to tile
  without a seam. A stroke's butt cap is drawn perpendicular to the path
  direction, so with the path crossing the edge on a slope, the 4px-wide cap
  reached x = -1.03 and x = 41.03 — outside the SVG's own 40x14 viewport,
  which clips it. Every tile lost that triangular sliver and the repeat
  showed a visible notch at each wavelength (clearly so at 6x zoom). At a
  crest the tangent is horizontal, the cap is a vertical line lying exactly
  on the tile edge with nothing outside it, and consecutive tiles abut
  precisely. Verified seam-free across six `mask-position` phases, so it
  holds at the fractional offsets the scroll animation actually passes
  through, not just at phase 0.
- **Shape morph on press** — the expressive system's press feedback is the
  corner radius changing, not only a tint. Stat cards, icon buttons, the
  value button and the stepper segments all morph, on a spatial spring.
- **Connected button group** for the target-temp stepper: outer corners full,
  inner corners small, 2px gaps, and the pressed segment squares off and
  shrinks. The read-out sits *between* the buttons as a third segment, so the
  group reads as one connected control rather than a value with two buttons
  floating either side of it.
- **The leading icon morphs** from circle (off) to rounded square (on),
  alongside the colour change — shape carries the state at a glance where
  colour alone would be a weaker signal.
- **M3 switch** — 52×32 track, thumb growing 16→24px on, 28px while pressed,
  travelling on the spatial spring. Shared by the power toggle and the
  shower-override row so both read as the same control.
- **State layers** — hover/press feedback is a tinted overlay of the content
  colour at the M3 opacities, not a different background colour.

## Developing

```bash
npm install
npm run dev
```

Opens a dev harness at `http://localhost:5177` with mock entities and
buttons to toggle power, switch heating/cooling mode, randomize the
current temperature, toggle the shower override, and switch dark/light
mode.

## Building for Home Assistant

```bash
npm run build
```

Produces `dist/geyser-status-card.js` (Lit bundled in, no other runtime
dependency).

### Installing into HA

1. Copy `dist/geyser-status-card.js` into `<config>/www/`.
2. Settings → Dashboards → ⋮ → Resources → Add Resource, URL
   `/local/geyser-status-card.js`, type **JavaScript Module**.
3. Add the card via the picker (search "Geyser Status Card") or YAML:
   `type: custom:m3-geyser-status-card`.
4. Bump the resource URL's `?v=` on future rebuilds so the browser
   actually refetches the file instead of serving a cached copy.

## Configuration

| Key | Type | Description |
|---|---|---|
| `title` | string | Card header text (default `"Geyser"`) |
| `switch` | entity id | switch.\* — powers the heating element; the card's main power toggle |
| `current_temp` | entity id | sensor.\* — current water temperature |
| `target_temp` | entity id | input_number — target temperature; drives the progress bar and the Settings stepper (uses the entity's own `step` attribute, default 1) |
| `time_to_heat` | entity id | sensor.\* — minutes remaining to reach target, or an "H:MM:SS" duration |
| `next_shower` | entity id | sensor.\* or input_datetime.\* — next scheduled shower time |
| `heating_automation` | entity id | automation.\* — display-only; a single automation drives both states — enabled means heating, disabled means cooling |
| `efficiency` | entity id | sensor.\* — heating efficiency, shown as a percentage |
| `shower_override_switch` | entity id | switch.\* or input_boolean.\* — when on, `next_shower` itself holds the overridden time |
| `default_shower_time` | entity id | sensor.\*, input_datetime.\*, etc. — what `next_shower` gets reset to when the override switch turns off; shown for reference in Settings |

All fields are optional; each section only renders if its relevant
entities are configured. The visual editor (⋮ → Edit Card) covers every
field.

**There is no separate override-time entity.** `next_shower` doubles as
the override time: while `shower_override_switch` is on, `next_shower`
holds the overridden value directly; an automation (outside this card)
resets it back to `default_shower_time` whenever the switch turns off.
This card only reads and displays that state — it doesn't implement the
reset logic itself.

## Behavior notes

- **Base area** (header with power toggle, next-shower hint, temp progress
  bar + "ready by" estimate, and an active-override indicator) is always
  visible — no expanding needed to see current status. The collapsible
  body underneath (click the header) holds the time-to-heat/next-shower
  chips plus the Settings and Details sub-sections. All collapsibles use
  the same animated pattern: an outer wrapper with no spacing of its own,
  animated via max-height, with a separate inner element carrying the
  padding, so a collapsed section truly renders nothing rather than
  leaving a stray border/gap.
- **The header's supporting line carries the next shower time and nothing
  else** ("Next shower Tomorrow, 08:01"). On/off and heating/cooling are
  already unambiguous from the switch, the leading icon's colour and shape
  morph, and whether the wave is present and moving — restating them as
  text just made the line longer. Shown regardless of on/off state, and
  omitted entirely when the override banner is already showing the same
  value, which leaves the header as a single title line.
- **Progress bar** only renders while the geyser is on — no dead UI
  showing 0% when it's off.
- **"Ready by"** is derived from `time_to_heat`'s remaining minutes + the
  current time, shown under the progress bar; hidden once there's no time
  left (i.e., don't show a stale/meaningless estimate).
- **Override indicator** (tonal banner on the base) appears whenever
  `shower_override_switch` is on, showing the current `next_shower` value
  and an icon button to turn the override off directly — no need to expand
  into Settings just to dismiss it. The Settings sub-section still has the
  full toggle for turning it back on.
- **The card turns the override on by itself when the shower time leaves the
  default schedule.** `next_shower` doubles as the override time, so a
  next-shower time that no longer matches `default_shower_time` *is* an
  override, and the switch should say so. When the card observes
  `next_shower` change to a time whose time-of-day differs from
  `default_shower_time` while the switch is still off, it calls
  `homeassistant.turn_on` on it.

  Three deliberate constraints on that, because this is the one place the
  card writes state it wasn't directly told to:

  - **Only on an observed change, never on the first value seen.** Acting on
    the initial read would flip the switch during dashboard load for a time
    that was already set — by another automation, or before this browser tab
    existed — which is not a change the user just made.
  - **Time-of-day comparison, not raw state.** `next_shower` is typically a
    full datetime and `default_shower_time` a time-only `input_datetime`, so
    the raw states differ even when the schedule matches; and "tomorrow
    18:00" is still the default schedule. `computeVals` exposes
    `nextShowerIsDefault`, which is `null` when either side can't be read,
    and the check is strictly `!== false`, so an unreadable or unavailable
    value never triggers a write.
  - **No feedback loop.** Turning the override on doesn't change
    `next_shower`, and the external reset automation moves `next_shower`
    *to* the default, which fails the condition. Verified: the off→reset
    round trip fires nothing.

  Worth knowing: this runs in the browser, so it only fires while a
  dashboard with this card on it is actually open, and every open tab will
  fire it (harmless — `turn_on` is idempotent). If you want this to hold
  when nothing is watching, it belongs in a real HA automation, not here.
- **Ambient glow**: while on, two blurred, independently-drifting
  radial-gradient layers sit behind the real content, tinted by whichever
  accent `data-mode` has swapped in — pure CSS, no JS animation loop.
  Respects `prefers-reduced-motion` (glow stays but stops drifting).
- **The glow lives in its own `.glow` clipping element, not on `ha-card`'s
  `::before`/`::after`, and that placement is load-bearing.** A transform
  contributes to its container's *scrollable overflow*, so the drift
  animation's `scale(1.08)` on a pseudo-element of `ha-card` inflated
  `ha-card`'s `scrollWidth`/`scrollHeight` past its client size — measured
  at up to 13px, varying continuously as the animation ran. `inset: 0` alone
  does **not** prevent this: it keeps the layout box the right size, and the
  transform then puts the painted result back outside it. Neither does
  `overflow: hidden` on `ha-card`, which clips the paint but still reports
  the overflow region as scroll size. If HA's sections-view reflow logic
  reads `scrollHeight` rather than the visual box, that drifting mismatch is
  exactly what would make it under- or over-allocate the card's grid row.
  Giving the glow its own clipping context (`overflow: hidden` +
  `contain: paint`) contains the transforms; `ha-card`'s scroll size now
  measures exactly equal to its client size at every width, sampled across
  the whole drift cycle. This bug predates the M3 rework — it was latent in
  the original `::before`/`::after` glow too.
- **Global `box-sizing: border-box` reset** (on `:host` and all
  descendants) — without it, any element mixing a percentage-based size
  (e.g. `.badge`'s `max-width: 100%`) with its own padding renders wider
  than intended, since padding adds on top of a content-box width instead
  of being absorbed into it. Caught this via a real, measured horizontal
  overflow on the override badge at narrow card widths before adding the
  reset.
- **Container queries, not `@media`**: the narrow-width rules use
  `@container` (with `container-type: inline-size` on `ha-card`, never on
  `:host` — see the CONTRIBUTING.md), not `@media (max-width: ...)` — a
  dashboard column's width has no fixed relationship to the browser
  viewport, so a plain media query would never fire for a narrow card
  sitting in a wide window.
- **Narrow-width rows stack rather than truncate.** Measured at a 190px-wide
  card: label and control could not share a line without one side being
  crushed — "Target temp" truncated to "Target t…" while the connected
  button group still ran 4px past `ha-card`'s client width (`scrollWidth`
  194 vs `clientWidth` 190). Below 300px the rows wrap and the control drops
  under its full-width label, so the label reads in full and every control
  keeps its real size. The leading icon also shrinks 48→40px there, buying
  the title back 8px it otherwise loses to the icon-plus-switch pair.
- **Narrow-width hardening generally**: every label+control row (`.row`,
  `.stepper-row`) truncates its label with ellipsis first, while the
  control side (pill-toggle, stepper, badge, time-value) keeps
  `flex-shrink: 0` so it never gets visually squeezed below a usable size.
- **Icon sizing**: every `ha-icon` rule also sets `--mdc-icon-size`
  alongside `width`/`height` — real HA's `ha-icon` sizes the glyph it
  actually draws via that custom property, and setting only width/height
  on the host can leave the drawn icon at its own default size regardless,
  visually crowding whatever sits next to it despite the box (and any flex
  gap) being correctly sized. Unverifiable in the dev harness, whose mock
  `<ha-icon>` doesn't implement `--mdc-icon-size` at all.
- **Target temperature stepper** calls `input_number.increment` /
  `input_number.decrement` rather than computing and setting a new value
  itself — HA handles the min/max clamping and step size natively.
- **Override toggle** uses the generic `homeassistant.toggle` service
  rather than a domain-specific one, since the entity may be a `switch.*`
  or an `input_boolean.*`.
- **Time-to-heat / next-shower / default-shower-time formatting** accepts
  either a plain number (minutes, for time-to-heat), a full ISO datetime,
  or a bare time-of-day string ("HH:MM:SS") — since real entities report
  any of these shapes depending on their domain and configuration.
- **No `getCardSize()`/`getGridOptions()`**: deliberately omitted, same
  reasoning as the other three cards — this card's rendered height
  changes with internal toggle state, which HA has no visibility into, so
  a static or state-derived row estimate would either leave a gap or lag
  behind the animation. Omitting it lets HA's sections view auto-size the
  grid cell to actual content.

## Project layout

```
src/
  geyser-status-card.ts        # the <m3-geyser-status-card> element
  geyser-status-card-editor.ts # visual editor (ha-form) for all fields
  compute.ts                   # pure value computation: temp formatting, progress %, mode, time/shower formatting, next-vs-default shower comparison
  m3.css.ts                    # Material 3 Expressive tokens: generated tonal palette, shape scale, spring easings, type scale
  card.css.ts                  # component styles, built entirely on the m3.css.ts tokens
  types.ts
dev/
  index.html, main.ts, mock-hass.ts, fixtures.ts, mock-ha-icon.ts   # standalone dev harness
```
