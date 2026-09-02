# Quick Toggles Card — design

`custom:quick-toggles-card` → `dist/quick-toggles-card.js`

A single row of icon-only medallions for the "am I going to the gym / am I on
leave / is the roomba schedule active" class of helper. Replaces an existing
row of bare circular icon buttons.

## The problem with the row it replaces

The old row has exactly one state channel: the circle is blue or it isn't.
That collapses two genuinely different facts into one pixel — *the roomba
schedule is enabled* and *the roomba is cleaning right now* both render as
"blue circle". Any toggle backed by more than one entity is unrepresentable.

**Constraint (fixed):** no text. No labels, no status lines, no state words.
Identity comes from the glyph; everything else has to fit inside the
medallion. So the medallion gets **four independent visual layers**, and each
can be driven separately by config.

## Anatomy

```
        ╭─────────╮  ← .ring    2px annulus, the primary state channel
        │  ╭───╮  │
   ●────┼──│ 🤖│──┼──   .glyph   the ha-icon, identity
   ↑    │  ╰───╯  │
 .badge ╰─────────╯  ← .plate   filled disc + optional glow
```

| Layer | Off | On | Available as animation target |
|---|---|---|---|
| `.plate` | `--m3-surface-container-high`, hairline `--m3-outline-variant` | accent tint @ 16% (22% light) | yes |
| `.ring` | transparent | 2px solid accent @ 70% | yes |
| `.glyph` | `--m3-on-surface-variant`, monochrome | accent, full opacity | yes |
| `.badge` | hidden | hidden unless a state asks for it | yes |
| glow | none | `box-shadow: 0 0 16px accent`, opacity from `glow:` | yes |

A fifth layer, `.plate::before`, is the M3 **state layer** for hover and
press. It's tinted with the toggle's own `--qt-color` rather than the content
colour, which makes hovering an *off* medallion double as a preview of what
turning it on looks like — a behaviour this card already wanted, now
expressed as the standard M3 mechanism instead of three separate background
overrides.

## Material 3 Expressive

This card follows [M3-EXPRESSIVE.md](../M3-EXPRESSIVE.md). Two things about
it are specific to a card like this one and worth knowing:

**Surfaces come from `SchemeNeutral`, accents from `SchemeVibrant`.** A
medallion row shows up to fifteen accent colours at once, so the surfaces
under them have to be a neutral stage. `SchemeVibrant`'s neutral palette
carries chroma ~10 and would put every medallion on a blue-tinted plate
fighting its own colour; `SchemeNeutral` is ~2. Accent roles stay Vibrant so
the focus ring and chrome keep some life.

**The medallion stays a circle.** M3E's signature press feedback is a shape
morph, but the ring is a radial-gradient annulus and the sweep arc a conic
gradient — both assume a circle, and morphing only the plate would leave the
ring visibly detached. The card already has four independent state channels
and doesn't need shape as a fifth, so press feedback is the spring-driven
scale instead.

**The named palette is generated, not picked.** Each entry is that hue's M3
tonal palette at tone 80 (dark) and tone 40 (light) — the tones M3 uses for
`primary`. This was a correctness fix: the glyph is drawn in the accent on a
plate that is a tint of the same accent, and the old hand-picked light ramp
wasn't dark enough for that to work. Measured against the light plate, 8 of
14 colours fell below the 3:1 WCAG requires of graphical objects (teal 2.37,
amber 2.38, yellow 2.44, orange 2.46, lime 2.50, cyan 2.62, green 2.69, pink
2.90) and none reached 4.5:1. On the tonal ramp the worst case is 4.05:1 and
every colour passes; dark mode also becomes consistent at 7.6–7.7:1 where it
previously ranged 5.29–9.49. Re-run that check if you re-seed the palette.

Sizes — `size: sm | md | lg` → plate 40 / 48 / 56px, glyph 22 / 24 / 28px,
badge 9 / 10 / 11px, ring 2 / 2 / 2.5px.

The ring is drawn as a conic-gradient masked to an annulus
(`mask: radial-gradient(farthest-side, transparent calc(100% - Npx), #000 0)`),
not SVG and not a border — that is what lets `sweep` rotate a *partial* arc
around it with a single `rotate` keyframe and no extra elements.

## Animation vocabulary × targets

Chosen answer: ship all three channels and let each toggle pick.

