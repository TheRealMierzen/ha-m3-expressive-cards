# PC Overview Card

A custom Lovelace card showing a PC's power state, live perf metrics (CPU,
load, temp, RAM, disks, network), Wake-on-LAN, sleep/idle-shutdown
automation status, and system/version info — ported from the original
hand-written `pc-overview-card.js` to a Lit + TypeScript project
(same structure as `schedule-timeline-card/`).

The custom element tag was renamed from `pc-overview-card` to
`pc-overview-card`. Existing dashboard YAML must be updated to
`type: custom:m3-pc-overview-card`, and the dashboard resource entry's URL
must point at the new filename (see Installing into HA below).

## Developing

```bash
npm install
npm run dev
```

Opens a dev harness at `http://localhost:5175` with mock entities and
buttons to toggle power, randomize CPU/RAM/temp, and toggle inhibit/mic.

## Building for Home Assistant

```bash
npm run build
```

Produces `dist/pc-overview-card.js` (Lit bundled in, no other
runtime dependency).

### Installing into HA

1. Copy `dist/pc-overview-card.js` into `<config>/www/`.
2. Add a dashboard resource entry: Settings → Dashboards → ⋮ →
   Resources → add URL `/local/pc-overview-card.js?v=1`,
   type **JavaScript Module**.
3. Add the card to a dashboard with `type: custom:m3-pc-overview-card`.
4. Bump the resource URL's `?v=` on future rebuilds so the browser
   actually refetches the file instead of serving a cached copy.

## Configuration

See `src/types.ts` (`PcOverviewCardConfig`) for the full ~60-field config
surface. The visual editor (⋮ →
Edit Card) covers the ~20 most commonly used fields: `title`, `tracker`,
`power_state`, `switch_wol`, the four power buttons, `cpu_total`,
`load_1m`, `package_temp`, `mem_usage_pct`, the three disk usage sensors,
`lan_state`, `lan_ip`, `rx_tp`, `tx_tp`, and `power_profile`.

### Metric tiles

The grid under the header is the `tiles` list, in order. Leave it out and
you get the eight built-in tiles; an empty list hides the grid. Every tile —
built in or not — can be renamed, re-iconed, given a bar, thresholds, a
history graph or more width.

```yaml
tile_columns: 3            # at most; narrow cards still drop to fewer
tiles:
  - cpu                    # a built-in with its defaults
  - tile: ram              # a built-in with changes
    graph: true
  - entity: sensor.desktop_gpu_usage
    name: GPU
    icon: mdi:expansion-card
    bar: true              # 0–100 unless min/max say otherwise
    graph: true
    span: 2                # two columns wide
  - entity: sensor.desktop_gpu_temperature
    name: GPU temp
    warn_at: 70            # amber at or above
    bad_at: 85             # red at or above
  - tile: temp
    graph: true
    hours: 6               # the graph's window; 24 by default
  - tile: nvme
    graph: true            # read and write as two lines
```

| Option | Applies to | Default | |
| --- | --- | --- | --- |
| `tile` | built-ins | — | `cpu`, `load`, `temp`, `freq`, `ram`, `download`, `upload` or `nvme` |
| `entity` | entity tiles | — | any entity |
| `name`, `icon` | all | the tile's own, or the entity's | |
| `unit`, `decimals` | entity tiles | the entity's unit, auto rounding | sizes and rates are rescaled unless `decimals` is set |
| `bar` | all but `nvme` | on for `cpu`, `ram` and `%` entities | progress bar from `min` to `max` |
| `min`, `max` | all but `nvme` | 0–100 with a bar; fitted to the data without | also fixes the graph's scale |
| `warn_at`, `bad_at` | all but `nvme` | 60 / 80 for `temp` | value, bar and graph go green, amber, red |
| `graph` | all | off | recent history from the recorder; gaps where the entity was unavailable |
| `hours` | graphs | 24 | |
| `span` | all | 1 | columns wide, 1–4, capped on narrow cards |

An entity tile fills in whatever it isn't told from the entity itself: the
name from `friendly_name`, the unit from `unit_of_measurement`, the icon from
the entity's own `icon`, then its `device_class`, then its unit (`rpm` gets a
fan), and a bar when the unit is `%`. Sizes and rates in any of HA's units —
`kB/s`, `MiB`, `Mbit/s` — are rescaled to whatever reads best; set
`decimals` to print the number exactly as the sensor reports it instead.

Built-in tiles read the entities wired under their own config keys
(`cpu_total`, `load_1m`, …) and keep their own formatting; their numbers —
scale, thresholds — are in the sensor's units, not the displayed ones.
Graphs are fetched only once the card's body is opened, then follow live
state changes, and re-sync with the recorder every 30 minutes.

The visual editor's *Metric tiles* section covers all of it, including
putting back a built-in you removed.

Everything else — SMART disk health, firmware/CPU-vulnerability badges,
sleep/idle-shutdown automation gating, webcam section, mic-in-use badge,
external IP, unit overrides — has no row in the visual editor and needs
the card dialog's YAML/code-editor toggle. `switch_mute`, `number_volume`,
`sensor_media_state`, and `show_media_section` are accepted for
config back-compat but aren't rendered anywhere (inherited as dead config
surface from the original card, which never built the media section they
imply).

## Styling

Material 3 Expressive — see [M3-EXPRESSIVE.md](../M3-EXPRESSIVE.md) for the
system. Accents are generated from this card's original cyan (`#00cfff`);
surfaces come from the shared house neutral so the card sits on the same
plate as the other migrated cards. `--m3-success-*` and `--m3-warning-*` are
M3 custom colours, added because the card's health indicators are three- and
four-step scales and M3 ships only `error`.

Two colour decisions here were made by measurement rather than by eye, and
both are recorded in `src/card.css.ts` next to the rule they justify:

- **Power off is not in the button group.** Reboot, suspend and hibernate
  are recoverable and share one connected group; powering the machine off
  remotely is the one action you can't undo, so it sits outside with a gap.
  That separation had to do the work because colour couldn't: inside the
  group, `error-container` against `secondary-container` measured **1.00:1
  in both themes** (all container roles are the same tone), and filling it
  with `error` instead passed at 5.48:1 but made the button you least want
  to press the brightest thing on the card — M3's dark `error` is a pale
  pink, 9.69:1 against the card versus 12.76:1 for the title itself.
- The **status dot is gone.** It only ever encoded powered-on vs
  powered-off; the header's leading icon now carries that, changing both
  tone and corner radius so the state reads two ways rather than one.
- **System facts are a description list**, not bullet-separated prose.
  The prose wrapped badly at every card width: separators orphaned at line
  ends, and grouping each bullet with its fact pushed the bullet to the
  *start* of the next line, so the block read as a bullet list it wasn't.

## Project layout

```
src/
  pc-overview-card.ts        # the <m3-pc-overview-card> element
  pc-overview-card-editor.ts # visual editor (ha-form) for the common fields
  compute.ts                 # pure value computation + formatting helpers
  m3.css.ts                  # Material 3 Expressive tokens (colour/shape/motion/type)
  card.css.ts                # component styles, all built on those tokens
  types.ts
dev/
  index.html, main.ts, mock-hass.ts, fixtures.ts   # standalone dev harness
```
