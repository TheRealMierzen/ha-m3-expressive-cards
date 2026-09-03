import { LitElement, TemplateResult, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { editorStyles } from "./editor.css";
import { HomeAssistant, PcOverviewCardConfig } from "./types";

type FormData = Record<string, unknown>;

interface Section {
  key: string;
  title: string;
  hint?: string;
  schema: unknown[];
  /** Which config keys this section's form writes. */
  fields: readonly string[];
  /** The subset holding entity ids, shown as a live readout under the form. */
  entityFields: readonly string[];
  /** Header line while the section is closed. */
  summary: (config: PcOverviewCardConfig) => string;
}

/** Mirrors DEFAULT_CONFIG in pc-overview-card.ts, so the form shows the value
 * the card actually uses and stores only a deliberate departure from it. */
const DEFAULTS: Record<string, unknown> = {
  uptime_unit: "days",
  core_freq_unit: "auto",
  smart_on_is_bad: true,
  show_idle_shutdown_when_network_busy: true,
  idle_shutdown_network_busy_threshold: 1048576,
  automation_sleep_schedule_time_after: 19,
  show_inhibit_pill_only_when_on: true,
};

/**
 * `show_webcam_section` is a tri-state — `"auto"`, or a boolean pinning it on
 * or off — and no ha-form selector speaks that shape, so the form offers
 * three named choices and translates on the way through.
 */
const FORM_READ: Record<string, (config: Record<string, unknown>) => unknown> = {
  show_webcam_section: (config) => {
    const raw = config.show_webcam_section;
    if (raw === true) return "always";
    if (raw === false) return "never";
    return "auto";
  },
};

const FORM_WRITE: Record<string, (raw: unknown, next: Record<string, unknown>) => void> = {
  show_webcam_section: (raw, next) => {
    if (raw === "always") next.show_webcam_section = true;
    else if (raw === "never") next.show_webcam_section = false;
    else delete next.show_webcam_section;
  },
};

const anyEntity = { entity: {} };
const button = { entity: { filter: { domain: "button" } } };
const automation = { entity: { filter: { domain: "automation" } } };

const TOP_FIELDS = ["title"] as const;
const TOP_SCHEMA = [{ name: "title", selector: { text: {} } }];

const LABELS: Record<string, string> = {
  title: "Title",

  tracker: "Presence tracker",
  power_state: "Power state",
  power_profile: "Power profile",
  latency: "Ping latency",

  switch_wol: "Wake-on-LAN switch",
  btn_reboot: "Reboot button",
  btn_suspend: "Suspend button",
  btn_hibernate: "Hibernate button",
  btn_poweroff: "Power off button",
  switch_inhibit: "Sleep-inhibit switch",
  show_inhibit_pill_only_when_on: "Hide the inhibit pill while it's off",

  cpu_total: "CPU usage",
  load_1m: "Load average (1m)",
  package_temp: "Package temperature",
  mem_usage_pct: "RAM usage",
  core0_freq: "Core 0 frequency",
  core_freq_unit: "Frequency reported in",

  disk_root_usage_pct: "/ usage",
  disk_home_usage_pct: "/home usage",
  disk_boot_usage_pct: "/boot/efi usage",
  nvme_read_rate: "NVMe read rate",
  nvme_write_rate: "NVMe write rate",
  smart_nvme: "SMART status, NVMe",
  smart_sda: "SMART status, sda",
  smart_on_is_bad: "“On” means a failing disk",

  lan_state: "LAN state",
  lan_ip: "LAN IP",
  rx_tp: "Download throughput",
  tx_tp: "Upload throughput",
  ext_ip: "External IP",
  show_external_ip: "Show the external IP",

  distro_name: "Distribution name",
  distro_version: "Distribution version",
  kernel: "Kernel version",
  last_reboot: "Last reboot",
  uptime: "Uptime",
  uptime_unit: "Uptime reported in",
  go_hass_agent_version: "Agent version",

  firmware_security: "Firmware security (HSI)",
  cpu_vulnerabilities: "CPU vulnerabilities",
  microphone_in_use: "Microphone in use",
  webcam_in_use: "Webcam in use",

  show_webcam_section: "Webcam section",
  sensor_webcam_status: "Webcam status",
  btn_webcam_start: "Start-webcam button",
  btn_webcam_stop: "Stop-webcam button",
  camera_webcam: "Camera entity",
  show_camera_preview: "Show the live preview",

  automation_sleep_schedule: "Sleep-schedule automation",
  automation_sleep_schedule_show_if: "Only show it while",
  automation_sleep_schedule_time_sensor: "Time-of-day sensor",
  automation_sleep_schedule_time_after: "…and only after",
  automation_idle_shutdown: "Idle-shutdown automation",
  automation_idle_shutdown_show_if: "Only show it while",
  show_idle_shutdown_when_network_busy: "Show it anyway while the network is busy",
  idle_shutdown_network_busy_threshold: "“Busy” starts at",
};

const HELPERS: Record<string, string> = {
  tracker:
    "Whether the machine is reachable. While it reads away, tapping the card's header is what offers to wake it.",
  power_state:
    "The card treats the exact state “powered on” as on — anything else is off. That's what the Go Hass Agent reports.",
  latency: "Shown next to the LAN state, rounded to whole milliseconds.",
  switch_wol:
    "Turning this on is the wake. The card then waits up to 90 seconds for the power state to catch up before giving up on it.",
  switch_inhibit: "A switch holding sleep off — a long copy, a backup, a download.",
  show_inhibit_pill_only_when_on:
    "On, the pill appears only while something is actually inhibiting sleep. Off, it's always there.",
  core_freq_unit:
    "Auto guesses from the magnitude of the number, which is right unless your sensor reports something unusual.",
  smart_nvme: "A pass/fail health flag, not the full SMART table.",
  smart_on_is_bad:
    "Which way round the flag reads. On means “on = failing”, which is how most SMART-status sensors are written; turn it off if yours reports “on = healthy”.",
  ext_ip: "Only read when the switch below is on, so a WAN-IP sensor isn't queried needlessly.",
  show_external_ip:
    "Off by default — an external IP on a dashboard is one screenshot away from being public.",
  uptime_unit: "Whichever unit your uptime sensor counts in. The card does the conversion for display.",
  last_reboot: "A timestamp entity — shown as a date, not a duration.",
  go_hass_agent_version: "The Go Hass Agent's own version sensor, shown in the version section.",
  firmware_security:
    "fwupd's Host Security ID. The card reads the HSI level out of the state and flags anything below HSI:1, or any state carrying a “!”.",
  cpu_vulnerabilities: "A summary sensor; its state is shown as-is next to the firmware badge.",
  show_webcam_section:
    "Auto shows the section only when the webcam status or camera says something is happening, which keeps it out of the way the rest of the time.",
  show_camera_preview:
    "Renders the camera entity's live view inside the card. Needs the camera entity above.",
  automation_sleep_schedule: "The card's switch enables and disables this automation.",
  automation_sleep_schedule_show_if:
    "An optional gate: the row appears only while this entity is on. Leave blank to always show it.",
  automation_sleep_schedule_time_sensor:
    "An optional second gate, for a row that's only interesting in the evening. Accepts a decimal hour or an “HH:MM” state.",
  automation_sleep_schedule_time_after:
    "The hour, as a 24-hour number, the time sensor has to have passed. Ignored when no time sensor is set.",
  automation_idle_shutdown_show_if:
    "An optional gate, same as the one above — except the network-busy override below can still force the row into view.",
  show_idle_shutdown_when_network_busy:
    "Shows the idle-shutdown row even when its gate says no, as long as traffic is above the threshold — the moment you most want to see that something might power the machine off mid-transfer.",
  idle_shutdown_network_busy_threshold:
    "Bytes per second on either direction. Defaults to 1048576, which is 1 MiB/s.",
};

function wiredSummary(config: PcOverviewCardConfig, fields: readonly string[]): string {
  const record = config as unknown as Record<string, unknown>;
  const set = fields.filter((f) => typeof record[f] === "string" && record[f] !== "").length;
  if (set === 0) return "nothing wired yet";
  if (set === fields.length) return `all ${fields.length} wired`;
  return `${set} of ${fields.length} wired`;
}

const PRESENCE_ENTITIES = ["tracker", "power_state", "power_profile", "latency"] as const;
const CONTROL_ENTITIES = [
  "switch_wol",
  "btn_reboot",
  "btn_suspend",
  "btn_hibernate",
  "btn_poweroff",
  "switch_inhibit",
] as const;
const CONTROL_FIELDS = [...CONTROL_ENTITIES, "show_inhibit_pill_only_when_on"] as const;
const SYSTEM_ENTITIES = [
  "cpu_total",
  "load_1m",
  "package_temp",
  "mem_usage_pct",
  "core0_freq",
] as const;
const SYSTEM_FIELDS = [...SYSTEM_ENTITIES, "core_freq_unit"] as const;
const STORAGE_ENTITIES = [
  "disk_root_usage_pct",
  "disk_home_usage_pct",
  "disk_boot_usage_pct",
  "nvme_read_rate",
  "nvme_write_rate",
  "smart_nvme",
  "smart_sda",
] as const;
const STORAGE_FIELDS = [...STORAGE_ENTITIES, "smart_on_is_bad"] as const;
const NETWORK_ENTITIES = ["lan_state", "lan_ip", "rx_tp", "tx_tp", "ext_ip"] as const;
const NETWORK_FIELDS = [...NETWORK_ENTITIES, "show_external_ip"] as const;
const VERSION_ENTITIES = [
  "distro_name",
  "distro_version",
  "kernel",
  "last_reboot",
  "uptime",
  "go_hass_agent_version",
] as const;
const VERSION_FIELDS = [...VERSION_ENTITIES, "uptime_unit"] as const;
const SECURITY_FIELDS = [
  "firmware_security",
  "cpu_vulnerabilities",
  "microphone_in_use",
  "webcam_in_use",
] as const;
const WEBCAM_ENTITIES = [
  "sensor_webcam_status",
  "btn_webcam_start",
  "btn_webcam_stop",
  "camera_webcam",
] as const;
const WEBCAM_FIELDS = ["show_webcam_section", ...WEBCAM_ENTITIES, "show_camera_preview"] as const;
const AUTOMATION_ENTITIES = [
  "automation_sleep_schedule",
  "automation_sleep_schedule_show_if",
  "automation_sleep_schedule_time_sensor",
  "automation_idle_shutdown",
  "automation_idle_shutdown_show_if",
] as const;
const AUTOMATION_FIELDS = [
  "automation_sleep_schedule",
  "automation_sleep_schedule_show_if",
  "automation_sleep_schedule_time_sensor",
  "automation_sleep_schedule_time_after",
  "automation_idle_shutdown",
  "automation_idle_shutdown_show_if",
  "show_idle_shutdown_when_network_busy",
  "idle_shutdown_network_busy_threshold",
] as const;

/**
 * Forty-odd fields, so the grouping does the real work: one section per band
 * of the card, closed until you want it, each reading its own entities back
 * live. The previous form covered twenty of these and sent you to the YAML
 * editor for the rest — including six fields it offered as free-text boxes
 * when the card reads them as entity ids.
 */
const SECTIONS: Section[] = [
  {
    key: "presence",
    title: "Presence & power state",
    hint: "What the card needs to decide whether the machine is up at all.",
    fields: PRESENCE_ENTITIES,
    entityFields: PRESENCE_ENTITIES,
    schema: PRESENCE_ENTITIES.map((name) => ({ name, selector: anyEntity })),
    summary: (config) => wiredSummary(config, PRESENCE_ENTITIES),
  },
  {
    key: "controls",
    title: "Power controls",
    hint: "Each button drawn only when it's wired, so a machine without hibernate simply doesn't offer it.",
    fields: CONTROL_FIELDS,
    entityFields: CONTROL_ENTITIES,
    schema: [
      { name: "switch_wol", selector: { entity: { filter: { domain: ["switch", "button"] } } } },
      { name: "btn_reboot", selector: button },
      { name: "btn_suspend", selector: button },
      { name: "btn_hibernate", selector: button },
      { name: "btn_poweroff", selector: button },
      { name: "switch_inhibit", selector: { entity: { filter: { domain: ["switch", "input_boolean"] } } } },
      { name: "show_inhibit_pill_only_when_on", selector: { boolean: {} } },
    ],
    summary: (config) => wiredSummary(config, CONTROL_ENTITIES),
  },
  {
    key: "system",
    title: "CPU & memory",
    fields: SYSTEM_FIELDS,
    entityFields: SYSTEM_ENTITIES,
    schema: [
      ...SYSTEM_ENTITIES.map((name) => ({ name, selector: anyEntity })),
      {
        name: "core_freq_unit",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "auto", label: "Auto-detect" },
              { value: "hz", label: "Hertz" },
              { value: "khz", label: "Kilohertz" },
            ],
          },
        },
      },
    ],
    summary: (config) => wiredSummary(config, SYSTEM_ENTITIES),
  },
  {
    key: "storage",
    title: "Storage",
    fields: STORAGE_FIELDS,
    entityFields: STORAGE_ENTITIES,
    schema: [
      ...STORAGE_ENTITIES.map((name) => ({ name, selector: anyEntity })),
      { name: "smart_on_is_bad", selector: { boolean: {} } },
    ],
    summary: (config) => wiredSummary(config, STORAGE_ENTITIES),
  },
  {
    key: "network",
    title: "Network",
    fields: NETWORK_FIELDS,
    entityFields: NETWORK_ENTITIES,
    schema: [
      ...NETWORK_ENTITIES.map((name) => ({ name, selector: anyEntity })),
      { name: "show_external_ip", selector: { boolean: {} } },
    ],
    summary: (config) => wiredSummary(config, NETWORK_ENTITIES),
  },
  {
    key: "version",
    title: "Version & uptime",
    hint: "All six are entities the card reads — not text you type. The old form got this wrong.",
    fields: VERSION_FIELDS,
    entityFields: VERSION_ENTITIES,
    schema: [
      ...VERSION_ENTITIES.map((name) => ({ name, selector: anyEntity })),
      {
        name: "uptime_unit",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "days", label: "Days" },
              { value: "hours", label: "Hours" },
            ],
          },
        },
      },
    ],
    summary: (config) => wiredSummary(config, VERSION_ENTITIES),
  },
  {
    key: "security",
    title: "Security & privacy",
    fields: SECURITY_FIELDS,
    entityFields: SECURITY_FIELDS,
    schema: SECURITY_FIELDS.map((name) => ({ name, selector: anyEntity })),
    summary: (config) => wiredSummary(config, SECURITY_FIELDS),
  },
  {
    key: "webcam",
    title: "Webcam",
    fields: WEBCAM_FIELDS,
    entityFields: WEBCAM_ENTITIES,
    schema: [
      {
        name: "show_webcam_section",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "auto", label: "Only when something's happening" },
              { value: "always", label: "Always" },
              { value: "never", label: "Never" },
            ],
          },
        },
      },
      { name: "sensor_webcam_status", selector: anyEntity },
      { name: "btn_webcam_start", selector: button },
      { name: "btn_webcam_stop", selector: button },
      { name: "camera_webcam", selector: { entity: { filter: { domain: "camera" } } } },
      { name: "show_camera_preview", selector: { boolean: {} } },
    ],
    summary: (config) => {
      const mode =
        config.show_webcam_section === true
          ? "always shown"
          : config.show_webcam_section === false
            ? "hidden"
            : "shown when active";
      return `${mode} · ${wiredSummary(config, WEBCAM_ENTITIES)}`;
    },
  },
  {
    key: "automations",
    title: "Sleep & idle automations",
    hint: "Two rows the card can toggle, each with optional gates deciding when the row is worth showing at all.",
    fields: AUTOMATION_FIELDS,
    entityFields: AUTOMATION_ENTITIES,
    schema: [
      { name: "automation_sleep_schedule", selector: automation },
      { name: "automation_sleep_schedule_show_if", selector: anyEntity },
      { name: "automation_sleep_schedule_time_sensor", selector: anyEntity },
      {
        name: "automation_sleep_schedule_time_after",
        selector: { number: { min: 0, max: 23, mode: "box", unit_of_measurement: "h" } },
      },
      { name: "automation_idle_shutdown", selector: automation },
      { name: "automation_idle_shutdown_show_if", selector: anyEntity },
      { name: "show_idle_shutdown_when_network_busy", selector: { boolean: {} } },
      {
        name: "idle_shutdown_network_busy_threshold",
        selector: { number: { min: 0, mode: "box", unit_of_measurement: "B/s" } },
      },
    ],
    summary: (config) => wiredSummary(config, AUTOMATION_ENTITIES),
  },
];

