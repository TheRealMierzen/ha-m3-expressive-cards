# Quick Toggles Card

A custom Lovelace card for the "am I going to the gym / am I on leave / is the
roomba schedule active" class of helper: a single row of **icon-only**
medallions, no labels and no status text. Same Lit + TypeScript project
structure as the other cards in this family (`garage-control/`,
`pc-control/`, `irrigation-control/`, `geyser-control/`), and on the
**[Material 3 Expressive](../M3-EXPRESSIVE.md)** visual language alongside
`geyser-control/` — the remaining cards are still on the older `--pc-`
scheme.

It exists because a plain row of circular icon buttons has only one state
channel — the circle is coloured or it isn't — which collapses two genuinely
different facts into the same pixel: *the roomba schedule is enabled* and *the
roomba is cleaning right now*. Every medallion here has four independently
drivable layers instead:

```
      ,---------.  <- ring    2px annulus; a conic-gradient arc can sweep it
      |  ,---.  |
 O----+--| # |--+--   glyph   identity
 ^    |  `---'  |
badge  `---------'  <- plate  fill, tint and glow
```

Ring, glyph, plate and badge can each carry their own animation, so
"scheduled" and "busy" never have to fight over one channel.

See [DESIGN.md](DESIGN.md) for the full design rationale, the animation ×
layer matrix, and what is and isn't verified.

## Configuration

```yaml
type: custom:m3-quick-toggles-card
title: Controls            # optional - omit for a bare row
size: md                   # sm | md | lg
align: even                # even | start | center | space-between | space-evenly
columns: auto              # auto (fit as many even columns as fit) | a number

toggles:
  - entity: input_boolean.gym_day
    name: Gym day          # tooltip + accessible name only, never drawn
    icon: mdi:weight-lifter
    color: amber

  - type: divider          # visual grouping, no text

  - entity: input_boolean.roomba_schedule
    icon: mdi:robot-vacuum
    color: cyan
    states:
      - when: { entity: vacuum.roomba, attribute: battery_level, below: 20 }
        badge: { color: red, animation: pulse }
      - when: { entity: vacuum.roomba, state: cleaning }
        animation: spin
        badge: { color: cyan, animation: breathe }
      - when: { entity: vacuum.roomba, state: returning }
        animation: sweep
        color: amber
      - when: off
        icon: mdi:robot-vacuum-off

  - entity: script.clean_house
    icon: mdi:broom
    momentary: true        # flashes on press instead of latching
    tap_action:
      action: call-service
      service: script.turn_on
```

### Per-toggle keys

| Key | Meaning |
|---|---|
| `entity` | What the medallion reflects and (by default) toggles. |
| `name` | Tooltip and accessible name. Never rendered as text. |
| `icon` | Falls back to the entity's own icon, then a generic one. |
| `color` | Palette name (`blue`, `cyan`, `amber`, …), a hex value, or `var(--your-token)`. |
| `states` | Ordered conditional overrides — see below. |
| `momentary` | Flash on press instead of latching; for scripts and scenes. |
| `confirm` | Requires a second tap within 2s before firing. |
| `tap_action` | `toggle` (default), `more-info`, `none`, or an object with `action: call-service`. |
| `hold_action` | Default `more-info`. Hold is 500ms and never also fires the tap action. |
| `visible` | Show the toggle only while a condition holds — same condition language as `states`. |

### `states` — ordered, and cascading per field

Conditions are evaluated top-down, but the cascade is **per field, earliest
match wins** — not first-matching-entry-wins-wholesale. For each of `icon`,
`color`, `animation`, `badge` and `glow` independently, the value comes from
the earliest matching entry that specifies *that field*, then the toggle's
base config, then the entity's own attributes.

That's why the Roomba above never repeats `color: cyan`: the base supplies it,
and each condition only says what's different. It's also why the low-battery
entry sits first — it claims the badge layer, while the later `cleaning` entry
still supplies the spin. The result is a red low-battery dot on a spinning
medallion, from two sensors, with no config repeated.

A test is `{entity, state}`, `{entity, state_not}`, `{entity, above}`,
`{entity, below}`, or any of those plus `attribute: <name>` to read an
attribute instead of the state. `on` / `off` are shorthand for the toggle's
own entity. A test naming a missing entity simply doesn't match — it never
blanks the card.

`when` takes **one test or a list of them**, ANDed, and the list can mix the
shorthand with entity tests:

```yaml
      - when:
          - { entity: vacuum.roomba, attribute: battery_level, below: 20 }
          - { entity: vacuum.roomba, state_not: docked }
        badge: { entity: vacuum.roomba, attribute: battery_level, color: red }
```

That's "low battery *and* not docked" — 12% while docked and charging isn't
worth a badge. Order within a `when` list doesn't matter (AND is
commutative); order *between* `states` entries decides which one wins a
field.