| `animation` | Default target | Legal targets | Reads as |
|---|---|---|---|
| `sweep` | `ring` | ring | in progress, indeterminate |
| `spin` | `glyph` | glyph | the thing itself is turning |
| `pulse` | `glyph` | glyph, ring, plate, badge | attention, recurring |
| `breathe` | `glyph` | glyph, ring, plate, badge | ambient, ongoing, low-urgency |
| `bounce` | `glyph` | glyph | queued / pending |
| `shake` | `glyph` | glyph | fault, needs attention |
| `sheen` | `plate` | plate | working, subtle |
| `flash` | `plate` | plate, ring | one-shot press confirmation |

One animation per target, so combinations across layers are legal and
composable — `glyph: spin` + `badge: breathe` runs both. A second matching
state cannot add a second animation to a target already claimed (see the
cascade rule below).

**Reduced motion is a design case, not just a guard.** If motion is the only
channel carrying "busy" and `prefers-reduced-motion` kills it, that state
becomes invisible. So under reduced motion: all keyframes are dropped, and
any toggle that *would* be animating instead force-shows its badge at full
opacity and its ring at 100%. Motion degrades to a static mark, never to
nothing.

## Config

```yaml
type: custom:quick-toggles-card
title: Controls            # optional — omit for a bare row
size: md                   # sm | md | lg
align: center              # start | center | space-between
columns: auto              # auto (flex wrap) | 1..N (fixed grid)

toggles:
  - entity: input_boolean.gym_day
    name: Gym day          # a11y label + native tooltip only, never drawn
    icon: mdi:weight-lifter
    color: amber

  - entity: input_boolean.on_leave
    icon: mdi:sleep        # falls back to the entity's own icon, then domain default
    color: indigo

  - type: divider          # visual grouping without text

  - entity: input_boolean.roomba_schedule
    icon: mdi:robot-vacuum
    color: cyan
    states:
      - when: { entity: vacuum.roomba, state: cleaning }
        animation: spin              # target defaults to glyph
        badge: { color: cyan, animation: breathe }
      - when: { entity: vacuum.roomba, state: returning }
        animation: sweep             # target defaults to ring
        color: amber
      - when: { entity: vacuum.roomba, state: error }
        animation: shake
        color: red
      - when: off
        icon: mdi:robot-vacuum-off

  - entity: script.clean_house
    icon: mdi:broom
    momentary: true        # flashes on press instead of latching
    tap_action:
      action: call-service
      service: script.turn_on
```

Per-toggle keys: `entity`, `name`, `icon`, `color`, `states`, `visible`,
`momentary`, `tap_action`, `hold_action`, `confirm`.
Item type `divider` takes no other keys.

### `states[]` entry

```yaml
- when: on | off | <condition> | [<condition>, ...]   # a list = all must hold
  icon: mdi:...
  color: amber | "#rrggbb" | var(--my-color)
  animation: spin | sweep | pulse | breathe | bounce | shake | sheen | flash | none
  animation_target: glyph | ring | plate | badge      # overrides the default
  badge: true | { color, animation, entity, attribute, round, max }
  glow: true | false | 0..1
```

A `<condition>` is `{ entity, state }`, `{ entity, state_not }`,
`{ entity, above }`, `{ entity, below }`, or any of those plus
`attribute: <name>` to test an attribute instead of the state. `when: on` /
`when: off` are shorthand for the toggle's own entity. A condition naming a
missing entity simply does not match — it never throws and never blanks the
card.

### Resolution: per-field cascade, earliest match wins

Not "first matching entry wins wholesale". For each of `icon`, `color`,
`animation`(+target), `badge`, `glow` independently, the value comes from the
**earliest matching entry that specifies that field**, then the toggle's base
config, then the entity's own attributes, then the domain default.

That is why the Roomba example above never repeats `color: cyan` — the base
supplies it, and the `cleaning` entry only has to say what is *different*
(spin + badge). Deterministic, and non-repetitive in the common case where
one condition adds motion on top of an otherwise unchanged appearance.

`resolveToggles(hass, config, pending)` in `compute.ts` is pure and returns a
`ResolvedToggle[]` view-model — `{ on, iconName, color, ring, glyph, badge,
glow, plate }`. No DOM, no service calls, no clock reads beyond what's passed
in.

## Visibility

`visible:` takes the same condition language as a `states` entry, and hides
the toggle outright when it fails — removed from the row, not faded, so the
row reflows and stays evenly split.

