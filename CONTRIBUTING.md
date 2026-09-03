# Contributing — conventions for these cards

Each subfolder (`garage-control`, `pc-control`, `irrigation-control`,
`geyser-control`, `schedule-timeline-card`, `quick-toggles`,
`activity-heatmap`, ...) is an independent custom
Lovelace card: Lit + TypeScript, bundled with Vite into a single-file
`dist/<name>.js` that gets copied into HA's `www/` and registered as a
dashboard resource.

This file exists so the next card follows the same conventions instead of
re-learning them the hard way.

**Visual language: [Material 3 Expressive](M3-EXPRESSIVE.md).** That file is
the source of truth for tokens, component recipes and design-system pitfalls;
this one stays the source of truth for structure. **Every card is migrated**
— the older `--pc-` custom-property scheme is gone from the repo. Start a new
card from whichever existing card is closest in shape; M3-EXPRESSIVE.md's
status table says what each one demonstrates.

## Standard project layout

The repository is an npm workspace: one `npm install` at the root installs
every card, and one `npm run build` produces the whole `dist/`. Each card
keeps its own `package.json` and Vite configs, so a card can still be built
and developed entirely on its own.

```
package.json              # workspaces + root build/typecheck
scripts/assemble-dist.mjs # collects every build into the top-level dist/
bundle/                   # the combined all-cards file HACS registers
hacs.json                 # HACS manifest
dist/                     # build output (gitignored; attached to releases)

<card>/
src/
  <name>-card.ts          # main LitElement, render() + service calls
  <name>-card-editor.ts   # the visual editor (see "Editors" below)
  editor.css.ts           # shared editor chrome, copied verbatim between cards
  compute.ts              # computeVals(hass, config, now) — pure, no side effects
  card.css.ts             # lit css`` template
  types.ts                # HomeAssistant/config interfaces
dev/
  index.html, main.ts, mock-hass.ts, mock-ha-icon.ts, mock-ha-form.ts, fixtures.ts
vite.config.dev.ts        # `npm run dev` — local harness, no HA needed
vite.config.build.ts      # `npm run build` — single-file dist bundle
```

Run `npm install` **at the repository root**, not inside a card folder —
the workspace resolves all nine cards in one pass (a per-card install used
to hang here; the workspace install does not).

From the root: `npm run build` builds every card plus the combined bundle
and assembles `dist/`; `npm run typecheck` checks all workspaces as one TS
program. Inside a card folder, `npm run dev` / `build` / `typecheck` still
work on that card alone.

Because `npm run typecheck` at the root compiles all nine cards together,
any `declare global` block must be **identical** across cards — nine
differing `Window.customCards` declarations is a compile error even though
each card is fine in isolation.

## Non-negotiables for every new card

- **`window.customCards.push({type, name, description})`** — without this
  the card works fine via YAML but never shows up in "Add Card" search.
- **`static getStubConfig()` / `static getConfigElement()`** for HA's visual
  editor integration.
- **No `getCardSize()` / `getGridOptions()`.** Any row-count estimate
  (static or computed) goes stale the moment the card's height depends on
  internal state (a collapsible section, an animation) — HA doesn't
  continuously re-read these. Omit both entirely and let the sections view
  auto-size to actual content.
- **Domain-agnostic service calls**: use `homeassistant.toggle` /
  `homeassistant.turn_on` / `turn_off` instead of hardcoding a domain like
  `switch` — the same code then works whether the entity is a `switch.*`
  or an `input_boolean.*`. Use `input_number.increment` / `decrement`
  rather than computing values in the card.
- **Global `box-sizing: border-box` reset** (`:host, :host *, :host
  *::before, :host *::after`) — without it, any element mixing a
  percentage size with its own padding renders wider than intended.
- **`--mdc-icon-size` alongside `width`/`height`** on every `ha-icon`
  sizing rule — real HA's `ha-icon` sizes the glyph it draws via that
  custom property; width/height alone can leave the drawn icon at its own
  default size, crowding whatever sits next to it.
