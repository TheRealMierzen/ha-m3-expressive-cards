# Schedule Timeline Card

A custom Lovelace card for Home Assistant that visualizes native
`schedule.*` helpers (Settings → Automations → Helpers → Schedule) as a
single 24-hour timeline, so you can see how blocks of time (sleep, gym, WFH
hours, ...) and short trigger-style helpers (roomba start, get ready, auto
PC on, ...) fit together across a day.

Features:
- Auto-discovers every `schedule.*` entity — no need to list them all.
- One lane per helper; long blocks render as bars, short blocks (below a
  configurable duration) render as compact marker dots so they don't get
  lost next to hour-long blocks.
- Correctly splits/handles blocks that cross midnight (e.g. a sleep
  schedule from 22:30 to 06:30).
- Filter chips to toggle lanes on/off at runtime (persisted per-browser).
- A day switcher (since a schedule helper's blocks can differ per weekday)
  with a "now" line when viewing today.
- Click any lane or block to open Home Assistant's built-in schedule editor
  for that entity — no custom edit UI to maintain.

## Developing

This is a standalone project — it's built and tested against a mocked
`hass` object in a browser, with no live HA instance required.

```bash
npm install
npm run dev
```

Opens a dev harness at `http://localhost:5173` with sample fixtures
(`dev/fixtures.ts`) covering the edge cases above: a midnight-crossing sleep
block, a weekday-only WFH block, an MWF-only gym block, and several short
trigger-style entities. The harness includes:
- A dark-mode toggle (the card reads `hass.themes.darkMode`, same as real HA).
- A log panel showing the `hass-more-info` events fired when you click a
  lane/block, since there's no real more-info dialog to open outside HA.
- A "reset filters" button to clear the persisted hidden-lanes state.

Edit files under `src/`; Vite hot-reloads the harness automatically.

## Building for Home Assistant

```bash
npm run build
```

Produces a single self-contained module: `dist/schedule-timeline-card.js`
(Lit is bundled in — no other runtime dependency).

### Installing into HA

1. Copy `dist/schedule-timeline-card.js` into your HA config's `www/`
   folder, e.g. `<config>/www/schedule-timeline-card.js`.
2. Settings → Dashboards → ⋮ → Resources → Add Resource:
   - URL: `/local/schedule-timeline-card.js`
   - Resource type: JavaScript Module
3. Add the card to a dashboard — search "Schedule Timeline Card" in the
   card picker, or add it via YAML:

```yaml
type: custom:schedule-timeline-card
title: Daily Schedule
```

Reload the dashboard (or do a full browser refresh) after updating the
file — HA aggressively caches Lovelace resources.

## Configuration

All fields are optional; with no config beyond `type`, every `schedule.*`
entity is shown.

The card's visual editor (⋮ → Edit Card) covers `title`, `short_block_minutes`,
`exclude_entities`, and `default_hidden`. The `entities` list (per-entity
color/icon/label overrides) has no row UI yet — edit that via the card
dialog's YAML/code-editor toggle.

| Key | Type | Default | Description |
|---|---|---|---|
| `title` | string | `"Schedule Timeline"` | Card header text |
| `exclude_entities` | list of entity IDs | `[]` | `schedule.*` entities to never show |
| `entities` | list of `{ entity, color?, label?, icon? }` | — | Explicit ordering / overrides. Any `schedule.*` entity not listed here is still auto-discovered and appended. |
| `short_block_minutes` | number | `10` | Blocks shorter than this render as a marker dot instead of a bar |
| `default_hidden` | list of entity IDs | `[]` | Lanes hidden on first load (before any manual toggling) |

Example with overrides:

```yaml
type: custom:schedule-timeline-card
title: Daily Schedule
short_block_minutes: 15
exclude_entities:
  - schedule.holiday_mode
entities:
  - entity: schedule.sleep
    color: "#4a3aa7"
  - entity: schedule.gym
    icon: mdi:dumbbell
default_hidden:
  - schedule.evening_wind_down
```

## Styling

Material 3 Expressive — see [M3-EXPRESSIVE.md](../M3-EXPRESSIVE.md) for the
system. Surfaces and accents both come from the shared house neutral seed, so
the card sits on the same plate as the other migrated cards. This replaced a
chrome built on HA's own theme variables, which made the card match whatever
HA theme was active rather than its neighbours in this repo — and whose
standalone fallbacks were light-only, so the dev harness had to define HA
variables to test dark mode at all.

**The lane colours are deliberately not M3.** They stay in `palette.ts`: a
categorical set, hand-validated for adjacent-pair colourblind safety, which
M3's single-hue tonal palette cannot express. Chrome is M3; the values being
visualised are not.

Because the blocks sit on the lane track, moving that track moves every
contrast margin the palette was built to hold. It was measured before and
after: `surface-container-high` was chosen precisely because it held all
sixteen (dark identical to the old value, light a touch better), where
`surface-container-highest` would have cost the worst dark pair 2.90 → 2.48.
Three of the eight colours sit under 3:1 against the track in light theme —
that predates the migration and is by design, since the blocks are large
filled shapes carrying their own contrast-checked label and the palette was
validated for lane-versus-lane distinction.

## Project layout

```
src/
  schedule-timeline-card.ts        # the <schedule-timeline-card> element
  schedule-timeline-card-editor.ts # visual editor (ha-form) for the basic config fields
  timeline-renderer.ts             # pure layout math: entities + weekday -> positioned blocks
  time-utils.ts               # HH:MM:SS parsing, midnight-crossing handling
  resolve-entities.ts         # auto-discovery + config overrides + color assignment
  palette.ts                 # fixed-order categorical colors for lanes (NOT M3)
  m3.css.ts                   # Material 3 Expressive tokens (colour/shape/motion/type)
  card.css.ts                 # component styles, all built on those tokens
  types.ts
dev/
  index.html, main.ts, mock-hass.ts, fixtures.ts   # standalone dev harness
```
