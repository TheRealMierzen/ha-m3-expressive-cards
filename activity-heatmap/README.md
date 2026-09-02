# Activity Heatmap Card

A GitHub-contribution-style grid for any Home Assistant entity: one cell per
day, seven rows of weekdays, columns of weeks, coloured by how much happened.
Same Lit + TypeScript project structure as the other cards in this family
(`garage-control/`, `pc-control/`, `irrigation-control/`, `geyser-control/`,
`quick-toggles/`), and on the **[Material 3 Expressive](../M3-EXPRESSIVE.md)**
visual language alongside `geyser-control/` and `quick-toggles/`.

```
        Sep   Oct   Nov   Dec   Jan   Feb   Mar
  Tue  ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪
  Thu  ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪
  Sat  ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪▪ ▪▪▪▪

  TOTAL 179 visits   CURRENT STREAK 5 days     Less ▫▪▪▪ More
```

Unlike the rest of this family, the card's data isn't in `hass.states` — a
heatmap is a view of *history*, so it pulls per-day numbers from the recorder
over the websocket connection. **Which history source you use is the single
most important configuration decision**, and the rest of this file leads with
it for that reason.

## Start here: where a day's number comes from

| `source` | Reaches back | Needs | Good for |
| --- | --- | --- | --- |
| `statistics` | Forever | An entity with a `state_class` | A year of anything numeric |
| `history` | `purge_keep_days` (10 by default) | Nothing | On/off entities, recent ranges |
| `attribute` | As far as the attribute goes | A template sensor | Data you already maintain |

`source: auto` (the default) picks `attribute` if you named an `attribute`,
`statistics` if the entity has a `state_class`, and `history` otherwise.

### The counter trap

The obvious way to count gym visits is `counter.gym_visits`, and it will look
like it works — for about ten days. **Counters carry no `state_class`, so Home
Assistant keeps no long-term statistics for them**, and raw recorder history is
purged after `purge_keep_days`. A year-long heatmap of a counter shows a year
of empty cells with a fortnight of data at the right-hand edge.

The fix is a template sensor that mirrors the counter and *does* declare a
state class, which HA then keeps daily statistics for indefinitely:

```yaml
# configuration.yaml
template:
  - sensor:
      - name: Gym visits total
        unique_id: gym_visits_total
        state: "{{ states('counter.gym_visits') | int(0) }}"
        state_class: total_increasing
        unit_of_measurement: visits
```

```yaml
type: custom:activity-heatmap-card
title: Gym Consistency
entity: sensor.gym_visits_total
stat: change        # visits *added* that day, not the running total
```

`stat: change` is the one that turns an ever-climbing total into a per-day
number, and it's the default for a `total` / `total_increasing` sensor.

**It is not a valid question to ask of every sensor.** `change` is derived from
a statistic's `sum` column, and only the `total` classes have one. A
`measurement` sensor — a temperature, a power reading, a humidity — keeps
`mean` / `min` / `max` and no `sum` at all, so asking it for `change` returns a
row per day with `null` in every one: no error, no data. The card reads the
entity's `state_class` and defaults to `mean` for those, so this only bites if
you pin `stat: change` yourself. If you do, the card says so and names the
columns that entity actually has.

### If statistics look broken

The card distinguishes the three causes and tells you which one you have,
rather than showing an empty grid:

| What the card says | What it means |
| --- | --- |
| *No long-term statistics for `sensor.x`* | The recorder keeps none for that entity — it has no `state_class`. See the counter trap above. |
| *…has daily statistics, but no "change" values* | Wrong column for that sensor's class. The message lists the columns it does have and suggests one. |
| *Nothing recorded in this range yet* | Statistics exist and the column is right, but every day in the range is genuinely empty. |

Very old Home Assistant versions don't know the `change` statistic type and
reject the request outright. The card notices, retries without it, and
reconstructs each day's change from consecutive `sum` values instead — the
numbers come out identical, so this needs no configuration.

### On/off entities

For "was the workshop light on", "was anyone home", "did the pump run", point
it at the entity itself:

```yaml
type: custom:activity-heatmap-card
title: Workshop hours
entity: binary_sensor.workshop_occupied
source: history
aggregate: on_time     # hours spent on; or on_count for "times it turned on"
days: 60               # keep it inside your recorder's retention
```

Durations are computed from *intervals*, split at local midnight — a light left
on overnight is charged to both days in the right proportion, and the
time-weighted `mean` doesn't let a value that held for two seconds outvote one
that held for twenty hours.

### Text sensors, and the breakdown panel

For a sensor whose state is a *name* rather than on/off — the game you're
playing, the washing-machine programme, which room is occupied — the question
is "how long was this doing anything", and the follow-up is "doing what".

```yaml
type: custom:activity-heatmap-card
title: Gaming
entity: sensor.current_game
aggregate: state_time     # hours in any state that isn't ignored
unit: h
breakdown: true           # click a day for the per-state split
```