### Visibility

```yaml
  - entity: input_boolean.guest_mode
    icon: mdi:bed
    visible: { entity: sensor.house_mode, state: home }
```

Hidden toggles are removed from the row, not faded, so the rest reflows and
the row stays evenly split. Dividers left stranded at either end — or doubled
up — by a hidden neighbour are dropped too. If *every* toggle ends up hidden
the card hides itself rather than leaving an empty panel on the dashboard
(except in dashboard edit mode, or it couldn't be selected).

One deliberate asymmetry with `states`: a visibility condition naming an
entity that **doesn't exist** keeps the toggle **visible**. Appearance
conditions fail closed — the override just doesn't apply — but a typo that
silently deletes a control from your dashboard is a worse failure than one
that shows a control you meant to hide.

### Value suggestions in the editor

The **Value** field suggests what the chosen entity can actually be — its
`options` / `hvac_modes` / `operation_list` attribute when it has one, the
sibling list for an attribute test (`preset_mode` from `preset_modes`), or the
domain's known states otherwise, with the entity's current value first. It
stays free text, since that inference can't be complete: a template sensor's
states aren't knowable from the entity at all. Picking `is above` / `is below`
swaps it for a number field instead.

### Layout

`align: even` (the default) lays the row out as an auto-fit grid of equal
columns: every row divides the card's width evenly, and medallions stay in
line with each other across wrapped rows. `align: space-evenly` is the flex
version — identical gaps including the outer two, and a partial last row
spreads across the full width instead of keeping its columns. `columns: N`
forces exactly N per row. `start`, `center` and `space-between` pack the
medallions at their natural spacing.

### Badges

A badge is a dot by default. Give it an `entity` or an `attribute` and it
becomes a small pill carrying that value instead — a battery level, a count, a
temperature:

```yaml
        badge:
          entity: vacuum.roomba       # defaults to the toggle's own entity
          attribute: battery_level    # omit to read the state
          color: red
          animation: pulse
          round: 1                    # decimal places, default 0
          max: 99                     # anything higher shows as "99+"
```

Two or three characters fit; the pill grows for longer values and stays
circular for two digits. Ink is picked from the fill's luminance so palette
colours and your own hex both stay readable — a `var(--token)` the card can't
introspect falls back to white. A non-numeric value is shown clipped to four
characters, so a stray `state: cleaning` can't stretch the badge across the
medallion.

Badges are still per-condition, so the value and its colour can come from
different `states` entries — that's how the Roomba shows a cyan battery
reading normally and a red pulsing one when it's low and away from the dock.

### Animations

| `animation` | Default layer | Legal layers |
|---|---|---|
| `sweep` | ring | ring |
| `spin` | glyph | glyph |
| `pulse` | glyph | glyph, ring, plate, badge |
| `breathe` | glyph | glyph, ring, plate, badge |
| `bounce` | glyph | glyph |
| `shake` | glyph | glyph |
| `sheen` | plate | plate |
| `flash` | plate | plate, ring |

One animation per layer, so combinations across layers compose. Override the
layer with `animation_target`. `animation: none` claims a layer too, which is
how a condition suppresses motion a lower-priority entry would add.

Hovering (pointer devices only — `:hover` sticks after a tap on touch) lifts
the medallion slightly and deepens an on toggle's tint. Hovering an *off*
toggle previews its configured colour on the ring at low opacity, so you can
see what turning it on will look like before you commit.

Under `prefers-reduced-motion` the keyframes are dropped **and a static
substitute takes over**: anything that would be animating shows its badge and
a full-strength ring instead. With no text on the card, motion is sometimes
the only channel carrying "busy", so silence would make that state vanish.

## Developing

```bash
npm install
npm run dev
```

Opens a dev harness at `http://localhost:5180` with mock entities and buttons
to flip each toggle, step the vacuum through docked / cleaning / returning /
error, drop its battery below the low-battery threshold, narrow the column to
trigger the container query, switch dark/light, and open the real visual
editor against a mocked `ha-form` (with a live dump of the config it emits).

`prefers-reduced-motion` can't be faked from page script — emulate it in
DevTools (Rendering → Emulate CSS media feature) or via Playwright's
`emulateMedia`.

## Building for Home Assistant

```bash
npm run build
```

Produces `dist/quick-toggles-card.js` (Lit bundled in, no other runtime
dependency).

### Installing into HA

1. Copy `dist/quick-toggles-card.js` into HA's `www/` folder.
2. Add it as a Lovelace resource (`/local/quick-toggles-card.js?v=1`), type
   JavaScript Module.
3. **Bump the `?v=` query param every time you rebuild** — HA and the browser
   will otherwise serve a stale cached copy.
