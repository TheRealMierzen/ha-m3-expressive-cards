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
}

export interface PcOverviewCardConfig {
  type: string;
  title?: string;

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