`state_time` is the default aggregate for an entity whose states aren't numbers
and aren't in the on/off vocabulary, and `breakdown` defaults to on whenever
`state_time` is in play — so in practice both lines above are optional.

That decision is made from **every state in the fetched window**, not from the
entity's current state. It has to be: a sensor reporting which game is running
reads `off` whenever you aren't playing, which is most of the time, and judging
by the current snapshot would call it a binary sensor and count transitions
that never happen — so the card would work or not depending on whether you
happened to be mid-game when the dashboard loaded.

The panel has two modes. Before anything is clicked it summarises the **whole
range**, so it says something useful on load rather than sitting empty:

```
Last 120 days   159h 2m                   Click a day for its breakdown
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒░░░░░░▒▒▒░░▓▓
● Elden Ring       26 days               57h 16m      36%
● Baldur's Gate 3  21 days               43h 52m      28%
● Stardew Valley   13 days               24h 31m      15%
```

Click a day and it swaps to that day — same colours, same ordering, plus how
many times each state was entered:

```
Sat, 9 May 2026   4h 50m                                    ✕
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒
● Stardew Valley                            2h 53m      60%
● Elden Ring                                1h 57m      40%
```

The ✕, `Escape`, or clicking the same day again all go back to the range
summary.

Two switches control it, and both are in the visual editor under **Extras**:

| | `breakdown_summary: true` (default) | `breakdown_summary: false` |
| --- | --- | --- |
| **`breakdown: true`** | Range summary on load, day detail on click | Nothing until a day is clicked, then day detail |
| **`breakdown: false`** | No panel at all | No panel at all |

Left unset, `breakdown` follows the aggregate — on for `state_time`, off for
everything else — so you only need to touch it to override that.

Pinning `tap_action` to something else (`more-info`, `none`) leaves the range
summary in place but stops clicks opening a day, since the click is doing your
thing instead. And `breakdown` needs `source: history`: statistics and
attribute data are numbers with the state text already dropped, so asking for
it there says so on the card rather than quietly showing nothing.

Notes worth knowing:

- **Colours are assigned by each state's total across the whole range**, not
  within the clicked day, so a state keeps its colour between the summary and
  any day, and two days can be compared at a glance. They're spaced around the hue
  circle rather than taken from the heatmap's ramp — those shades are ordered
  on purpose, and ordered colours would imply one game ranks above another
  rather than merely differing from it.
- **Sessions crossing midnight are split** at the local day boundary, so a
  session from 23:00 to 02:00 contributes an hour to one day and two to the
  next rather than landing whole on the day it started.
- `ignore_states` decides what doesn't count, defaulting to the
  `off` / `idle` / `standby` / `unavailable` / `unknown` family. Anything else
  the sensor reports is treated as activity.
- `state_colors` pins particular states, by exact state text, to a hex value or
  a palette name. It's YAML-only — a map of state to colour has no editor
  field:

  ```yaml
  state_colors:
    Elden Ring: purple
    Factorio: "#e8a33d"
  ```

- **The recorder is the limit.** This is a history feature — statistics keep
  numbers and throw the state text away — so the range you can break down is
  whatever `purge_keep_days` retains, 10 days by default. Raise it for the
  entities you care about, or accept a short window.

### Data you already keep

If you already maintain the history yourself — an automation appending today's
date to a list on each event is the common shape — read it straight off the
attribute and skip the recorder entirely:

```yaml
type: custom:activity-heatmap-card
entity: sensor.gym_log
attribute: visit_dates
unit: visits
```

Four shapes are accepted, so whatever your template already produces probably
works as-is:

```yaml
{"2026-08-01": 2, "2026-08-03": 1}      # a map of date -> value
["2026-08-01", "2026-08-01", ...]       # a list of dates; duplicates counted
[{date: "2026-08-01", value: 2}, ...]   # a list of records
[["2026-08-01", 2], ...]                # a list of pairs
```

## Chrome is Material 3; data is not

The card surface, board, tooltip, legend chrome, labels, controls and focus
rings are [M3 Expressive](../M3-EXPRESSIVE.md) tokens from `src/m3.css.ts`.
**The cell ramp and the categorical state colours are deliberately outside
that system**, in `palette.ts`, which builds them in OKLab with a
monotone-lightness schedule per theme. M3's tonal palette has no notion of an
ordered scale whose faintest step must clear an empty cell, and swapping it in
would be a regression.

One consequence is worth knowing before you touch the surfaces. The empty cell
is the reference every filled shade separates from, so **it has to sit past the
low end of the scale — and which direction that points flips with the theme**,
because the ramp does: `palette.ts` climbs in lightness in dark mode (the
faintest filled shade is the darkest) and descends in light mode (the faintest
is the lightest). `--ah-empty` is a wash toward `--m3-surface-container-lowest`,
which is near-black in dark and pure white in light, so it lands below the
scale in both without a per-theme override.

