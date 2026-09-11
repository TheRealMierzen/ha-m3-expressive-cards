# Changelog

All notable changes to this repository are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each released version's section below is what the GitHub release notes are
built from, so an entry describes what changed for someone running the cards,
not what changed in the source.

## [Unreleased]

## [0.5.0] - 2026-09-11

### Fixed

- **Smart Irrigation Card: a zone no longer reads "Needs water" within an hour
  of being watered.** The card was taking that verdict from the integration's
  `binary_sensor.*_irrigation_needed`, which the integration computes as a
  bare `bucket < 0` — it ignores the zone's own allowed depletion
  (`irrigation_threshold`) entirely. With continuous updates on, the first
  calculation after a run puts the bucket a few tenths of a millimetre under
  zero, that sensor turns on, and it stays on for the whole dry-down, so the
  card sat in its alarm state almost permanently.

  The verdict now comes from the bucket measured against a **watering
  point**, and there is a new quiet state between "at capacity" and "needs
  water":

  - *Drying out* — a real deficit, still short of the watering point, with how
    far through the dry-down the zone is.
  - *Top-up due* — the same, except the integration has a run queued anyway,
    which it always will for a zone with no allowed depletion set. The run
    length is in the sub-line.

  Neither is filled or coloured as an alarm, and neither lights up the card.
  *Needs water* now means the deficit has actually reached the point where the
  zone wants a soak.

  The watering point is the zone's own `irrigation_threshold`, fetched from
  the integration over `smart_irrigation/zones` — it is in none of a zone's
  entities or their attributes. For the many zones whose threshold is the
  default zero, the card estimates one at a quarter of `maximum_bucket`, draws
  it as a dotted rather than a dashed line and labels it "Soak at (estimated)"
  in the details, so an estimate is never presented as something the
  integration promised. Set `watering_point` to overrule either.

- **Smart Irrigation Card: depths are no longer labelled "mm" on an imperial
  install.** The unit now comes from the zone, which reports inches when Home
  Assistant is set to imperial.

### Changed

- **Smart Irrigation Card: the bucket gauge is rebuilt around the dry-down.**
  The two bands used to share one scale, which handed nearly the whole vessel
  to banked rain: on a typical zone the entire dry-down got a fifth of the
  height, and the surplus band that took the rest is empty for most of a
  zone's life. The split is now fixed, each band is scaled to its own end, and
  both ends are labelled — so the deficit gets most of the vessel, and every
  zone's gauge is the same shape and can be read against the others as a
  fraction of its own dry-down.

  The watering point is drawn across the vessel as a marked line: the fill
  reaching it *is* the "Needs water" verdict. The band runs a quarter past it,
  so an overdue zone looks different from one that has just come due.

- **Smart Irrigation Card: three ET rows became two, and the misleading one
  was renamed.** The integration publishes `eto`, `et_deficiency` and
  `et_value`; the first two are the same number with opposite signs, and the
  third is not an evapotranspiration at all — it is the net depth the last
  calculation moved the bucket by, rain included, despite its entity being
  named "Applied ET". The details now show *Evapotranspiration* (per day) and
  *Net to bucket*.

  The per-zone details also gained the watering point and how far through it
  the zone is, and the bucket and its maximum are two rows rather than
  "−1.4 mm of 24.0 mm", which read as a fraction of a scale a deficit is not
  even on.

- **Smart Irrigation Card: `deficit_scale` is now `watering_point`.** It set
  how deep the gauge's sump was drawn; it now also sets where "Needs water"
  begins, which is a different enough job to deserve the honest name. Existing
  configurations keep working — the old key is still read, and the visual
  editor migrates it the next time the card is saved.

## [0.4.0] - 2026-09-10

### Changed

- **Smart Irrigation Card: the next run now comes from the integration
  itself, so there is nothing left to configure.** Smart Irrigation computes
  its next start on demand — from the start trigger you actually selected, its
  offset, sunrise or sunset, and any days-between-irrigation still to wait —
  and serves it over the same `smart_irrigation/info` websocket command that
  feeds **Info → Next irrigation → Next start** in its own panel. It never
  exposed an entity for it, which is why 0.3.0 asked you to point
  `next_schedule` at a schedule helper or a template sensor. The card now
  asks the integration directly and shows its answer, along with the total
  run length across every enabled zone.

  `next_schedule` is still there, and now means what it should: an override
  for when something other than the integration's triggers decides watering
  time. If you set it in 0.3.0 nothing changes — a configured entity still
  wins. Remove it and the card will use the integration's own figure.

  On an install whose integration doesn't serve the command, the next-run
  tile simply isn't drawn and "Last run" takes the full width. That is a
  fallback, not an error.

