# Smart Irrigation Card

A custom Lovelace card for the
[Smart Irrigation](https://github.com/altmenorg/HAsmartirrigation)
integration. It answers the three questions you actually have when you check
in on it: **how do the buckets look, when does it next run, and when did it
last run** — and keeps everything else behind a per-zone collapse.

The integration exposes around fifteen entities per zone. This card asks for
none of them: it finds the zones itself, reads the whole model off each zone's
own duration sensor, and gets the next start from the integration directly.
`type: custom:m3-smart-irrigation-card` with no other keys is a complete card
— there is nothing to wire.

## How the bucket works

The integration's central idea is a virtual bucket per zone, a soil-water
balance in millimetres (inches on an imperial install — the card reads the
unit off the zone rather than assuming):

- **0 is field capacity** — the soil holds all the water it usefully can. It
  is where a run leaves the bucket, and it is the normal resting value.
- **Positive is banked rain**, capped at the zone's `maximum_bucket`; anything
  above that is runoff.
- **Negative is a deficit**, which is what the integration turns into a run:
  enough water to bring the bucket back to 0.

Each calculation moves it by `ET0 × multiplier × interval + precipitation`,
caps the result at `maximum_bucket`, and then subtracts drainage **only while
the bucket is above zero**. So a surplus drains away over the following days,
and a deficit never does: once negative, only rain and irrigation bring it
back.

Two things that surprise people, both worth knowing before reading the gauge:

- **The `multiplier` is the crop factor Kc, and it scales the
  evapotranspiration, not the run.** `ETc = ET0 × Kc`. Turning it up makes the
  bucket drain faster; it does not stretch a duration. (The integration moved
  it there in its #779 — applied at the end it scaled the whole water balance,
  crediting only Kc times the rain that actually fell.)
- **A zone has an allowed depletion,** its `irrigation_threshold`: how far it
  may dry out before the integration produces a run at all, so that the water
  builds into one deep soak instead of a trickle every day. It **defaults to
  zero**, which means "water as soon as anything at all is missing".

### The gauge

```
 24 ┌───────┐   <- maximum_bucket: the cap on banked rain
    │≈≈≈≈≈≈≈│   <- banked rain, filling upward as water
    │███████│
  0 ├───────┤   <- field capacity, the resting value
    │▓▓▓▓▓▓▓│   <- the deficit, hanging downward into the sump
    │▓▓▓▓▓▓▓│
 −6 ┄┄┄┄┄┄┄┄┄   <- the watering point: the fill reaching this line is
    └───────┘      the "Needs water" verdict
```

**The two bands are not one scale**, and that is deliberate. They measure
different things against different references — banked rain against
`maximum_bucket`, depletion against the watering point — and a shared scale
hands nearly all of the vessel to the surplus: on a typical zone (24mm cap,
watering at 6mm) the whole dry-down gets a fifth of the height. That is
backwards. The surplus band is empty for most of a zone's life; the deficit
band is where every decision is made. So the split is fixed, each band is
scaled to its own end, and both ends are labelled on the axis. It also makes
every zone's vessel the same shape, so a column of zones reads as fractions of
their own dry-downs rather than as unrelated scales.

The deficit band runs a quarter past the watering point, so the mark has
somewhere to sit that is not the floor and an overdue zone looks different
from one that has just come due. Past the bottom of the band, a
double-chevron rather than a pretence that the scale still holds.

**Where the watering point comes from**, in order: `watering_point` in the
card config; otherwise the zone's own `irrigation_threshold`, fetched from the
integration; otherwise a quarter of `maximum_bucket`. The last case is an
*estimate* — this card's idea of when a deficit is worth a soak, not a promise
the integration made — so it is drawn as a finer dotted line and labelled
"Soak at (estimated)" in the details rather than "Waters at".

### The verdict

An **empty vessel is not an alarm** — it is the healthy resting state — which
is why the verdict beside it is words rather than colour alone:

| Verdict | Means |
|---|---|
| *Watering now* | the zone's valve is open |
| *Needs water* | the deficit has reached the watering point; run length and roughly how many litres |
| *Top-up due* | still short of the watering point, but the integration has a run queued anyway (which it always will with no allowed depletion set) |
| *Drying out* | a real deficit, no run due; how far through the dry-down it is |
| *No water needed* | at capacity, or holding banked rain |
| *Zone disabled* | not scheduled, though it can still be run by hand |

*Drying out* and *Top-up due* are unfilled and quiet — only the states that
are **events** get a filled block. That is the point of separating them:
a zone spends nearly all of its life drying down.

> **Why this card does not use `binary_sensor.*_irrigation_needed`.** The
> integration computes it as a bare `bucket < 0`, ignoring the zone's own
> allowed depletion. With continuous updates on, the first calculation after a
> run puts the bucket a few tenths of a millimetre under zero, that sensor
> turns on, and it stays on for the entire dry-down. A card reading it
> announces "Needs water" within the hour, every time a zone is watered. This
> card takes the bucket against the watering point instead, and says
> separately — in the sub-line — when a run is nonetheless queued.

**The water surface only moves while a zone is actually watering.** It is M3
Expressive's wavy-progress mask reused at half its wavelength; a standing
bucket gets a standing surface, for the same reason the wavy progress
indicator flattens when nothing is progressing.

## The three ET numbers are not three of the same thing

The integration publishes `et_value`, `et_deficiency` and `eto` per zone, and
they are routinely read as if they were variations on one figure (its own
issue #528 is about exactly this). They are not:

| Attribute | What it is |
|---|---|
| `eto` | **Reference evapotranspiration** — the day's evaporative demand, the positive figure weather services quote |
| `et_deficiency` | Exactly `−eto`. The raw per-day figure the calculation module returned, before the crop factor and before any rain |
| `et_value` | The **net depth the last calculation applied to the bucket**: `ET0 × Kc × interval + precipitation`. Positive on a day when more rain fell than water evaporated. The integration's entity for it is named "Applied ET", which is exactly why it gets read as the day's ET |

So the card shows **two** rows, not three: *Evapotranspiration* (`eto`, as
`mm/day`) and *Net to bucket* (`et_value`). Showing `et_deficiency` as well
would print the same number twice with opposite signs.

## Discovery

Zones are found by the **zone id the integration puts on its own entities**,
not by matching entity-id strings — so renaming an entity in HA doesn't hide
it from the card. The main duration sensor spells it `id`; every satellite
spells it `zone_id`.

Within a zone, entities are classified by `device_class` (`timestamp` is the
last run, `water` is the water used, `running` is watering-now, `problem` is
the problem sensor), which is equally rename-proof. **Buttons are the one
exception**: a button's attributes say nothing about what pressing it does,
so those match on entity-id suffix, then fall back to the integration's own
icon.

The three zone-independent buttons (refresh weather, calculate all, irrigate
all) carry no zone id, so they are matched by suffix *and* required to share
at least two leading name tokens with a zone that was found — which is what
stops an unrelated `button.patio_misters_irrigate_all` elsewhere in the house
from being adopted. Every one of them can still be set by hand.

## Developing

```bash
npm install     # at the repository root
npm run dev
```

Opens a dev harness at `http://localhost:5182` with three mock zones chosen to
cover both sides of the watering point and both sources it can come from:
**Backyard** drying down with an allowed depletion set in the integration,
**Front lawn** on the integration's default threshold of zero (so the card
estimates a point, marks it as an estimate, and the integration has a run
queued anyway), and **Veg beds** holding banked rain. Buttons walk the first
zone past every landmark of its own scale — drying, nearly due, exactly due,
overdue, past the bottom of the band — and toggle watering, cycle a zone's
mode, raise a problem, drop to a single zone, and **drop the
`smart_irrigation/info` command** so the no-next-run fallback can be seen.
Dark/light toggle and a live config dump beside the real visual editor.

`dev/mock-hass.ts` diverges from the copy the other cards share, for the same
reason `activity-heatmap`'s does: it has to answer websocket commands — both
`smart_irrigation/info` and `smart_irrigation/zones`. Their replies are
derived from the same fixture zones the entities are built from, so the total
duration printed beside the next start agrees with the per-zone durations
beside the gauges, and the thresholds the card marks on the gauges are the
ones the fixture durations were calculated against.

The harness derives each zone's run duration from that zone's own bucket,
size, throughput and allowed depletion rather than carrying a
separately-authored number — including the two details that are easy to get
wrong and were: the multiplier is **not** in the duration (it belongs on the
evapotranspiration), and a deficit under the allowed depletion produces **no
run at all**. The card turns a duration back into litres and prints it next
to the bucket it came from, so fixtures that disagreed would make a correct
card look like it was doing bad arithmetic.

## Building for Home Assistant

```bash
npm run build
```

Produces `dist/smart-irrigation-card.js` (Lit bundled in, no other runtime
dependency).

1. Copy it into `<config>/www/`.
2. Settings → Dashboards → ⋮ → Resources → Add Resource, URL
   `/local/smart-irrigation-card.js`, type **JavaScript Module**.
3. Add the card via the picker (search "Smart Irrigation") or YAML:
   `type: custom:m3-smart-irrigation-card`.
4. Bump the resource URL's `?v=` on future rebuilds, or the browser serves a
   cached copy.

## Configuration

Every key is optional.

| Key | Type | Description |
|---|---|---|
| `title` | string | Card header text (default `"Irrigation"`) |
| `zones` | list of entity ids | The zones' own duration sensors, in display order. Omitted: every zone found, ordered by zone id |
| `next_schedule` | entity id | **Override** for where the next run comes from — see below. Leave empty; the integration answers by default |
| `refresh_weather` | entity id | `button.*` override; discovered otherwise |
| `calculate_all` | entity id | `button.*` override; discovered otherwise |
| `irrigate_all` | entity id | `button.*` override; discovered otherwise. Only rendered when more than one zone is shown — with one zone it is the same button as that zone's own |
| `show_details` | boolean | The per-zone collapse (default `true`) |
| `watering_point` | number | How far a zone may dry out, in the depth unit your zones report, before the card calls it *Needs water*. Also the line marked across the gauge. Omitted: each zone's own `irrigation_threshold` from the integration, and a quarter of its `maximum_bucket` for zones that have none set |
| `deficit_scale` | number | Deprecated name for `watering_point`, from when it only set how deep the sump was drawn. Still read; the visual editor migrates it on the next save |
| `hold_ms` | number | How long "Hold to irrigate" must be held (default `600`). `0` fires on a plain tap |

```yaml
type: custom:m3-smart-irrigation-card
```

The visual editor (⋮ → **Edit Card**) covers every key above. Its Zones
section reads back each zone's current bucket, which is the proof that
discovery found what you expected.

### Where the next run comes from

**The integration knows, but it never made an entity for it.** Its next start
is computed on demand and served over the `smart_irrigation/info` websocket
command — the same one feeding **Info → Next irrigation → Next start** in the
integration's own panel. The card calls it directly, so the time it shows is
the integration's own answer rather than a reconstruction: the *selected*
start trigger rather than an assumed sunrise, that trigger's offset, sunset
where sunset is what was chosen, and any remaining days-between-irrigation
skip days already applied.

That means there is nothing to configure, and no template sensor to write.
The same reply also carries the total run length across every enabled zone,
which the tile shows beside the time when the card is drawing more than one
zone (with one zone, that zone's own verdict already says it).

`next_schedule` exists for the case where the integration's triggers are
*not* what decides when watering happens — an automation of yours calls the
services on its own timetable, say. Set it and it wins; it takes:

- a `schedule.*` helper — its `next_event` attribute is used;
- a **time-only** `input_datetime.*` — `"04:00:00"` is a daily schedule, so it
  resolves to the next occurrence of that time, today if it is still ahead
  and tomorrow otherwise;
- an `input_datetime.*` with a date, or any sensor whose state is a full
  timestamp.

Pointed at something that isn't a time in any of those shapes, the tile shows
that entity's raw state rather than a silent dash, so a mis-wired entity is
visible. And on an install whose integration doesn't serve the command — an
older version, or a card rendered without a websocket connection — the tile
is simply not drawn, and "Last run" takes the full width. That is a fallback,
not an error state: nothing is logged and nothing goes red.

## What's on the card

**Always visible** — the header (a status line plus the refresh-weather and
calculate-all buttons), a problem banner per zone whose problem sensor is on
carrying the integration's own `reason` text, the next-run/last-run pair, and
one tile per zone with its gauge, verdict, age and water used. Card-level
"last run" is the most recent across zones, and names the zone when there is
more than one.

The header's status line is a count when there are several zones — `2 of 3
zones need water` — and **how long ago the zone was last calculated** when
there is only one. With a single zone the verdict beside its gauge already
says whether it needs water, so repeating that would spend the card's only
summary line on something already on screen; how current the numbers are is
the thing nothing else on the front surface says.

**Behind each zone's chevron** — bucket, max bucket, the watering point and
how far through it the zone is, last run, evapotranspiration, net to bucket,
drainage, water used, weather-data trust (sample
count and how long ago it was calculated), mode, zone size and throughput,
and the run cap. Each row opens HA's more-info dialog for the underlying
sensor where there is one, so the history graph is one tap away. Then the
multiplier stepper, Calculate / Reset bucket / Reset water used, and
**Hold to irrigate**.

## Styling

Material 3 Expressive — see [M3-EXPRESSIVE.md](../M3-EXPRESSIVE.md) for the
system. Accents are the water cyan (`#00cfff`) `irrigation-control` and
`pc-control` use, byte-identical; surfaces come from the shared house neutral
so the card sits on the same plate as every other card.

**The `dry` role is an extended semantic colour, and its measurement is
deliberate.** A dry zone is not an error — nothing is wrong, the integration
is working — so `error` would overstate it, and the water accent would say
the opposite of what it means. It is generated as a `TonalPalette` off seed
`#e08b3a` at the standard custom-colour tones. It is also **1.00:1 against
`--m3-primary` in both themes**, because both are M3 tones off different
hues, and pitfall 16 says hue alone is not a channel. That is accepted here
because hue is not doing the work: a deficit hangs *below* the zero line
where water sits *above* it, the two are mutually exclusive within a zone,
the sump is hatched where the water column is solid, and the verdict says
which in words. Four channels; don't rework the gauge down to one.

Measured adjacencies (dark / light):

| Pair | Ratio | Target |
|---|---|---|
| water fill vs vessel interior | 7.20 / 5.01 | 3:1 |
| dry fill vs vessel interior | 7.18 / 5.00 | 3:1 |
| zero line vs vessel interior | 3.86 / 3.46 | 3:1 |
| watering-point mark vs vessel interior | 9.50 / 13.34 | 3:1 |
| watering-point mark vs dry fill (submerged) | 7.70 / 6.45 | 3:1 |
| verdict glyph on its own container | 5.46 / 4.99 | 3:1 |
| verdict text on its container | 7.21 / 13.30 | 4.5:1 |
| problem banner text on banner | 7.24 / 13.26 | 4.5:1 |

The verdict *block* against the zone tile is 1.54 / 1.05:1 — a container role
against a surface role, which is the house pattern for chips and banners, and
is why the block carries a glyph in the strong role as its high-contrast
anchor. It is also why "No water needed", "Drying out" and "Top-up due" get no
block at all: only the states that are *events* are filled, which keeps the
card quiet in the state it is in most of the time and makes a fill mean
something.

**The deficit fill keeps one colour on both sides of the watering point**, and
the mark's position carries the meaning instead. A second, quieter dry tone
would have to be a reduced opacity of the same role —
`--m3-dry-container` measures 1.32:1 dark / **1.00:1** light against the
vessel interior, i.e. invisible — and every alpha that stayed
distinguishable from the full-strength fill fell under the 3:1 a graphical
object needs. The mark instead swaps to `on-dry` once the fill covers it, so
it is read against whichever of the two it is actually drawn on.

## Behaviour notes

- **Discovery is cached.** It walks every entity in the system, so it only
  re-runs when the entity set itself could have changed — a different number
  of states, or a zone the card had resolved having gone away. A state
  *value* changing never invalidates it.
- **The re-render signature includes the bucket attribute**, not just entity
  states. A zone's whole model lives in its main sensor's attributes, so
  watching the state alone would miss a bucket that moved while the duration
  sensor stayed at `0` — which is most of what this card draws.
- **A minute ticker**, only for the relative ages. Everything else arrives
  with its own state update.
- **The next start is fetched, not subscribed.** It is refetched whenever the
  entity signature changes — which is exactly when the integration has
  calculated something and the answer can have moved — and otherwise at most
  every five minutes, since it changes on the scale of a sunrise. Never from
  `render()`, which runs for reasons that have nothing to do with the answer
  going stale; one call in flight at a time; and a card detached mid-flight
  doesn't resurrect itself with a render.
- **The same fetch collects the zones' allowed depletions**, over
  `smart_irrigation/zones`, because `irrigation_threshold` is in none of a
  zone's entities or their attributes — it lives only in the integration's
  store. The two commands are asked together and fail independently: `/zones`
  has existed far longer than `/info`, so an install that cannot answer one
  can still answer the other. With neither, every zone falls back to an
  estimated watering point and says so.
- **`irrigation_explanation` is deliberately ignored.** It is the one field in
  that reply that arrives as markup (`<br/>`-separated), nothing on this card
  renders unsanitised HTML, and the per-zone figures say the same thing in
  numbers.
- **Hold to irrigate** is the only control with a physical consequence, so a
  tap does nothing: the button fills over `hold_ms` and fires at the end. It
  captures the pointer (a finger sliding off never delivers its `pointerup`),
  cancels on `pointerup`/`pointercancel`/`lostpointercapture`/`blur`, guards
  keyboard auto-repeat, bypasses the timer entirely at `hold_ms: 0`, and is
  cleared in `disconnectedCallback` — a card removed mid-hold must not still
  have a timer queued to open a valve. It sits apart from the tap-only
  actions rather than inside a group with them; separation distinguishes a
  consequential control without asking colour to.
- **The multiplier stepper is the one place the card computes a value.** The
  `number` domain has no increment/decrement service, so `number.set_value`
  is the only way to move it; the entity's own min/max/step are used and the
  result is re-snapped to the step so a float step can't accumulate drift.
- **The mode chip only appears when a zone is *not* automatic.** Automatic is
  what every zone is by default; a chip saying so on every tile competed with
  the zone's name for width at exactly the sizes where width is scarce, and
  buried the two modes worth noticing. The mode is always readable in the
  details.
- **Zone area arrives as the HTML string `m<sup>2</sup>`.** Nothing on this
  card renders unsanitised HTML, so units are translated to real characters
  and any other tagged unit degrades to its text.
- **Timestamp attributes have no timezone.** `last_calculated` and
  `last_updated` come as `"YYYY-MM-DD HH:MM:SS"`; the space form isn't in the
  ECMAScript date grammar, so it's normalised to the `T` form, which is
  specified — and specified as local time, which is what the integration
  means.
- **Ages floor rather than round.** "2 days ago" has to mean two days have
  passed; rounding put 38 hours at "2 days ago" beside a date formatted
  "Yesterday".
- **No `getCardSize()`/`getGridOptions()`** — see CONTRIBUTING.md. The card's
  height depends on which zones are expanded, which HA has no visibility
  into.

## Project layout

```
src/
  smart-irrigation-card.ts        # the <m3-smart-irrigation-card> element
  smart-irrigation-card-editor.ts # visual editor (ha-form), covers every key
  compute.ts                      # discovery + pure value computation
  info.ts                         # the smart_irrigation/{info,zones} calls
  m3.css.ts                       # M3E tokens (colour/shape/motion/type)
  card.css.ts                     # component styles, all built on those tokens
  editor.css.ts                   # shared editor chrome, copied verbatim
  types.ts
dev/
  index.html, main.ts, fixtures.ts, mock-hass.ts,
  mock-ha-icon.ts, mock-ha-form.ts    # standalone dev harness
```