/* ------------------------------------------------------------------- shell */

@customElement("m3-pc-overview-card-editor")
export class PcOverviewCardEditor extends LitElement {
  static styles = editorStyles;

  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: PcOverviewCardConfig;
  /** Sections are independent rather than an accordion — wiring one usually
   * means checking it against another in the same pass. */
  @state() private _open: Record<string, boolean> = { presence: true };

  setConfig(config: PcOverviewCardConfig): void {
    this._config = config;
  }

  private _computeLabel = (schema: { name: string; title?: string }): string =>
    LABELS[schema.name] ?? schema.title ?? schema.name;

  private _computeHelper = (schema: { name: string }): string | undefined => HELPERS[schema.name];

  /** Shows the value the card actually uses, so a default the card applies
   * internally isn't presented as an empty field. */
  private _dataFor(fields: readonly string[]): FormData {
    const config = this._config as Record<string, unknown> | undefined;
    const data: FormData = {};
    if (!config) return data;
    for (const key of fields) {
      const read = FORM_READ[key];
      data[key] = read ? read(config) : (config[key] ?? DEFAULTS[key]);
    }
    return data;
  }

  /**
   * Only the keys the emitting form owns are reconciled, so one section can't
   * clobber another's, and keys this form doesn't cover survive untouched.
   *
   * Cleared fields are deleted rather than written back as `""` — emptying a
   * picker should remove it from the YAML, not leave an empty string behind.
   * A value that merely equals the card's own default is dropped too: pinning
   * it makes the YAML lie about being deliberate and freezes the card at
   * whatever the default happened to be the day the editor was opened.
   */
  private _valueChanged(fields: readonly string[], ev: CustomEvent<{ value: FormData }>): void {
    if (!this._config) return;
    ev.stopPropagation();
    const value = ev.detail.value ?? {};
    const next: Record<string, unknown> = { ...this._config };
    for (const key of fields) {
      const raw = value[key];
      const write = FORM_WRITE[key];
      if (write) {
        write(raw, next);
        continue;
      }
      const empty =
        raw === undefined ||
        raw === null ||
        raw === "" ||
        (Array.isArray(raw) && raw.length === 0) ||
        (typeof raw === "number" && !Number.isFinite(raw));
      if (empty || (key in DEFAULTS && raw === DEFAULTS[key])) delete next[key];
      else next[key] = raw;
    }
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: next as unknown as PcOverviewCardConfig },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _toggle(key: string): void {
    this._open = { ...this._open, [key]: !this._open[key] };
  }

