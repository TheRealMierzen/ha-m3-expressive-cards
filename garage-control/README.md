# Garage Auto Open Card

A custom Lovelace card showing an auto-open automation's on/off state plus
left/right "home"/"away" status (e.g. two phone `device_tracker`s), built as a
Lit + TypeScript project (same structure as `schedule-timeline-card/`), on
the **[Material 3 Expressive](../M3-EXPRESSIVE.md)** visual language.

## Material 3 Expressive

Tokens live in `src/m3.css.ts`; `card.css.ts` contains no colour, radius or
duration literals. Surfaces come from `SchemeNeutral` and accents from
`SchemeVibrant`, both seeded `#24b2ff` (the card's original accent) — neutral
surfaces because the card carries three semantic colours at once and a tinted
board would bias all three.

**`--m3-success-*` is an M3 *custom colour*.** M3 defines an `error` role but
no success role, and "home" here is a real third semantic state rather than a
decorative accent. It's generated the way M3 generates custom colours: a tonal
palette from one seed (`#0f9f78`, the card's original green) sampled at the
standard custom-colour tones — T40/T100/T90/T10 for light, T80/T20/T30/T90 for
dark. That gives the same contrast guarantees as the built-in roles instead of
a hand-mixed rgba.

### What changed beyond colour

- **The power control is now a real switch.** It was a pair of `<button>`s
  that swapped between `mdi:toggle-switch-outline` and
  `mdi:toggle-switch-off-outline` — the control was already drawing a switch,
  just as a picture of one that couldn't be dragged and didn't announce itself
  as a switch to assistive tech. It's now the same M3 switch the other
  migrated cards use, with `role="switch"`, `aria-checked`, and hand-wired
  Enter/Space (a `div` with `tabindex` doesn't get those for free).
- **The status dot became a shape-morphing leading icon**, matching
  `geyser-control`: circle when the automation is off, rounded square when
  armed. Shape carries the state where a 10px dot relied on colour alone.
- **Home/away tiles** are M3 tonal surfaces with state layers and a
  shape-morph press, and their badges use the success/error container pairs.
  The red/green mapping for away/home is inherited from the original card, not
  an M3 recommendation — `error` in M3 means "something is wrong", and being
  away isn't. It's kept because at-a-glance red/green is what this card was
  built around; `tertiary-container` would be the more literal M3 reading if
  you ever want it softer.
- **The watermark glyph was re-tuned.** The original drew it with a low-alpha
  colour *and* a low opacity, so its effective alpha was ~0.04. The M3 roles
  are opaque, so keeping the old `opacity: 0.12` made it three times stronger
  and it competed with the label; it's now 0.04–0.05.

### Four non-negotiables this card was missing

It predated them, and the migration fixes all four (see the root
[CONTRIBUTING](../CONTRIBUTING.md)):

- **No `box-sizing: border-box` reset** — added.
- **Three `@media (max-width: ...)` breakpoints** at 520/460/360px, which
  never fire for a narrow card sitting in a wide dashboard window, so the
  narrow layouts they described were unreachable in practice. Replaced with
  `@container` queries at 400px and 320px, plus `container-type: inline-size`
  on `ha-card` (which the card also lacked).
- **No `--mdc-icon-size`** on either `ha-icon` rule — real HA sizes the drawn
  glyph by that property, so width/height alone can leave it at its own
  default. Added to every icon rule.
- **`prefers-reduced-motion`** now collapses the duration tokens in one place
  rather than listing properties.

## Door controls

Set `left_cover` / `right_cover` to the `cover` entities behind each side and
the tiles grow a door readout and a control. Leave both unset and the card
renders exactly as it did before — a presence-only tile, same 56px height,
no controls.

**One control at a time, not a row of mostly-disabled buttons.** At any
moment a garage door has exactly one sensible next move, so that is what the
tile shows: Open when it's shut, Close when it's open, Stop while it's
moving. A permanent Open · Stop · Close group is a picture of a control
rather than a control — two thirds of it is always greyed out.

The one exception is an **`unknown`** state, which renders both directions as
a two-segment group. There is genuinely nothing to infer from, and guessing a
direction would move a real door the wrong way.

**Open and Close are press-and-hold; Stop is a plain tap.** The hold exists
because this card's whole reason for being is that it's driven by *presence* —
a mis-tap on a phone in a pocket is exactly the failure this control has to
survive, and it opens a garage in a house nobody is in. Stopping a door that
is already moving is the safe direction, so making that one slow would be the
actual hazard. `hold_ms: 0` drops the hold if you'd rather have a plain tap;
Stop is unaffected either way.

Because the button is alone it has room to say what it does — "Hold to open",
"Hold to close", "Stop" — which retired an earlier separate "Hold to move"
hint that had to caveat itself whenever the visible button was Stop.

The hold fill's duration is `--hold-ms`, set inline from the config, and is
deliberately **not** one of the motion tokens. Those collapse to 1ms under
`prefers-reduced-motion`; this one is a progress readout of a real elapsed
time, and collapsing it would leave a hold gesture with nothing to say how
long to hold.

The button's shape morph runs on the **effects** spring rather than the
spatial one the recipe normally prescribes — see M3-EXPRESSIVE.md's pitfall
on underdamped radius morphs. Under a 600ms hold the spatial spring's
undershoot was plainly visible as a squared-then-rounded wobble.

### What the card reads

- **State** — `open` / `closed` / `opening` / `closing`, plus `unavailable`
  and `unknown`. A door mid-travel pulses a direction arrow, and
  `current_position` (when the opener reports it) turns a part-open door into
  "Open 40%" rather than a flat "Open".
- **`supported_features`** — Stop is only offered when the opener advertises
  `STOP` (bit 8). An opener without it gets the **reverse direction** while
  moving instead, which is what a physical opener's single button does
  anyway. An integration reporting no `supported_features` at all is assumed
  to do open and close.
- An `unavailable` door keeps a disabled button rather than dropping it, so
  the tile doesn't change height when a door goes offline.

### Header chips

An open or moving door shows a chip next to the title while the card is
collapsed, since the controls themselves are hidden at that point. They're
`tertiary-container`, not `error` — an open garage is worth surfacing but it
isn't a fault, and in error-container it would have been indistinguishable
from the red "Away" chip beside it.

The chip's state is a glyph rather than a word because the row can carry four
chips at once (two doors, two people) next to the switch; spelled out, they
pushed the card's own title into an ellipsis. The word survives in the
tooltip and the `aria-label`. For the same reason the header's
wrap-to-two-rows breakpoint moved from 320px to 400px — it was set when the
row only ever held two "Away" chips.

## Developing

```bash
npm install
npm run dev
```

Opens a dev harness at `http://localhost:5174` with mock entities and
buttons to toggle automation on/off, left/right home/away, and the right
door offline. The two mock covers actually travel: a service call steps
`current_position` to its end stop, so `opening` → `open` and the Stop
button have something real to act on. Service calls and `haptic` events are
logged under the card.

## Building for Home Assistant

```bash
npm run build
```

Produces `dist/garage-auto-open-card.js` (Lit bundled in, no other
runtime dependency).

### Installing into HA

1. Copy `dist/garage-auto-open-card.js` into `<config>/www/`.
2. Add a dashboard resource entry: Settings → Dashboards → ⋮ →
   Resources → add URL `/local/garage-auto-open-card.js?v=1`,
   type **JavaScript Module**.
3. Add the card to a dashboard with
   `type: custom:m3-garage-auto-open-card`.
4. Bump the resource URL's `?v=` on future rebuilds so the browser
   actually refetches the file instead of serving a cached copy.

## Configuration

| Key | Type | Description |
|---|---|---|
| `title` | string | Card header text (default `"Auto garage"`) |
| `automation` | entity id | The auto-open automation to show/toggle |
| `left_entity` / `right_entity` | entity id | Any entity whose state indicates home/away (e.g. a `device_tracker`) |
| `left_cover` / `right_cover` | `cover` entity id | The garage door each side drives. Omit for presence-only tiles |
| `hold_ms` | number | How long Open/Close must be held before the door moves (default `600`). `0` acts on a plain tap |
| `left_label` / `right_label` | string | Labels for the two garage pills (default `"Left"` / `"Right"`) |
| `home_state` | string | The state value that counts as "home" (default `"home"`) |
| `home_states` | list of strings | Override: any of these states counts as "home" |
| `left_home_state` / `right_home_state` | string | Per-side override of `home_state` |
| `left_home_states` / `right_home_states` | list of strings | Per-side override of `home_states` |

The visual editor (⋮ → Edit Card) covers `title`, `automation`,
`left_entity`, `right_entity`, `left_cover`, `right_cover`, `hold_ms`,
`left_label`, `right_label`, `home_state`,
`left_home_state`, and `right_home_state`. The list-valued overrides
(`home_states`, `left_home_states`, `right_home_states` — multiple
acceptable "home" values at once) have no row UI — edit those via the
card dialog's YAML/code-editor toggle.

## Project layout

```
src/
  garage-auto-open-card.ts        # the <m3-garage-auto-open-card> element
  garage-auto-open-card-editor.ts # visual editor (ha-form) for the common fields
  compute.ts                      # pure value computation (home/away, time-ago, automation state, cover state)
  card.css.ts                     # styles, ported from the original CARD_CSS
  types.ts
dev/
  index.html, main.ts, mock-hass.ts, fixtures.ts   # standalone dev harness
```
