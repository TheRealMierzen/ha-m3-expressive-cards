# Changelog

All notable changes to this repository are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each released version's section below is what the GitHub release notes are
built from, so an entry describes what changed for someone running the cards,
not what changed in the source.

## [Unreleased]

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

[Unreleased]: https://github.com/TheRealMierzen/ha-m3-expressive-cards/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/TheRealMierzen/ha-m3-expressive-cards/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/TheRealMierzen/ha-m3-expressive-cards/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/TheRealMierzen/ha-m3-expressive-cards/releases/tag/v0.1.0