- **Getting the size right doesn't get the position right.** Real HA's
  `ha-icon` also inherits whatever line-height surrounds it, which
  inflates its box asymmetrically and renders the glyph visibly
  off-center — most obvious once it's forced down into a small circular
  badge, where "off-center" reads as a gap on one side. A `transform:
  translateY(...)` nudge does **not** fix this — it's not a
  transform-shaped problem, and chasing the wrong mechanism wastes a
  round-trip (body-stats' history has one: an empirical pixel-measured
  nudge that still didn't hold up under a second screenshot). The actual
  fix, already proven in `pc-control`'s `.icon-badge ha-icon` and
  `garage-control`'s `.header-btn ha-icon`: add `display: flex;
  align-items: center; justify-content: center; margin: 0; padding: 0;
  line-height: 0;` (plus `min-width`/`min-height` matching the
  width/height) to the same rule. Both this and the sizing issue above
  are real-HA-only — the dev harness's mock `<ha-icon>` doesn't reproduce
  either one (no `--mdc-icon-size` support, no inherited line-height to
  begin with), so neither is verifiable locally. A mock that renders
  centered is not evidence it's centered in real HA.
- **`display: block` explicit on `ha-card`** — implicit in real HA, but an
  undefined custom element defaults to `display: inline` in the dev mock.
- **Theme via `hass.themes.darkMode`**, reflected as `data-theme` on the
  host and consumed with `:host([data-theme="light"])` — not
  `prefers-color-scheme`, since the OS theme and HA's own theme toggle can
  disagree.
- **Design tokens, not literals.** Each card carries `src/m3.css.ts`
  (`m3Tokens` + `m3Type`), and `card.css.ts` interpolates both at the top of
  its sheet. Below that line there are no literal colours, corner radii or
  durations — only `var(--m3-*)`. Colour roles are *generated* from a seed
  with `@material/material-color-utilities`, never hand-picked. See
  [M3-EXPRESSIVE.md](M3-EXPRESSIVE.md).
- **No backticks (or `${`) in comments inside `css` / `html` templates.**
  They're tagged template literals — a backtick in a `/* comment */` closes
  the template and produces a cascade of confusing `TS1005` errors in a file
  whose CSS reads as perfectly valid.
- **A card's reported size must equal its visual size.** `scrollWidth ===
  clientWidth` and `scrollHeight === clientHeight` on `ha-card`, sampled
  *while animations run*. Transforms contribute to scrollable overflow, so any
  decorative transformed layer needs its own clipping context (`overflow:
  hidden` + `contain: paint` on a real child element) — `inset: 0` on a
  pseudo-element does **not** prevent it, and neither does `overflow: hidden`
  on `ha-card` itself. Same family of bug as the `getCardSize()` footgun
  above.
- **Cards react to state; they don't quietly become automations.** If a card
  calls a service in response to observed state rather than a user action, it
  must act only on an observed *change* (never the first value seen), be
  idempotent (`turn_on`, not `toggle`), and be unable to feed back into its
  own trigger. It only runs while a dashboard is open and every tab runs it —
  anything that must hold unattended belongs in an HA automation.
- **`entitySignature()` in the `hass` setter** — build a string from the
  states of only the entities this card actually reads, and skip
  `requestUpdate()` if it hasn't changed, so the card doesn't re-render on
  every unrelated `hass` update elsewhere in HA.

## Editors

Copy from `quick-toggles` (bespoke, per-item rows with live previews) or from
any of the sectioned editors — `body-stats`, `geyser-control`, `pc-control`
and the rest share one shell, so any of them shows the shape.

The rules, all of which exist because a form broke one of them first:

- **Group into sections, and say what each one holds when it's closed.** A
  flat column of a dozen entity pickers is unreadable, and the label is not
  the place to fix that. Each section header carries a one-line summary —
  `6 of 8 wired`, `hold 600ms · home = home` — so the shut form still tells
  you where things stand.
- **Group by where the values come from, not by where they land.** Somebody
  filling in `body-stats` has a scale, a wearable and an eye test in front of
  them; they do not have "the torso".
- **Read the wired entities back.** Every section renders a `Reading now`
  strip showing what its entities currently report. Picking the right one out
  of `sensor.body_fat` / `sensor.body_fat_2` is the actual work of these
  forms, and its current value is the only proof you got it right.
- **`unavailable` and a missing entity are faults. `unknown` is not.** A
  `button.*` reads `unknown` until its first press. Flagging that red made
  four correctly wired buttons look broken.
- **Labels name the thing; helpers explain it.** `Visceral fat`, not
  `Visceral fat (belly badge, sub reason for torso)`.
- **Never write a cleared field back as `""`.** Delete the key, so emptying a
  picker removes it from the YAML.
- **Never write a value that only equals the card's own default.** It makes
  the YAML lie about being deliberate and freezes the card at whatever the
  default was the day the editor was opened. The form still *shows* the
  default, so the field isn't misleadingly blank.
- **Reconcile only the keys the emitting form owns.** One section must not
  clobber another's, and a key no form covers has to survive untouched — that
  is what keeps a YAML-only or back-compat option alive.
- **Cover the whole config, or say what you didn't.** "Use the YAML editor for
  the rest" is a bug report, not a design. Where a config shape has no
  `ha-form` selector — a value that is a string *or* a list, a tri-state, a
  list of objects — synthesise a field and translate it on the way through.
- **Sections expand by rendering, not by animating a `max-height`.** An
  `ha-form`'s height isn't known up front and a fixed max-height clips it.
  This is the one place the collapsible recipe below does *not* apply.

Wire the editor into the card's dev harness — `dev/mock-ha-form.ts`, a
`Show editor` toolbar button, and a live config dump. Both editors that were
already good were the only two with this; the seven that weren't, weren't.
The mock is not a visual proxy for real HA (its selectors are plain inputs),
but it exercises the whole data flow, and every rule above is checkable
against the config dump with a short Playwright probe.

## Collapsible sections

Established pattern (copy from `geyser-control`, which is also the M3
reference; `irrigation-control` has the same structure on the older scheme):
outer wrapper carries no spacing/border of its own (`overflow: hidden;
transition: max-height ...`), an inner element carries the padding/border.
Collapsing the outer to `max-height: 0` then truly renders nothing,
instead of leaving the inner's border/margin as a stray sliver.

Wire it with a `@query` ref per section, a `_synced*El` field to detect a
newly-mounted body vs. an ongoing toggle, a Lit `updated()` lifecycle hook
that snaps new bodies to their current state with no animation, and an
imperative `_animateExpand()` using `requestAnimationFrame` + `scrollHeight`
+ a `transitionend` listener. Respect `prefers-reduced-motion`.

## Responsive width: container queries, not `@media`

A dashboard column's width has no fixed relationship to the browser
viewport — a plain `@media (max-width: ...)` query never fires for a
narrow card sitting in an otherwise-wide window. Use `@container` instead.

Below ~300px, **stack rather than truncate**: a label and a fixed-width
control can't share a line, and squeezing the label still leaves the control
overflowing. Wrap the row and give the label `flex: 1 0 100%` so it reads in
full with the control beneath it.

**Put `container-type` on a shadow-DOM descendant (e.g. `ha-card`), never
on `:host`.** `:host` is the actual custom-element node HA's own
sections-view grid places and measures for auto-row sizing, and
`container-type` forces size/layout containment onto whatever element it's
set on. Setting it on `:host` broke HA's height/reflow detection for a
card in this family (it stopped correctly pushing later cards down when
expanded) — real content only in the shadow root, containment kept off the
element the outer grid depends on.

## Testing without real HA

`npm run dev` serves the harness at `dev/index.html` — dark-by-default,
theme toggle, `mock-hass.ts` + `fixtures.ts` simulate state and
`callService`. It catches most logic/layout bugs, but can't reproduce
some real-HA-only behavior (`--mdc-icon-size`, the actual sections-view
grid/reflow implementation) — flag those explicitly as unverified rather
than claiming certainty.

For anything worth measuring rather than eyeballing (animation actually
running, collapse states, overflow at a given width, computed styles over
time), install Playwright into the session scratchpad and drive the dev
harness with it — cheaper and more conclusive than guessing from a
screenshot. The probes worth writing, and the traps in writing them, are in
[M3-EXPRESSIVE.md](M3-EXPRESSIVE.md#verifying).

Two harness rules learned the hard way:

- **Derive dependent fixture values from a single source.** If the card
  compares two entities, the fixtures must actually agree — a harness whose
  "default" value didn't equal the entity it was supposed to match made a
  correct card look broken.
- **Fine detail needs magnification.** Screenshot with `deviceScaleFactor: 6`
  and a tight `clip` for things like mask seams or icon centring; a 1×
  screenshot will not show them. There is no ImageMagick or PIL here — compose
  comparison strips by rendering data-URI `<img>` tags via `page.setContent`.

## Deploying to HA

**Released builds** go out through HACS: tag `vX.Y.Z` (matching the root
`package.json` version — the release workflow fails the build if they
disagree), push the tag, and the workflow attaches every file in `dist/` to
the GitHub release. HACS installs them into `www/community/<repo>/` and
registers the combined bundle as a resource.

**Testing a local build against real HA** without cutting a release: copy
`dist/<name>.js` into HA's `www/`, register it as a Lovelace resource, and
**bump the `?v=` query param on the resource URL** every time the file is
rebuilt — HA/the browser will otherwise serve a stale cached copy, and more
than one "still broken" report in this project's history turned out to just
be this.

## Adding a card to the repository

Beyond scaffolding the card itself, three places need updating or the card
ships nowhere:

1. `package.json` — add the folder to `workspaces`.
2. `bundle/src/index.ts` — add the `import` so the combined file
   registers it.
3. `scripts/assemble-dist.mjs` — add the folder and its output filename to
   `OUTPUTS`, so a missing build fails the release instead of silently
   shipping eight cards.