Writing that as a wash of `--m3-on-surface` instead — the obvious move — flips
it in dark mode, where `on-surface` is near-white. Measured, the faintest filled
shade went from 1.66:1 against the empty cell to **1.00:1**: identical
luminance, the floor of the scale gone. If you change the board or card
surfaces, re-measure the faintest filled shade against the empty cell in both
themes before believing it still works.

Current margins (faintest filled shade vs empty cell, worst palette): **1.57:1
dark, 1.47:1 light**. Light used to be the weak one at 1.13:1 against the old
surfaces, so the migration improved it — the empty cell now clears the ramp
instead of sitting just inside it.

## Configuration

Every option below is also in the visual editor, grouped into Data / Range /
Colour / Layout / Extras, with the source-specific fields hidden when they
don't apply.

```yaml
type: custom:activity-heatmap-card
title: Gym Consistency        # omit for a bare grid with no header at all

# --- data ---
entity: sensor.gym_visits_total
entities: []                  # extra entities, summed into the same day
source: auto                  # auto | statistics | history | attribute
stat: change                  # statistics: change | sum | state | mean | min | max
aggregate: on_count           # history: on_count | on_time | state_time | mean |
                              #          max | min | first | last | delta | count
attribute: visit_dates        # attribute source: which attribute holds the data
on_states: [on, home]         # what counts as "on" for on_count / on_time
ignore_states: [off, idle]    # what doesn't count for state_time / the breakdown
factor: 1                     # multiplies every value — 1/60 for minutes -> hours
unit: visits                  # defaults to the entity's unit; "1 visit" is
                              # singularised automatically
decimals: 0

# --- range ---
days: 365                     # 7-730
weeks: 52                     # whole weeks; wins over days
months: 12                    # whole calendar months; wins over both
end: today                    # today | yesterday
start_day_of_week: auto       # auto (follows HA) | monday | sunday | saturday
align_weeks: true             # false leaves the part-weeks at each end ragged

# --- colour ---
palette: github               # a name, or a list of colours faintest-first
color: "#4da3ff"              # one colour to build a ramp from, if no palette
empty_color: null             # override the unfilled-day colour
levels: 4                     # filled shades, 1-9
thresholds: [1, 2, 4, 8]      # explicit lower bounds; overrides min/max/scale
min: 0                        # at or below this, a day is drawn empty
max: null                     # null lets the busiest day set the top
scale: linear                 # linear | sqrt (lifts small values) | log

# --- layout ---
cell_size: null               # null fits the cells to the card width
min_cell_size: 5              # below this the grid scrolls instead of shrinking
cell_gap: null                # null scales the gap with the cell (~22%)
cell_radius: 2                # 2 is a square-ish tile; a large value is a dot
month_labels: true
weekday_labels: auto          # auto (every other row) | all | none
highlight_today: true
future: dim                   # dim | hide — the not-yet-happened trailing days

# --- extras ---
stats: [total, streak, longest]   # or true / false. Also: average, active,
                                  # rate, best
breakdown: null               # null follows the aggregate; true/false to pin it
breakdown_summary: true       # false keeps the panel shut until a day is clicked
breakdown_max: 8              # states listed before the rest become "Other"
state_colors: {}              # pin a state's colour, by exact state text
legend: true
legend_less: Less
legend_more: More
tooltip: true
tap_action: breakdown         # none | breakdown | more-info
refresh_interval: 300         # seconds
```

### Palettes

`github`, `emerald`, `teal`, `cyan`, `blue`, `indigo`, `purple`, `pink`, `red`,
`orange`, `amber`, `lime`, `mono`, plus three that walk through more than one
hue: `heat` (yellow → orange → red), `ocean` (green → blue → indigo) and
`aurora` (green → cyan → blue → violet).

Each is stored as a hue path, with lightness and chroma coming from a fixed
per-theme schedule rather than hand-picked hex values. That buys two things
worth having: every ramp is **monotone in lightness**, so it still reads as an
ordered scale in greyscale or to a colour-blind viewer rather than only by hue;
and the faintest shade is guaranteed to clear the empty cell's own luminance,
which half a table of hand-tuned hex values did not. It also means any level
count from 1 to 9 is sampled from the same curve, and that `color: "#2ea043"`
produces exactly the ramp `palette: github` does.

To use your own colours instead, give `palette` a list — faintest first. Hex
values are blended in OKLab to fit the level count; theme tokens and `rgb()`
strings can't be blended, so those are used verbatim and distributed by nearest
stop:

```yaml
palette: ["#1b2b34", "#4f7f8f", "#8fd0e0", "#e6f7ff"]
palette: ["var(--state-icon-color)", "var(--primary-color)"]
```