  /** What each wired entity is reporting right now. Picking the right one out
   * of a list of near-identical entity ids is the actual work of these forms,
   * and its current value is the only proof you got it right. */
  private _renderReadout(fields: readonly string[]): TemplateResult | typeof nothing {
    const config = this._config as Record<string, unknown> | undefined;
    const hass = this.hass;
    if (!config || !hass) return nothing;
    const rows = fields
      .map((field) => ({ field, id: config[field] }))
      .filter((row): row is { field: string; id: string } => typeof row.id === "string" && row.id !== "");
    if (rows.length === 0) return nothing;
    return html`
      <div class="readout">
        <div class="readout-head">Reading now</div>
        ${rows.map(({ field, id }) => {
          const entity = hass.states[id];
          const missing = entity === undefined;
          // `unknown` is not a fault to flag: a button.* reads unknown until
          // its first press, and a fresh sensor until its first value. Only a
          // missing entity or an explicitly unavailable one is wrong.
          const unusable = missing || entity.state === "unavailable";
          const unit = entity?.attributes.unit_of_measurement as string | undefined;
          const text = missing ? "not found" : unit ? `${entity.state} ${unit}` : entity.state;
          return html`
            <div class="ro">
              <span class="ro-label">${LABELS[field] ?? field}</span>
              <span class=${unusable ? "chip bad" : "chip"} title=${id}>${text}</span>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _renderSection(section: Section): TemplateResult {
    const open = this._open[section.key] === true;
    return html`
      <div class=${open ? "row open" : "row"}>
        <button
          class="row-head"
          type="button"
          aria-expanded=${open ? "true" : "false"}
          @click=${() => this._toggle(section.key)}
        >
          <span class="row-text">
            <div class="row-title">${section.title}</div>
            <div class="row-sub">${section.summary(this._config!)}</div>
          </span>
          <span class="chev">
            <ha-icon icon=${open ? "mdi:chevron-up" : "mdi:chevron-down"}></ha-icon>
          </span>
        </button>
        ${open
          ? html`
              <div class="row-body">
                ${section.hint ? html`<div class="hint">${section.hint}</div>` : nothing}
                <ha-form
                  .hass=${this.hass}
                  .data=${this._dataFor(section.fields)}
                  .schema=${section.schema}
                  .computeLabel=${this._computeLabel}
                  .computeHelper=${this._computeHelper}
                  @value-changed=${(ev: CustomEvent<{ value: FormData }>) =>
                    this._valueChanged(section.fields, ev)}
                ></ha-form>
                ${this._renderReadout(section.entityFields)}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  protected render() {
    if (!this._config || !this.hass) {
      return nothing;
    }
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._dataFor(TOP_FIELDS)}
        .schema=${TOP_SCHEMA}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${(ev: CustomEvent<{ value: FormData }>) =>
          this._valueChanged(TOP_FIELDS, ev)}
      ></ha-form>
      <div class="sections">${SECTIONS.map((section) => this._renderSection(section))}</div>
      
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "m3-pc-overview-card-editor": PcOverviewCardEditor;
  }
}
