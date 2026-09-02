import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { HomeAssistant, PcOverviewCardConfig } from "./types";

/** The ~20 most commonly used fields. The remaining niche config (SMART
 * disks, sleep/idle-shutdown automation gating, media/webcam plumbing,
 * per-field unit overrides, etc.) has no row here — edit those via the
 * card dialog's YAML/code-editor toggle. */
const EDITED_KEYS = [
  "title",
  "tracker",
  "power_state",
  "switch_wol",
  "btn_reboot",
  "btn_suspend",
  "btn_hibernate",
  "btn_poweroff",
  "cpu_total",
  "load_1m",
  "package_temp",
  "mem_usage_pct",
  "disk_root_usage_pct",
  "disk_home_usage_pct",
  "disk_boot_usage_pct",
  "lan_state",
  "lan_ip",
  "rx_tp",
  "tx_tp",
  "power_profile",
] as const;

type EditableKey = (typeof EDITED_KEYS)[number];
type EditableConfig = Pick<PcOverviewCardConfig, EditableKey>;

const ENTITY_FIELDS = new Set<EditableKey>([
  "tracker",
  "power_state",
  "switch_wol",
  "btn_reboot",
  "btn_suspend",
  "btn_hibernate",
  "btn_poweroff",
  "cpu_total",
  "load_1m",
  "package_temp",
  "mem_usage_pct",
  "disk_root_usage_pct",
  "disk_home_usage_pct",
  "disk_boot_usage_pct",
  "lan_state",
  "lan_ip",
  "rx_tp",
  "tx_tp",
  "power_profile",
]);

const SCHEMA = EDITED_KEYS.map((name) => ({
  name,
  selector: ENTITY_FIELDS.has(name) ? { entity: {} } : { text: {} },
}));

const LABELS: Record<EditableKey, string> = {
  title: "Title",
  tracker: "Presence tracker (click header when off)",
  power_state: "Power state sensor",
  switch_wol: "Wake-on-LAN switch",
  btn_reboot: "Reboot button",
  btn_suspend: "Suspend button",
  btn_hibernate: "Hibernate button",
  btn_poweroff: "Power off button",
  cpu_total: "CPU usage sensor",
  load_1m: "Load average (1m) sensor",
  package_temp: "Package temperature sensor",
  mem_usage_pct: "RAM usage sensor",
  disk_root_usage_pct: "/ usage sensor",
  disk_home_usage_pct: "/home usage sensor",
  disk_boot_usage_pct: "/boot/efi usage sensor",
  lan_state: "LAN state sensor",
  lan_ip: "LAN IP sensor",
  rx_tp: "Download throughput sensor",
  tx_tp: "Upload throughput sensor",
  power_profile: "Power profile sensor",
};

/**
 * Covers the ~20 most commonly used fields via HA's generic `ha-form`.
 * The remaining niche config has no row here — see EDITED_KEYS above.
 */
@customElement("pc-overview-card-editor")
export class PcOverviewCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: PcOverviewCardConfig;

  setConfig(config: PcOverviewCardConfig): void {
    this._config = config;
  }

  private get _data(): EditableConfig {
    const data = {} as EditableConfig;
    for (const key of EDITED_KEYS) {
      (data as Record<string, unknown>)[key] = this._config?.[key];
    }
    return data;
  }

  private _computeLabel = (schema: { name: string }): string => LABELS[schema.name as EditableKey] ?? schema.name;

  private _valueChanged(ev: CustomEvent<{ value: EditableConfig }>): void {
    if (!this._config) return;
    const newConfig: PcOverviewCardConfig = {
      ...this._config,
      ...ev.detail.value,
    };
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: newConfig },
        bubbles: true,
        composed: true,
      })
    );
  }

  protected render() {
    if (!this._config || !this.hass) {
      return nothing;
    }
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._data}
        .schema=${SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
      <p class="hint">
        Less common options (SMART disks, sleep/idle-shutdown automations, webcam, firmware/CPU vulnerability
        badges, unit overrides) aren't in this form — use the YAML/code-editor view for those.
      </p>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .hint {
      margin: 12px 2px 0;
      font-size: 12px;
      opacity: 0.7;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "pc-overview-card-editor": PcOverviewCardEditor;
  }
}