### Levels and thresholds

By default the scale stretches between the quietest active day and the busiest
one: the smallest value above `min` gets level 1, the largest gets the top
level, and the rest land in between. That is deliberate — spacing the bounds
evenly from zero instead puts a single-visit day on the *second* shade and
leaves the first one permanently unused.

One consequence worth knowing: `levels` above the number of distinct values in
your data leaves shades unused. Visit counts of 1–3 with `levels: 4` use
shades 1, 2 and 4. Set `levels: 3` for an exact mapping, or pin
`thresholds` if you want specific cut points.

`scale: sqrt` compresses the bounds toward the low end, so a range with a few
big spikes doesn't leave every ordinary day on the faintest shade. `scale: log`
does the same more aggressively.

## Interaction

- **Hover or tap** a day for a tooltip with the date and value. It flips below
  the cell when there isn't room above.
- **Click a day** to open the breakdown panel, when one is available.
- **Keyboard**: the grid is a single tab stop, not 371 of them. Arrow keys move
  a cursor (left/right by a week, up/down by a day) starting at the most recent
  day, `Enter` fires `tap_action`. `Escape` closes the breakdown panel first,
  then clears the cursor — one press per thing that's open.
- **A day with no recorded data** says so, rather than claiming zero.

## Refreshing

The card refetches when the watched entity changes, every `refresh_interval`
seconds, and when the date rolls over past midnight. The entity-change trigger
is deliberately source-dependent: an attribute series is already in `hass` and
costs nothing to re-read, raw history has the new row immediately, but
long-term statistics are only compiled on the recorder's own five-minute
cadence — chasing those on every state change would just spend a round-trip
proving nothing changed. The periodic refresh covers that case, which is why
`refresh_interval` defaults to 300 and there's little point going lower.

## How it fits the card's width

Cell and gap sizes are measured and computed, not left to CSS `1fr` tracks,
because the gap has to scale with the cell: a fixed 3px gap looks right at a
10px cell and wrong at both ends. The fit caps the cell at 22px (so `weeks: 8`
on a wide dashboard doesn't render inch-wide blocks — the leftover width goes
into the gap, then into centring the grid) and floors it at `min_cell_size`,
past which the grid scrolls horizontally with the newest week in view. When it
scrolls, the weekday labels are dropped rather than scrolled off-screen with
the oldest weeks; `weekday_labels: all` keeps them regardless.

## Development

```bash
npm install          # if it hangs, stop it and run: npm install -D @mdi/js
npm run dev          # harness at dev/index.html, port 5181
npm run build        # writes dist/activity-heatmap-card.js
npm run typecheck    # tsc --noEmit
```

`dev/mock-hass.ts` answers `recorder/statistics_during_period` and
`history/history_during_period` in the same wire shapes real HA uses, over a
generated year of plausible gym history — so the harness exercises the actual
parsing and aggregation in `src/data.ts` rather than a shortcut past it. Two
details there are faithful on purpose because the card depends on them:
statistics timestamps arrive as epoch milliseconds rather than ISO strings, and
a history response opens with whatever state was already in effect at
`start_time`, carrying its original timestamp — which is what makes "was it
already on?" distinguishable from "did it turn on just now".

The toolbar switches between six demo configs, cycles palettes / level counts
/ cell shapes, and can force a websocket failure, an empty response or a slow
one to check those states.

### What is and isn't verified

Checked by driving the harness with Playwright: the fit and overflow maths at
several card widths, the label-dropping decision, keyboard navigation, the
tooltip's flip-below, the editor's round-trip through `config-changed`, and all
four sources against the mock. The breakdown's durations are checked against
the fixture's own session list rather than against the card — every day/state
pair agrees to the minute, midnight-crossing sessions included — and state
colours are checked to be identical across six different days. The built
`dist/` bundle is smoke-tested separately from the dev server — loaded as a
module into a bare page the way HA loads a Lovelace resource, then checked for
element registration, the card-picker entry, rendering and the breakdown — 
because everything else here runs against `src/` via Vite and would not catch a
packaging or minification fault. Palette monotonicity and the faint-shade floor
are checked numerically across all 16 palettes × level counts 1–9 × both
themes.

Not verifiable locally, per the CONTRIBUTING.md: anything that depends on real HA's
sections-view grid, and the exact behaviour of the real `ha-form` selectors —
`dev/mock-ha-form.ts` speaks the same `.schema`/`.data`/`value-changed`
contract but is a plain stand-in, and multi-value selectors are comma-separated
text boxes there where real HA gives you a chip picker.

## Deploying

Copy `dist/activity-heatmap-card.js` into HA's `www/`, register it as a
Lovelace resource, and **bump the `?v=` query param** on the resource URL every
time you rebuild — otherwise the browser serves the stale cached copy.