Three decisions worth recording:

- **Missing entities fail *open*.** Appearance conditions fail closed (the
  override doesn't apply); a visibility condition naming an entity that
  doesn't exist keeps the toggle visible. Losing a control to a typo is a
  worse failure than showing one that should have been hidden, and with no
  text on the card there is nothing to explain the absence.
- **Stranded dividers are dropped.** Hiding a toggle can leave its divider at
  the start or end of the row, or two touching — a floating tick mark with no
  group beside it. `tidyDividers()` collapses those after filtering.
- **An all-hidden card hides itself** (`:host([hidden])`), rather than leaving
  an empty panel. HA sets `editMode` on cards while the dashboard is being
  edited; that suppresses the self-hide, or the card couldn't be selected —
  the same escape hatch HA's own conditional card uses.

## Layout

`align: even` is the default and is an **auto-fit grid**, not flex
`space-evenly`. Flex was tried first and is subtly wrong: a flex `gap` *adds*
to the distributed free space, so with `gap: 12px` the outer gaps measured
10.5px against 22.5px inner ones. Equal `1fr` tracks divide the width exactly,
`minmax(var(--qt-plate), 1fr)` keeps a floor so medallions never touch, and
columns stay aligned across wrapped rows.

`align: space-evenly` remains available for the strict flex reading — every
gap identical (which means `gap: 0`, letting free space do all the work) and a
partial last row spread across the full width rather than held in columns.
`start`, `center` and `space-between` are plain flex with the row's own gap;
`columns: N` is `repeat(N, 1fr)`.

The row always wraps rather than scrolling horizontally — a horizontal
scroller hides toggles with no affordance saying so. `container-type:
inline-size` goes on `ha-card`, never `:host` (CONTRIBUTING.md); under ~260px the
gap tightens and medallions drop one size step.

## Hover

Pointer-only (`@media (hover: hover)`) — on touch, `:hover` sticks after a tap
and would leave the last-pressed medallion permanently lit. Hover lifts the
medallion 7%, deepens an on toggle's tint and glow, and — the useful part —
previews an *off* toggle's configured colour on its ring at 0.28 opacity, so
the row answers "what will this look like on?" before you commit.

One trap found by the tests: `.slot:hover .off .ring` out-specified
`.armed .ring`, so hovering a medallion awaiting its confirming second tap
dimmed the very ring that signals it — and after the first tap the cursor is
by definition still on the medallion. State rings that mean something now
(`armed`, reduced-motion `emphasis`) are re-asserted inside the hover block.

## Value badges

`badge: true` is a dot. Naming an `entity` or `attribute` switches it to a
pill carrying that value — battery level, a count, a temperature.

- **Sizing**: `min-width` equal to the height keeps two digits circular; the
  pill only widens for three or more characters, so the common case stays a
  neat disc. It's anchored by its top-right corner so widening pushes it
  leftward over the plate rather than into the neighbouring medallion.
- **Ink**: derived from the fill's own luminance (the `readableTextColor`
  approach already proven in schedule-timeline-card's palette.ts), so palette
  colours and user hex both clear contrast. A `var(--token)` can't be
  introspected from CSS, so it falls back to white rather than guessing.
- **Clipping**: numbers are rounded (`round`) and capped (`max` → "99+"); a
  non-numeric value is shown but clipped to four characters. Without that a
  `state: cleaning` badge stretches across the whole medallion.
- **Signature**: a value badge's entity/attribute joins `cardEntityRefs()`.
  Third time this trap has appeared — condition entities, condition
  attributes, now badge sources. Anything the card *reads* has to be in the
  signature or it silently goes stale.

## Multiple tests per condition

`when` takes a `WhenTest[]`, and a test is either an entity condition or the
`on`/`off` shorthand — so "this toggle is on AND the vacuum is cleaning" is
expressible in one entry.

Order within a `when` list is meaningless (AND is commutative), which is why
the editor gives test rows a delete button but no reorder arrows, while the
`states` entries above them — where order decides which entry wins a field —
keep theirs. Same widget edits a toggle's `visible` clause.

The editor needed a second kind of draft for this. Per-field drafts weren't
enough: a freshly added test has no entity yet, so it can't be stored, so a
list re-derived from config came back one row shorter and the new row vanished
the instant it was added. `_listDrafts` owns the whole list while it's being
edited; config receives the tests that are complete enough to persist.

## Inferring value options

The editor's **Value** field is populated from the entity chosen in the same
test, in `state-options.ts`:

1. Attributes that enumerate an entity's own states — `options` (select,
   input_select), `hvac_modes`, `operation_list`.