## [0.3.0] - 2026-09-10

### Added

- **Smart Irrigation Card** (`custom:m3-smart-irrigation-card`) — a card for
  the [Smart Irrigation](https://github.com/altmenorg/HAsmartirrigation)
  integration, built around its bucket model. Each zone gets a vessel with
  field capacity marked across it: banked rain fills upward as water, a
  soil-moisture deficit hangs downward into a hatched sump, and the verdict
  beside it says whether the zone needs water, how long the run would be and
  roughly how many litres that is. Next run and last run sit above the zones;
  everything else — ET figures, drainage, water used, weather-data trust, the
  multiplier, and the calculate/reset/irrigate actions — is behind a per-zone
  collapse.

  It needs no configuration: the card finds the integration's zones and
  service buttons itself, by the zone id the entities carry rather than by
  their names, so renaming an entity in HA doesn't hide it. The one field
  worth setting is `next_schedule`, because the integration doesn't schedule
  anything — an automation of yours does — so there is no next-run entity to
  find. Point it at a `schedule.*` helper, an `input_datetime`, or any
  timestamp sensor.

## [0.2.0] - 2026-09-03

### Changed

- **Breaking — every card's `type:` gained an `m3-` prefix**, so one search in
  **Add Card** turns up the whole set instead of nine names scattered through
  the picker. The card picker labels are prefixed to match (`M3 Geyser Status
  Card`, `M3 Activity Heatmap`, …).

  The old element names are no longer registered. A dashboard still using one
  shows *"Custom element doesn't exist"* until its `type:` line is updated:

  | Old | New |
  |---|---|
  | `custom:activity-heatmap-card` | `custom:m3-activity-heatmap-card` |
  | `custom:body-stats-card` | `custom:m3-body-stats-card` |
  | `custom:garage-auto-open-card` | `custom:m3-garage-auto-open-card` |
  | `custom:geyser-status-card` | `custom:m3-geyser-status-card` |
  | `custom:gym-tracker-card` | `custom:m3-gym-tracker-card` |
  | `custom:irrigation-schedule-card` | `custom:m3-irrigation-schedule-card` |
  | `custom:pc-overview-card` | `custom:m3-pc-overview-card` |
  | `custom:quick-toggles-card` | `custom:m3-quick-toggles-card` |
  | `custom:schedule-timeline-card` | `custom:m3-schedule-timeline-card` |

  Nothing else moved. Every config key keeps its name and value, the HACS
  resource URL is unchanged, and the release still ships the same
  `ha-m3-expressive-cards.js` plus the same per-card filenames — so editing the
  `type:` line is the whole migration, and a card's existing options survive it.

## [0.1.1] - 2026-09-03

### Fixed

- **Activity Heatmap: editing any field in the visual editor reset the card's
  layout.** The editor rebuilt the card config from scratch on every change and
  kept only the keys it knew about, discarding the ones Home Assistant stores
  alongside them — `grid_options` (full width and row count in sections view),
  `layout_options`, `view_layout` and `visibility`. Changing a single option
  silently dropped the card back to its default size. Hand-written YAML the
  editor has no field for, such as `state_colors`, was lost the same way and is
  now preserved too.

## [0.1.0] - 2026-09-03

### Added

- Initial release: nine Material 3 Expressive Lovelace cards — Activity
  Heatmap, Body Stats, Garage Auto Open, Geyser Status, Gym Tracker, Irrigation
  Schedule, PC Overview, Quick Toggles and Schedule Timeline. Lit + TypeScript,
  no runtime dependencies, one shared token and motion system across all nine.
- A combined `ha-m3-expressive-cards.js` bundle, so installing the repository
  through HACS registers a single resource and makes every card available with
  no per-card setup. Each card is also published as its own standalone file.
- A visual editor for every card, covering its common options.
- MIT license.

[Unreleased]: https://github.com/TheRealMierzen/ha-m3-expressive-cards/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/TheRealMierzen/ha-m3-expressive-cards/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/TheRealMierzen/ha-m3-expressive-cards/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/TheRealMierzen/ha-m3-expressive-cards/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/TheRealMierzen/ha-m3-expressive-cards/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/TheRealMierzen/ha-m3-expressive-cards/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/TheRealMierzen/ha-m3-expressive-cards/releases/tag/v0.1.0
