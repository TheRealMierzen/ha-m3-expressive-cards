# Home Assistant custom cards

Monorepo of independent Lovelace cards (`garage-control`, `pc-control`,
`irrigation-control`, `geyser-control`, `schedule-timeline-card`,
`quick-toggles`, `activity-heatmap`, …), each Lit + TypeScript, bundled with
Vite into `dist/<name>.js`.

**Read [CONTRIBUTING.md](CONTRIBUTING.md) first** — it is the source of truth for layout,
non-negotiables, collapsibles, container queries, testing, and deploy. Do not
duplicate or drift from it here; link back when unsure.

**Styling is Material 3 Expressive — read [M3-EXPRESSIVE.md](M3-EXPRESSIVE.md)
before touching any card's CSS.** It holds the token contract, the palette and
spring generators, component recipes, and a pitfall list that exists
specifically so these don't get rediscovered. Every card is migrated; the
older `--pc-` scheme is gone. Its status table says which card to copy from
for a given problem shape.

## Commands

This is an npm workspace. Install and full builds run **at the root**:

```bash
npm install          # once, at the root — installs every card
npm run build        # all cards + combined bundle -> dist/
npm run typecheck    # all workspaces as one TS program
```

Per-card work runs inside the card folder (e.g. `geyser-control/`):

```bash
npm run dev          # local harness at dev/index.html
npm run build        # writes <card>/dist/<name>.js
npm run typecheck    # tsc --noEmit
```

Root `typecheck` compiles all nine cards together, so `declare global`
blocks must be identical across cards — see CONTRIBUTING.md.

## Reference cards

- **Material 3 Expressive** — `geyser-control` (`src/m3.css.ts` tokens,
  `src/card.css.ts` components). The only migrated card; copy from it.
- **Collapsible sections** — copy from `geyser-control` or `irrigation-control`
- **Visual editors** — `quick-toggles` (bespoke rows with live previews) or any
  sectioned editor, e.g. `body-stats` / `pc-control`; conventions and the
  reasons behind them are in CONTRIBUTING.md's "Editors" section
- **New card scaffold** — mirror an existing card's folder layout and Vite
  configs, and start from `geyser-control`'s `m3.css.ts`
- **Recorder/statistics history over `hass.callWS`** — see `activity-heatmap`
  (`src/data.ts`), including why `counter.*` has no long-term statistics