2. For an attribute test, HA's sibling-list convention: `preset_mode` is
   chosen from `preset_modes`, `source` from `source_list`, `effect` from
   `effect_list`, and so on.
3. Otherwise a per-domain table of known states (vacuum, cover, lock, climate,
   alarm_control_panel, media_player, weather, the on/off domains, …).
4. The entity's *current* value leads the list, since it's the most likely
   thing you want to match.

Two suppressions matter as much as the sources. A **numeric** current value is
never offered — "is 78" is not a useful test, `above`/`below` is, and picking
either of those swaps the field for a number input. And the field always keeps
`custom_value: true`: this inference cannot be complete (a template sensor's
states aren't knowable from the entity at all), so it must never become a
cage — it's a shortcut for the common case, not a validator.

## Interaction

- **Tap** → `tap_action`, default `toggle` via `homeassistant.toggle` (never a
  hardcoded domain, per the repo's non-negotiables).
- **Hold** (500ms) → `hold_action`, default `more-info`. Cancels the tap.
- **Optimistic flip**: the medallion moves to its new state immediately and
  records a pending entry with a 4s expiry, reconciled on the next `hass`
  update. Without this, a 300ms HA round-trip reads as a dead button — and
  with no text there is nothing else on screen to confirm the press landed.
- **`momentary: true`** never latches: press runs one `flash` on the plate
  (700ms) and stops. If the target entity does report state (a `script.*`
  going `on`), a `states` entry can still show that.
- **`confirm: true`** requires a second tap within 2s, indicated by a
  full-opacity ring — for anything you don't want fired by a sleeve.
- **A11y**: each medallion is a real `<button>` with
  `aria-label` = `name` ?? `friendly_name`, `aria-pressed` for latching
  toggles, `title` for the native tooltip. Free, invisible, and the only way
  an icon-only row is discoverable.

## Files

```
src/
  quick-toggles-card.ts         # host element, row layout, tap/hold, optimistic state
  quick-toggles-card-editor.ts  # visual list editor
  medallion.ts                  # pure ResolvedToggle -> TemplateResult
  compute.ts                    # resolveToggles(), pure
  conditions.ts                 # matchCondition() / matchWhen()
  colors.ts                     # named color map (light/dark) + hex/var passthrough
  card.css.ts
  editor.css.ts
  types.ts
dev/
  index.html main.ts mock-hass.ts mock-ha-icon.ts mock-ha-form.ts fixtures.ts
```

`medallion.ts` is shared by the card *and* the editor, so each editor row can
show a live preview of the medallion it is configuring.

## Editor

Full visual editor, no YAML required.

- Top block: `ha-form` over `title`, `size`, `align`, `columns`.
- **Toggles list**: one collapsible row per toggle. Header = live medallion
  preview + entity friendly name + ▲ / ▼ / 🗑 buttons. Body = `ha-form` over
  `entity` (`ha-entity-picker`), `name`, `icon` (`{ selector: { icon: {} } }`
  — that is HA's real icon picker, which covers the "need to select icons"
  requirement without hand-wiring), `color`, `tap_action`, `hold_action`,
  `momentary`, `confirm`.
- **Nested states list** inside each row: sub-rows of
  condition-entity / operator (`is`, `is not`, `above`, `below`) / value /
  attribute, plus `icon`, `color`, `animation`, `animation_target`, `badge`,
  `glow`. Order is the cascade order, so ▲/▼ here is semantically meaningful,
  not cosmetic.
- Reorder via ▲/▼ buttons, not drag-and-drop — robust, keyboard-reachable,
  and it works in the dev harness.
- Rows expand by *rendering*, not by animating a `max-height`. This is a
  deliberate departure from the card-section pattern in the CONTRIBUTING.md: that
  pattern needs a known target height, and an `ha-form`'s height isn't known
  until HA has laid its selectors out — a fixed `max-height` clips it. Editor
  rows are config UI, not card chrome, so they open instantly.
- **Condition rows keep draft state.** A half-finished condition isn't
  representable in the config: choosing "applies when: entity" before naming
  an entity produces nothing to store, so a form derived purely from the
  config snapped the selection back to "always" and the entity field
  disappeared before it could be filled in. Each condition row therefore holds
  the in-progress choices in the editor and writes to config as soon as the
  condition is complete enough to persist. Draft keys are positional, so any
  reorder or delete clears them.
- Every edit dispatches `config-changed` with a freshly built config object —
  never a mutation of the one HA handed in.

## Repo non-negotiables that bite this card specifically

- **The render signature must include every entity referenced by a
  condition**, not just `toggles[].entity` — and, for an attribute condition,
  *that attribute's value* rather than the entity's state. Both bit during the
  build: `{entity: vacuum.roomba, attribute: battery_level, below: 20}` never
  fired, because the vacuum's state was unchanged and the card never
  re-rendered. `cardEntityRefs()` returns state refs and attribute refs
  separately for exactly this reason.
- **The signature must also include the theme.** Every medallion colour is
  resolved against dark/light at render time, so a theme flip with no entity
  change still needs a re-render — otherwise the CSS tokens switch and the
  resolved colours don't, and the card keeps the dark ramp on a light theme.
  That's what `renderSignature()` wraps `entitySignature()` for.
- **`ha-icon` centering**: glyphs here sit in small circular badges, which is
  exactly the case CONTRIBUTING.md calls out. Every `ha-icon` rule gets
  `--mdc-icon-size` alongside width/height, plus `display: flex;
  align-items: center; justify-content: center; margin: 0; padding: 0;
  line-height: 0;` and matching `min-width`/`min-height`. Not verifiable in
  the harness — real HA only.
- No `getCardSize()` / `getGridOptions()`. `display: block` on `ha-card`.
  `window.customCards.push(...)`. `getStubConfig()` / `getConfigElement()`.
  Theme from `hass.themes.darkMode` → `data-theme` on the host.

## Dev harness

Fixtures: the five toggles from the config example plus `vacuum.roomba`
cycling docked → cleaning → returning → error. Controls: flip each toggle,
step the vacuum state, force `prefers-reduced-motion`, dark/light, and a
tab that mounts the editor against mock `ha-form` / `ha-entity-picker` /
`ha-icon-picker`.

Anything about motion actually running, or ring geometry at a given size, is
worth driving with Playwright against the harness rather than eyeballing a
screenshot (CONTRIBUTING.md).

## Verified

Five Playwright suites drive the dev harness (109 checks, all passing):

- **Card** — layer/animation mapping for every condition in the sample config,
  the per-field cascade (a low-battery badge overriding the cleaning badge
  while cleaning still supplies the spin), icon swap when off, unavailable
  entities, tap/hold separation, optimistic flip, momentary flash + sheen,
  two-tap confirm and its timeout, fixed-column grid, the container query at a
  narrow width (wrap, no overflow), and the theme swap.
- **Visibility, layout and hover** — a toggle appearing and disappearing as its
  condition flips (and the signature that makes that happen), fail-open on a
  missing entity, stranded/doubled/trailing dividers collapsing, the card
  hiding itself when everything is hidden and staying visible in edit mode,
  equal grid tracks with evenly spaced centres and matching outer insets, and
  the three hover treatments.
- **Value badges + multi-test conditions** — the badge tracking an attribute
  live, rounding, capping, non-numeric clipping, pill growth, contrast ink,
  an ANDed pair holding and failing (low battery while cleaning vs. docked),
  the signature watching the badge source, and the editor adding a third test
  to an existing pair and switching a badge between dot and value.
- **Value suggestions** — domain states offered with the live state first,
  an input_select's own `options`, nothing offered for a numeric sensor or a
  numeric attribute, a number input for above/below, and a hand-typed value
  still saving.
- **Reduced motion + editor** — motion suppressed with the static badge/ring
  substituted in its place; and the editor adding a toggle, writing
  entity/icon/colour through to the card live, building a condition from
  scratch that then animates the medallion, refusing to clobber YAML-only
  service-call actions, reordering and deleting.

Still real-HA-only, per the CONTRIBUTING.md, and explicitly *not* verified here:
`--mdc-icon-size` glyph sizing and the inherited-line-height centring fix, the
real `ha-form` / `ha-entity-picker` / `ha-icon-picker` rendering (the harness
mock only exercises the data flow), and the sections-view grid's auto-row
sizing.

## Non-goals for v1

Text of any kind. Named/collapsible groups beyond `divider`. Jinja
templating in conditions. Drag-and-drop reorder. History or graphs.
