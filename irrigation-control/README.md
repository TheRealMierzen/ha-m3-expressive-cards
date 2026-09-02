# Irrigation Schedule Card

A custom Lovelace card for an AI-scheduled irrigation setup: an automation
decides whether to water today and sets a start time, stop time, and
duration; a `timer.*` entity counts down once that start time arrives; and
a `switch.*` valve can also be controlled manually. Same Lit + TypeScript
project structure and visual language as `garage-control/`/`pc-control/`.

**The one rule this card enforces**: the valve is never toggled from this
card without also starting or cancelling its paired timer — manual
on always starts the timer (using the current duration helper's value),
manual off always cancels it.

## Developing

```bash
npm install
npm run dev
```

Opens a dev harness at `http://localhost:5176` with mock entities and
buttons to toggle AI scheduling, should-water, the valve (both via the
card's own control and simulating an external/physical toggle), pause the
timer, and switch dark/light mode.

## Building for Home Assistant

```bash
npm run build
```

Produces `dist/irrigation-schedule-card.js` (Lit bundled in, no other
runtime dependency).

### Installing into HA

1. Copy `dist/irrigation-schedule-card.js` into `<config>/www/`.
2. Settings → Dashboards → ⋮ → Resources → Add Resource, URL
   `/local/irrigation-schedule-card.js`, type **JavaScript Module**.
3. Add the card via the picker (search "Irrigation Schedule Card") or
   YAML: `type: custom:irrigation-schedule-card`.
4. Bump the resource URL's `?v=` on future rebuilds so the browser
   actually refetches the file instead of serving a cached copy.

## Configuration

| Key | Type | Description |
|---|---|---|
| `title` | string | Card header text (default `"Irrigation"`) |
| `automation` | entity id | The AI scheduling automation — header dot/toggle reflects and controls this |
| `should_water` | entity id | input_boolean (or similar) the automation sets to decide whether to water today |
| `start_time` | entity id | input_datetime (time-only) — scheduled start |
| `stop_time` | entity id | input_datetime (time-only) — scheduled stop |
| `duration` | entity id | input_number — run duration in minutes, also used for the timer when manually toggling the valve on |
| `timer` | entity id | timer.\* entity — counts down once the scheduled start time arrives; drives the progress bar |
| `valve` | entity id | switch.\* entity — the actual irrigation valve |

All fields are optional; each section (schedule chips, timer status, valve
control) only renders if its relevant entities are configured. The
schedule chips additionally only show when `should_water` is currently
`on` — no point displaying today's start/stop/duration when it's not
going to run.

The visual editor (⋮ → Edit Card) covers every field above.

## Styling

Material 3 Expressive — see [M3-EXPRESSIVE.md](../M3-EXPRESSIVE.md) for the
system. Accents are generated from this card's original cyan (`#00cfff`, the
same seed `pc-control` uses); surfaces come from the shared house neutral so
the card sits on the same plate as every other migrated card. The surfaces
are deliberately *not* seeded from the cyan — `geyser-control` tints its
surfaces because "hot" is that card's whole identity, but a blue-tinted plate
under a blue accent just reads as a blue card.

Three things worth knowing:

- **The timer bar is the wavy M3 Expressive indicator, and it earns it.**
  Most bars in this repo are flat, because an animated wave implies work in
  progress and CPU load or disk usage are standing readings. Here the bar
  shows a timer that really is counting down, so it waves — and flattens to
  the plain linear indicator the moment the timer is paused.
- **It drains rather than fills.** `timerProgressPercent` is remaining/total,
  so the bar starts full and empties. That's the original card's choice and
  the conventional reading of a countdown.
- **The status dot is gone.** It encoded whether the scheduling automation
  was enabled; that's now a switch in the header — a control rather than a
  read-out — which frees the leading icon to carry the state that actually
  matters at a glance, the valve being open. The valve's hand-rolled toggle
  and the header switch are now the same M3 switch from one helper.

## Behavior notes

- **Countdown**: only ticks (a 1s interval) while the timer is actually
  `active` — idle/paused cards have no running interval.
- **"Last watered"**: the valve entity's `last_changed` timestamp, not a
  dedicated history query — simple proxy, matches what was asked for.
- **Schedule section**: collapsed by default: click the "Schedule" row to
  expand, matching garage-control's animated collapse (an outer wrapper
  with no spacing of its own, animated via max-height, with a separate
  inner element carrying the padding — so a collapsed section truly
  renders nothing rather than leaving a stray border/gap).
- **No `getCardSize()`/`getGridOptions()`**: deliberately omitted — see
  the equivalent notes in garage-control's README/history. This card's
  rendered height changes with internal toggle state (`_scheduleOpen`),
  which HA has no visibility into, so a static or state-derived row
  estimate would either leave a gap or lag behind the animation. Omitting
  it lets HA's sections view auto-size the grid cell to actual content.

## Project layout

```
src/
  irrigation-schedule-card.ts        # the <irrigation-schedule-card> element
  irrigation-schedule-card-editor.ts # visual editor (ha-form) for all fields
  compute.ts                         # pure value computation: schedule text, timer countdown, valve state
  m3.css.ts                          # Material 3 Expressive tokens (colour/shape/motion/type)
  card.css.ts                        # component styles, all built on those tokens
  types.ts
dev/
  index.html, main.ts, mock-hass.ts, fixtures.ts, mock-ha-icon.ts   # standalone dev harness
```
