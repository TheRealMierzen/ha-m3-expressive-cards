# M3 Expressive Cards for Home Assistant

Nine custom Lovelace cards built on Google's
[Material 3 Expressive](M3-EXPRESSIVE.md) design language — one shared token
system, one motion vocabulary, so they read as a set rather than nine
unrelated cards. Lit + TypeScript, no runtime dependencies.

Installing this repository gives you all nine cards from a single resource.

## Installation

### HACS (recommended)

1. In HACS, open the ⋮ menu → **Custom repositories**.
2. Add this repository's URL with category **Dashboard**.
3. Install **M3 Expressive Cards**, then reload your browser.

HACS registers the combined `ha-m3-expressive-cards.js` resource for you — every card
below is immediately available in **Add Card**. No per-card setup.

### Manual

Download `ha-m3-expressive-cards.js` from the
[latest release](https://github.com/TheRealMierzen/ha-m3-expressive-cards/releases/latest), copy it into `<config>/www/`, then
add a dashboard resource (Settings → Dashboards → ⋮ → Resources) pointing at
`/local/ha-m3-expressive-cards.js`, type **JavaScript Module**.

Each card is also published as its own standalone file in the same release,
if you would rather load only the one you use.

## The cards

| Card | `type:` | What it does |
|---|---|---|
| **Activity Heatmap** | `custom:activity-heatmap-card` | GitHub-style contribution heatmap of any entity's daily history |
| **Body Stats** | `custom:body-stats-card` | Body-map visualization highlighting composition, sleep and heart stats by anatomical region |
| **Garage Auto Open** | `custom:garage-auto-open-card` | An auto-open automation's state plus left/right home/away presence |
| **Geyser Status** | `custom:geyser-status-card` | Water-heater power and temperature, heating schedule, shower-time override |
| **Gym Tracker** | `custom:gym-tracker-card` | Gym visit adherence and membership cost tracking |
| **Irrigation Schedule** | `custom:irrigation-schedule-card` | Scheduled irrigation with manual valve override |
| **PC Overview** | `custom:pc-overview-card` | A desktop's power, performance and system overview |
| **Quick Toggles** | `custom:quick-toggles-card` | A row of icon-only toggle medallions with condition-driven icons, colours and animations |
| **Schedule Timeline** | `custom:schedule-timeline-card` | Native `schedule.*` helpers drawn as a single timeline |

Every card has a visual editor (⋮ → **Edit Card**) covering its common
options, and a README in its own folder documenting the full config surface.

## Configuration

The cards are entity-agnostic: nothing is hardcoded to a particular Home
Assistant setup. Point each config key at whatever entity you have — the
example IDs in the docs are placeholders.

Add a card through the UI and the visual editor will walk you through the
required entities. For YAML, see the per-card README:

[activity-heatmap](activity-heatmap/README.md) ·
[garage-control](garage-control/README.md) ·
[geyser-control](geyser-control/README.md) ·
[irrigation-control](irrigation-control/README.md) ·
[pc-control](pc-control/README.md) ·
[quick-toggles](quick-toggles/README.md) ·
[schedule-timeline-card](schedule-timeline-card/README.md)

## Design

All nine cards share a single Material 3 Expressive token contract —
generated tonal palettes, spring-based motion, container-query layout.
[M3-EXPRESSIVE.md](M3-EXPRESSIVE.md) documents the token system, the
component recipes, and the pitfalls worth not rediscovering.

Cards respond to Home Assistant's own light/dark setting rather than the
browser's, and collapse their motion under `prefers-reduced-motion`.

## Developing

```bash
npm install     # at the repository root
npm run build   # every card + the combined bundle -> dist/
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the project layout, the
non-negotiables every card follows, and how to test without a running Home
Assistant instance.
