import { HassEntity } from "../src/types";

function entity(id: string, state: string, friendlyName: string): HassEntity {
  return { entity_id: id, state, attributes: { friendly_name: friendlyName } };
}

export function buildFixtureEntities(opts: {
  poweredOn: boolean;
  cpuPct: number;
  memPct: number;
  tempC: number;
  micInUse: boolean;
  inhibitOn: boolean;
  sleepAutoOn: boolean;
  idleAutoOn: boolean;
  webcamActive: boolean;
  smartBad: boolean;
}): HassEntity[] {
  return [
    entity("sensor.pc_power_state", opts.poweredOn ? "Powered On" : "Powered Off", "PC Power State"),
    entity("device_tracker.pc", opts.poweredOn ? "home" : "not_home", "PC Tracker"),
    entity("switch.pc_wol", "off", "PC Wake-on-LAN"),
    entity("button.pc_reboot", "unknown", "PC Reboot"),
    entity("button.pc_suspend", "unknown", "PC Suspend"),
    entity("button.pc_hibernate", "unknown", "PC Hibernate"),
    entity("button.pc_poweroff", "unknown", "PC Power Off"),
    entity("sensor.pc_cpu_total", String(opts.cpuPct), "PC CPU Total"),
    entity("sensor.pc_load_1m", "1.24", "PC Load 1m"),
    entity("sensor.pc_package_temp", String(opts.tempC), "PC Package Temp"),
    entity("sensor.pc_mem_usage_pct", String(opts.memPct), "PC RAM Usage"),
    entity("sensor.pc_disk_root_usage_pct", "42", "PC / Usage"),
    entity("sensor.pc_disk_home_usage_pct", "67", "PC /home Usage"),
    entity("sensor.pc_disk_boot_usage_pct", "12", "PC /boot/efi Usage"),
    entity("sensor.pc_lan_state", "Connected", "PC LAN State"),
    entity("sensor.pc_lan_ip", "192.168.1.42", "PC LAN IP"),
    entity("sensor.pc_rx_tp", "1048576", "PC Download Throughput"),
    entity("sensor.pc_tx_tp", "204800", "PC Upload Throughput"),
    entity("sensor.pc_power_profile", "Balanced", "PC Power Profile"),
    entity("sensor.pc_microphone_in_use", opts.micInUse ? "on" : "off", "PC Mic In Use"),
    entity("switch.pc_inhibit", opts.inhibitOn ? "on" : "off", "PC Inhibit"),

    // Automations. The sleep-schedule row is additionally gated on a
    // time-of-day sensor (default: only shown from 19:00), so the fixture
    // pins a late hour rather than "now" — otherwise the row silently
    // vanishes for most of the working day and looks like a card bug.
    entity("automation.pc_sleep_schedule", opts.sleepAutoOn ? "on" : "off", "PC Sleep Schedule"),
    entity("automation.pc_idle_shutdown", opts.idleAutoOn ? "on" : "off", "PC Idle Shutdown"),
    entity("sensor.pc_time_of_day", "21:30", "Time of day"),

    entity("sensor.pc_core0_freq", "4210000000", "PC Core 0 Frequency"),
    entity("sensor.pc_nvme_read_rate", "12582912", "PC NVMe Read Rate"),
    entity("sensor.pc_nvme_write_rate", "3145728", "PC NVMe Write Rate"),
    entity("sensor.pc_ext_ip", "203.0.113.42", "PC External IP"),
    entity("sensor.pc_distro_name", "Pop!_OS", "PC Distro"),
    entity("sensor.pc_distro_version", "22.04", "PC Distro Version"),
    entity("sensor.pc_kernel", "6.9.3-76060903-generic", "PC Kernel"),
    entity("sensor.pc_uptime", "4.77", "PC Uptime"),
    entity("sensor.pc_last_reboot", "2026-08-25T07:14:00+00:00", "PC Last Reboot"),
    entity("sensor.pc_agent_version", "10.1.0", "Go HASS Agent Version"),

    // Health badges. smart_* is "on means bad" by default
    // (smart_on_is_bad), which is why the bad case sets them on.
    entity("sensor.pc_firmware_security", opts.smartBad ? "HSI:0" : "HSI:3", "PC Firmware Security"),
    entity("binary_sensor.pc_cpu_vulnerabilities", opts.smartBad ? "on" : "off", "PC CPU Vulnerabilities"),
    entity("binary_sensor.pc_smart_nvme", opts.smartBad ? "on" : "off", "PC NVMe SMART"),
    entity("binary_sensor.pc_smart_sda", opts.smartBad ? "on" : "off", "PC SDA SMART"),
    entity("sensor.pc_webcam_in_use", opts.webcamActive ? "on" : "off", "PC Webcam In Use"),
    entity("sensor.pc_webcam_status", opts.webcamActive ? "Streaming" : "none", "PC Webcam Status"),
    entity("camera.pc_webcam", opts.webcamActive ? "recording" : "idle", "PC Webcam"),
    entity("button.pc_webcam_start", "unknown", "PC Webcam Start"),
    entity("button.pc_webcam_stop", "unknown", "PC Webcam Stop"),
  ];
}
