export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    icon?: string;
    [key: string]: unknown;
  };
}

/** A minimal slice of Home Assistant's Hass type, just what this card reads. */
export interface HomeAssistant {
  states: Record<string, HassEntity>;
  themes?: { darkMode?: boolean };
  callService(domain: string, service: string, serviceData?: Record<string, unknown>): void;
  /** For tile graphs: history lives in the recorder, not in `states`. */
  callWS?<T = unknown>(message: Record<string, unknown>): Promise<T>;
}

/** The card's own metric tiles, each reading the entity its config key names
 * and formatting it the way that metric needs (GHz, bytes per second, …). */
export type PcBuiltinTile = "cpu" | "load" | "temp" | "freq" | "ram" | "download" | "upload" | "nvme";

/** What every tile can change about itself, built in or not. Numbers are in
 * the entity's own units — a frequency tile's thresholds are in whatever its
 * sensor reports, not in the GHz the tile displays. */
export interface PcTileOptions {
  name?: string;
  icon?: string;
  /** Draw a progress bar under the value, scaled from `min` to `max`. */
  bar?: boolean;
  min?: number;
  max?: number;
  /** Tints the value (and bar, and graph) amber at or above this reading. */
  warn_at?: number;
  /** Tints it red at or above this reading. */
  bad_at?: number;
  /** Draw the recent history as a line under the value. */
  graph?: boolean;
  /** How far back the graph reaches. */
  hours?: number;
  /** Grid columns the tile spans, 1–4. Narrow cards cap it. */
  span?: number;
}

/** A built-in tile with some of its options changed. */
export interface PcBuiltinTileConfig extends PcTileOptions {
  tile: PcBuiltinTile;
}

/** A tile for any entity the card has no dedicated key for. */
export interface PcEntityTileConfig extends PcTileOptions {
  entity: string;
  decimals?: number;
  /** Replaces the entity's own unit_of_measurement. */
  unit?: string;
}

/** A bare built-in name is that tile with its defaults. */
export type PcTileConfig = PcBuiltinTile | PcBuiltinTileConfig | PcEntityTileConfig;

export interface PcOverviewCardConfig {
  type: string;
  title?: string;

  /** The metric grid, in order. Absent means every built-in tile; an empty
   * list hides the grid. */
  tiles?: PcTileConfig[];
  /** Most columns the grid uses. Narrow cards still drop to fewer. */
  tile_columns?: number;

  tracker?: string;
  power_state?: string;
  power_profile?: string;
  latency?: string;

  distro_name?: string;
  distro_version?: string;
  kernel?: string;
  last_reboot?: string;
  uptime?: string;
  uptime_unit?: "days" | "hours";
  go_hass_agent_version?: string;

  cpu_total?: string;
  load_1m?: string;
  core0_freq?: string;
  core_freq_unit?: "auto" | "hz" | "khz";
  package_temp?: string;
  mem_usage_pct?: string;

  disk_root_usage_pct?: string;
  disk_home_usage_pct?: string;
  disk_boot_usage_pct?: string;

  nvme_read_rate?: string;
  nvme_write_rate?: string;

  lan_state?: string;
  lan_ip?: string;
  ext_ip?: string;
  show_external_ip?: boolean;
  rx_tp?: string;
  tx_tp?: string;

  smart_nvme?: string;
  smart_sda?: string;
  smart_on_is_bad?: boolean;

  firmware_security?: string;
  cpu_vulnerabilities?: string;
  microphone_in_use?: string;
  webcam_in_use?: string;

  switch_wol?: string;
  btn_reboot?: string;
  btn_suspend?: string;
  btn_hibernate?: string;
  btn_poweroff?: string;
  switch_inhibit?: string;
  /** Accepted for config back-compat; not currently rendered (no media UI section exists). */
  switch_mute?: string;
  /** Accepted for config back-compat; not currently rendered (no media UI section exists). */
  number_volume?: string;
  /** Accepted for config back-compat; not currently rendered (no media UI section exists). */
  sensor_media_state?: string;

  sensor_webcam_status?: string;
  btn_webcam_start?: string;
  btn_webcam_stop?: string;
  camera_webcam?: string;

  automation_sleep_schedule?: string;
  automation_idle_shutdown?: string;
  automation_sleep_schedule_show_if?: string;
  automation_idle_shutdown_show_if?: string;
  show_idle_shutdown_when_network_busy?: boolean;
  idle_shutdown_network_busy_threshold?: number;
  automation_sleep_schedule_time_sensor?: string;
  automation_sleep_schedule_time_after?: number;

  /** Accepted for config back-compat; not currently rendered (no media UI section exists). */
  show_media_section?: "auto" | boolean;
  show_webcam_section?: "auto" | boolean;
  show_camera_preview?: boolean;
  show_inhibit_pill_only_when_on?: boolean;
}

/** All entity-id-valued config keys, used for hass change-detection
 * (which entities does this card actually need to watch). */
export const ENTITY_KEYS: (keyof PcOverviewCardConfig)[] = [
  "tracker",
  "power_state",
  "power_profile",
  "latency",
  "distro_name",
  "distro_version",
  "kernel",
  "last_reboot",
  "uptime",
  "go_hass_agent_version",
  "cpu_total",
  "load_1m",
  "core0_freq",
  "package_temp",
  "mem_usage_pct",
  "disk_root_usage_pct",
  "disk_home_usage_pct",
  "disk_boot_usage_pct",
  "nvme_read_rate",
  "nvme_write_rate",
  "lan_state",
  "lan_ip",
  "ext_ip",
  "rx_tp",
  "tx_tp",
  "smart_nvme",
  "smart_sda",
  "firmware_security",
  "cpu_vulnerabilities",
  "microphone_in_use",
  "webcam_in_use",
  "switch_wol",
  "switch_inhibit",
  "sensor_webcam_status",
  "camera_webcam",
  "automation_sleep_schedule",
  "automation_idle_shutdown",
  "automation_sleep_schedule_show_if",
  "automation_idle_shutdown_show_if",
  "automation_sleep_schedule_time_sensor",
];
