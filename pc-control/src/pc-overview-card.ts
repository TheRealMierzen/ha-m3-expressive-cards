import { LitElement, html, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import "./pc-overview-card-editor";
import { cardStyles } from "./card.css";
import { ComputedPcVals, clamp, computeVals } from "./compute";
import { ENTITY_KEYS, HomeAssistant, PcOverviewCardConfig } from "./types";

const WOL_TIMEOUT_MS = 90_000;

const DEFAULT_CONFIG: Partial<PcOverviewCardConfig> = {
  title: "Desktop PC",
  uptime_unit: "days",
  core_freq_unit: "auto",
  smart_on_is_bad: true,
  show_idle_shutdown_when_network_busy: true,
  idle_shutdown_network_busy_threshold: 1048576,
  automation_sleep_schedule_time_after: 19,
  show_webcam_section: "auto",
  show_inhibit_pill_only_when_on: true,
};

/** Only re-renders when one of the entities this card actually reads
 * changes, not on every unrelated hass update elsewhere in the system. */
function entitySignature(hass: HomeAssistant, config: PcOverviewCardConfig): string {
  return ENTITY_KEYS.map((key) => {
    const id = config[key];
    if (typeof id !== "string" || id === "") return "";
    const e = hass.states[id];
    return e ? `${id}:${e.state}` : `${id}:_`;
  }).join("|");
}

@customElement("pc-overview-card")
export class PcOverviewCard extends LitElement {
  static styles = cardStyles;

  private _hass?: HomeAssistant;
  private _lastSignature = "";
  private _wolTimer?: ReturnType<typeof setTimeout>;

  @state() private _config!: PcOverviewCardConfig;
  @state() private _mainOpen = false;
  @state() private _drivesOpen = false;
  @state() private _versionOpen = false;
  @state() private _wolWaiting = false;

  @query('[data-ref="card-body"]') private _cardBodyEl?: HTMLElement;
  @query(".drives-body") private _drivesBodyEl?: HTMLElement;
  @query(".version-body") private _versionBodyEl?: HTMLElement;

  private _syncedCardBodyEl?: HTMLElement;
  private _syncedDrivesBodyEl?: HTMLElement;
  private _syncedVersionBodyEl?: HTMLElement;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    // Reflects HA's actual theme setting, not the OS-level
    // prefers-color-scheme media feature — those two can disagree (HA dark
    // theme + light OS, or vice versa), and the card should follow HA.
    this.setAttribute("data-theme", hass.themes?.darkMode ? "dark" : "light");
    if (!this._config) return;
    const signature = entitySignature(hass, this._config);
    if (signature === this._lastSignature) return;
    this._lastSignature = signature;

    const powerState = this._config.power_state ? hass.states[this._config.power_state]?.state : undefined;
    const isOn = (powerState || "").toLowerCase() === "powered on";
    if (isOn && (this._wolWaiting || this._wolTimer)) {
      this._wolWaiting = false;
      if (this._wolTimer) {
        clearTimeout(this._wolTimer);
        this._wolTimer = undefined;
      }
    }

    this.requestUpdate();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  setConfig(config: PcOverviewCardConfig): void {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._mainOpen = false;
    this._drivesOpen = false;
    this._versionOpen = false;
    this._wolWaiting = false;
    if (this._wolTimer) {
      clearTimeout(this._wolTimer);
      this._wolTimer = undefined;
    }
    this._lastSignature = "";
    this._syncedCardBodyEl = undefined;
    this._syncedDrivesBodyEl = undefined;
    this._syncedVersionBodyEl = undefined;
  }

  static getStubConfig(): PcOverviewCardConfig {
    return { type: "custom:pc-overview-card", title: "PC" };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement("pc-overview-card-editor");
  }

  // No getCardSize()/getGridOptions() override: the card's rendered
  // height changes with _mainOpen/_drivesOpen/_versionOpen (internal
  // toggles HA has no visibility into), so any static or state-derived
  // row estimate either leaves a gap (oversized) or lags behind the
  // expand/collapse animation (HA only re-reads these at intermittent
  // triggers, not continuously) — omitting them lets HA's sections view
  // auto-size the grid cell to actual content instead, matching the
  // original card's behavior. Trade-off: this also removes the ability
  // to manually drag-resize the card taller in the sections layout editor.

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._wolTimer) {
      clearTimeout(this._wolTimer);
      this._wolTimer = undefined;
    }
  }

  protected updated(): void {
    // Collapsible bodies whose DOM node we haven't synced yet — either just
    // mounted (structural rebuild, e.g. the PC just turned on) or reset via
    // setConfig — need their max-height snapped to the current open/closed
    // state with no animation. Ongoing toggles animate via _animateExpand
    // directly and must not be touched here, so this only acts once per
    // element identity.
    const cardBody = this._cardBodyEl;
    if (cardBody && cardBody !== this._syncedCardBodyEl) {
      this._syncedCardBodyEl = cardBody;
      cardBody.style.maxHeight = this._mainOpen ? "none" : "0";
    }
    const drivesBody = this._drivesBodyEl;
    if (drivesBody && drivesBody !== this._syncedDrivesBodyEl) {
      this._syncedDrivesBodyEl = drivesBody;
      drivesBody.style.maxHeight = this._drivesOpen ? "none" : "0";
    }
    const versionBody = this._versionBodyEl;
    if (versionBody && versionBody !== this._syncedVersionBodyEl) {
      this._syncedVersionBodyEl = versionBody;
      versionBody.style.maxHeight = this._versionOpen ? "none" : "0";
    }
  }

  /** Teardown for the expand/collapse currently running on a body element,
      so a new toggle can cancel it instead of racing it. */
  private _expandCleanups = new WeakMap<HTMLElement, () => void>();

  private _prefersReducedMotion(): boolean {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  private _animateExpand(el: HTMLElement, open: boolean): void {
    // Spammed toggles: tear down the previous run first. Its transitionend
    // listener would otherwise still be armed and fire at the end of *this*
    // animation, snapping max-height back to the superseded target — the
    // section visibly jumping to whatever the first click was heading for.
    this._expandCleanups.get(el)?.();

    if (this._prefersReducedMotion()) {
      el.style.maxHeight = open ? "none" : "0";
      return;
    }

    // Animate from the height that is on screen right now — mid-flight that
    // is somewhere between 0 and the content height, not either endpoint —
    // so an interrupted section continues from where it is instead of
    // snapping to 0 (or to full height) before moving.
    const from = el.offsetHeight;
    const to = open ? el.scrollHeight : 0;
    if (from === to) {
      el.style.maxHeight = open ? "none" : "0";
      return;
    }
    el.style.maxHeight = `${from}px`;
    void el.offsetHeight; // flush the start value so the change below transitions

    const cleanup = (): void => {
      el.removeEventListener("transitionend", onDone);
      el.removeEventListener("transitioncancel", onDone);
      this._expandCleanups.delete(el);
    };
    const onDone = (e: TransitionEvent): void => {
      if (e.target !== el || e.propertyName !== "max-height") return;
      const settled = e.type === "transitionend";
      cleanup();
      // Only a run that reached its end releases the clamp, so an open
      // section can grow with its content afterwards.
      if (open && settled) el.style.maxHeight = "none";
    };
    el.addEventListener("transitionend", onDone);
    el.addEventListener("transitioncancel", onDone);
    this._expandCleanups.set(el, cleanup);
    el.style.maxHeight = `${to}px`;
  }

  private _toggleMain(): void {
    this._mainOpen = !this._mainOpen;
    void this.updateComplete.then(() => {
      if (this._cardBodyEl) this._animateExpand(this._cardBodyEl, this._mainOpen);
    });
  }

  private _toggleDrives(): void {
    this._drivesOpen = !this._drivesOpen;
    void this.updateComplete.then(() => {
      if (this._drivesBodyEl) this._animateExpand(this._drivesBodyEl, this._drivesOpen);
    });
  }

  private _toggleVersion(): void {
    this._versionOpen = !this._versionOpen;
    void this.updateComplete.then(() => {
      if (this._versionBodyEl) this._animateExpand(this._versionBodyEl, this._versionOpen);
    });
  }

  private _toggleKeydown(e: KeyboardEvent, toggle: () => void): void {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    toggle();
  }

  private _svc(domain: string, service: string, data?: Record<string, unknown>): void {
    this._hass?.callService(domain, service, data ?? {});
  }

  private _press(id?: string): void {
    if (id) this._svc("button", "press", { entity_id: id });
  }

  private _moreInfo(entityId?: string): void {
    if (!entityId) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId } })
    );
  }

  private _onMoreInfoClick(e: Event, entityId?: string): void {
    if (!entityId) return;
    e.stopPropagation();
    this._moreInfo(entityId);
  }

  private _onPressClick(e: Event, id?: string): void {
    e.stopPropagation();
    this._press(id);
  }

  private _onWolClick(e: Event, entityId?: string): void {
    e.stopPropagation();
    if (!entityId || this._wolWaiting) return;
    this._svc("switch", "turn_on", { entity_id: entityId });
    this._wolWaiting = true;
    if (this._wolTimer) clearTimeout(this._wolTimer);
    this._wolTimer = setTimeout(() => {
      this._wolTimer = undefined;
      this._wolWaiting = false;
    }, WOL_TIMEOUT_MS);
  }

  private _onAutomationToggle(e: Event, entityId?: string): void {
    e.stopPropagation();
    if (entityId) this._svc("homeassistant", "toggle", { entity_id: entityId });
  }

  private _onHeaderClick(v: ComputedPcVals): void {
    const c = this._config;
    if (v.isOn) {
      this._toggleMain();
    } else if (c.tracker) {
      this._moreInfo(c.tracker);
    } else if (c.power_state) {
      this._moreInfo(c.power_state);
    }
  }

  protected render() {
    if (!this._config || !this._hass) {
      return nothing;
    }
    const c = this._config;
    const v = computeVals(this._hass, c);

    return html`
      <ha-card class=${v.isOn ? "on" : ""}>
        <div class="wrap">
          ${this._renderHeader(c, v)}
          ${v.isOn
            ? html`
                <div class="card-body" data-ref="card-body" style="max-height:0">
                  ${this._renderGrid(c, v)} ${this._renderAutomations(c, v)} ${this._renderDrives(c, v)}
                  ${v.showWebcam ? this._renderWebcam(c, v) : nothing} ${this._renderVersion(c, v)}
                </div>
              `
            : nothing}
        </div>
      </ha-card>
    `;
  }

  /** M3 determinate linear progress: active track, a 4px gap, the flat
   * remaining track, and a stop indicator at full scale. calc(0% - 4px)
   * clamps to 0 and a negative track width clamps to 0, so both ends of the
   * range need no special-casing. Shared by the metric tiles and the drive
   * bars so the two are visibly the same control. */
  private _progress(pct: number) {
    const p = clamp(pct, 0, 100);
    const full = p >= 99.5;
    return html`
      <div class="progress ${full ? "full" : ""}">
        <div class="progress-active" style="width:calc(${p}% - 4px)"></div>
        <div class="progress-track" style="left:calc(${p}% + 4px)"></div>
        ${full ? nothing : html`<div class="progress-stop"></div>`}
      </div>
    `;
  }

  /** M3 switch, rendered from one helper and shared by every automation row
   * so they are visibly the same control. */
  private _switch(isOn: boolean, label: string, onClick: (e: Event) => void) {
    return html`
      <button
        type="button"
        class="m3-switch ${isOn ? "on" : ""}"
        role="switch"
        aria-checked=${isOn ? "true" : "false"}
        aria-label=${label}
        title=${label}
        @click=${onClick}
      >
        <span class="m3-switch-thumb"><ha-icon icon="mdi:check"></ha-icon></span>
      </button>
    `;
  }

  private _renderHeader(c: PcOverviewCardConfig, v: ComputedPcVals) {
    const hasActions = v.isOn
      ? Boolean(c.btn_reboot || c.btn_suspend || c.btn_hibernate || c.btn_poweroff)
      : Boolean(c.switch_wol);
    const toggles = v.isOn;
    return html`
      <div
        class="header ${toggles ? "toggle" : ""}"
        id="header"
        tabindex="0"
        role="button"
        aria-expanded=${toggles ? (this._mainOpen ? "true" : "false") : nothing}
        aria-label=${toggles ? "Toggle details" : "PC details"}
        @click=${() => this._onHeaderClick(v)}
        @keydown=${(e: KeyboardEvent) => this._toggleKeydown(e, () => this._onHeaderClick(v))}
      >
        <div class="leading-icon">
          <ha-icon icon=${v.isOn ? "mdi:desktop-tower-monitor" : "mdi:power-sleep"}></ha-icon>
        </div>
        <div class="title-text">
          <div class="name m3-title-medium-emphasized">${c.title || "PC"}</div>
          <div class="supporting m3-body-small">${this._renderSupporting(v)}</div>
        </div>
        ${hasActions
          ? html`<div class="header-actions" @click=${(e: Event) => e.stopPropagation()}>
              ${v.isOn ? this._renderPowerBtns(c) : this._renderWolBtn(c)}
            </div>`
          : nothing}
      </div>
    `;
  }

  private _renderSupporting(v: ComputedPcVals) {
    if (!v.isOn) return html`<span>${v.powerState}</span>`;
    return html`
      ${v.lanState ? html`<span>${v.lanState}</span>` : nothing}
      ${v.latencyText
        ? html`<span class="meta-item">
            ${v.lanState ? html`<span class="sep">•</span>` : nothing}<span>${v.latencyText}</span>
          </span>`
        : nothing}
    `;
  }

  private _renderPowerBtns(c: PcOverviewCardConfig) {
    const seg = (id: string | undefined, title: string, icon: string) =>
      id
        ? html`<button
            class="segment"
            type="button"
            title=${title}
            aria-label=${title}
            @click=${(e: Event) => this._onPressClick(e, id)}
          >
            <ha-icon icon=${icon}></ha-icon>
          </button>`
        : nothing;
    const hasGroup = Boolean(c.btn_reboot || c.btn_suspend || c.btn_hibernate);
    // Power off sits outside the connected group, with a gap: the other three
    // are recoverable, and this one isn't. See .power-off in card.css.ts.
    return html`
      ${hasGroup
        ? html`<div class="button-group">
            ${seg(c.btn_reboot, "Reboot", "mdi:restart")}
            ${seg(c.btn_suspend, "Suspend", "mdi:sleep")}
            ${seg(c.btn_hibernate, "Hibernate", "mdi:power-sleep")}
          </div>`
        : nothing}
      ${c.btn_poweroff
        ? html`<button
            class="power-off"
            type="button"
            title="Power Off"
            aria-label="Power Off"
            @click=${(e: Event) => this._onPressClick(e, c.btn_poweroff)}
          >
            <ha-icon icon="mdi:power"></ha-icon>
          </button>`
        : nothing}
    `;
  }

  private _renderWolBtn(c: PcOverviewCardConfig) {
    const eid = c.switch_wol;
    if (!eid) return nothing;
    const w = this._wolWaiting;
    return html`
      <button
        class="btn filled m3-label-large-emphasized"
        type="button"
        title=${w ? "Waiting for PC to come on…" : "Turn PC on (WoL)"}
        ?disabled=${w}
        @click=${(e: Event) => this._onWolClick(e, eid)}
      >
        <ha-icon class=${w ? "spinner" : ""} icon=${w ? "mdi:loading" : "mdi:power"}></ha-icon>
        <span>${w ? "Waking…" : "Wake"}</span>
      </button>
    `;
  }

  private _renderGrid(c: PcOverviewCardConfig, v: ComputedPcVals) {
    return html`
      <div class="grid">
        ${this._tile(v.cpuText, "CPU", "mdi:cpu-64-bit", c.cpu_total, v.cpuPct)}
        ${this._tile(v.loadText, "Load 1m", "mdi:chart-line", c.load_1m, null)}
        ${this._tile(v.tempText, "Temp", "mdi:thermometer", c.package_temp, null, v.tempCls)}
        ${this._tile(v.freqText, "Core 0", "mdi:sine-wave", c.core0_freq, null)}
        ${this._tile(v.memText, "RAM", "mdi:memory", c.mem_usage_pct, v.memPct)}
        ${this._tile(v.rxText, "Download", "mdi:download", c.rx_tp, null)}
        ${this._tile(v.txText, "Upload", "mdi:upload", c.tx_tp, null)}
        ${this._nvmeTile(c, v)}
      </div>
    `;
  }

  private _tile(
    value: string,
    label: string,
    icon: string,
    entityId: string | undefined,
    pct: number | null,
    semCls?: string
  ) {
    const clickable = Boolean(entityId);
    return html`
      <button
        class="tile ${clickable ? "clickable" : ""} ${semCls ?? ""}"
        type="button"
        ?disabled=${!clickable}
        aria-label=${clickable ? `${label}: ${value}. Show details` : `${label}: ${value}`}
        @click=${(e: Event) => this._onMoreInfoClick(e, entityId)}
      >
        <div class="tile-top">
          <ha-icon icon=${icon}></ha-icon>
          <div class="tile-label m3-label-medium">${label}</div>
        </div>
        <div class="tile-value m3-title-small-emphasized ${semCls ? "sem" : ""}">${value}</div>
        ${pct != null ? this._progress(pct) : nothing}
      </button>
    `;
  }

  private _nvmeTile(c: PcOverviewCardConfig, v: ComputedPcVals) {
    const eid = c.nvme_read_rate;
    return html`
      <button
        class="tile ${eid ? "clickable" : ""}"
        type="button"
        ?disabled=${!eid}
        aria-label=${`NVMe I/O: read ${v.nvmeRdText}, write ${v.nvmeWrText}`}
        @click=${(e: Event) => this._onMoreInfoClick(e, eid)}
      >
        <div class="tile-top">
          <ha-icon icon="mdi:harddisk"></ha-icon>
          <div class="tile-label m3-label-medium">NVMe I/O</div>
        </div>
        <div class="tile-nvme m3-label-large">
          <span class="tile-nvme-row"><span class="tile-nvme-key">R</span>${v.nvmeRdText}</span>
          <span class="tile-nvme-row"><span class="tile-nvme-key">W</span>${v.nvmeWrText}</span>
        </div>
      </button>
    `;
  }

  private _renderAutomations(c: PcOverviewCardConfig, v: ComputedPcVals) {
    if (!c.automation_sleep_schedule && !c.automation_idle_shutdown) return nothing;
    if (!v.showSleep && !v.showIdle) return nothing;
    return html`
      <div class="automations">
        ${c.automation_sleep_schedule && v.showSleep
          ? this._autoRow("Sleep schedule shutdown", "mdi:clock-outline", c.automation_sleep_schedule, v.sleepOn)
          : nothing}
        ${c.automation_idle_shutdown && v.showIdle
          ? this._autoRow("Idle shutdown", "mdi:timer-sand", c.automation_idle_shutdown, v.idleOn)
          : nothing}
      </div>
    `;
  }

  private _autoRow(label: string, icon: string, entityId: string, isOn: boolean) {
    return html`
      <div class="automation-row">
        <span class="automation-label m3-body-medium">
          <ha-icon icon=${icon}></ha-icon><span>${label}</span>
        </span>
        ${this._switch(isOn, label, (e: Event) => this._onAutomationToggle(e, entityId))}
      </div>
    `;
  }

  private _renderDrives(c: PcOverviewCardConfig, v: ComputedPcVals) {
    if (!c.disk_root_usage_pct && !c.disk_home_usage_pct && !c.disk_boot_usage_pct) return nothing;
    return html`
      <div class="section drives-section${this._drivesOpen ? "" : " collapsed"}">
        <div
          class="section-header toggle m3-label-large-emphasized"
          id="drives-toggle"
          tabindex="0"
          role="button"
          aria-expanded=${this._drivesOpen ? "true" : "false"}
          @click=${() => this._toggleDrives()}
          @keydown=${(e: KeyboardEvent) => this._toggleKeydown(e, () => this._toggleDrives())}
        >
          <span class="section-header-left"><ha-icon icon="mdi:harddisk"></ha-icon><span>Drives</span></span>
          <ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon>
        </div>
        <div class="section-body drives-body" style="max-height:0">
          <div class="section-body-inner">
            <div class="bars">
              ${c.disk_root_usage_pct ? this._bar("/", v.rootPctText, v.rootPct) : nothing}
              ${c.disk_home_usage_pct ? this._bar("/home", v.homePctText, v.homePct) : nothing}
              ${c.disk_boot_usage_pct ? this._bar("/boot/efi", v.bootPctText, v.bootPct) : nothing}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _bar(label: string, pctText: string, pct: number) {
    return html`
      <div class="bar-row">
        <div class="bar-top m3-body-small">
          <div class="bar-label">${label}</div>
          <div class="bar-value mono">${pctText}</div>
        </div>
        ${this._progress(pct)}
      </div>
    `;
  }

  private _renderWebcam(c: PcOverviewCardConfig, v: ComputedPcVals) {
    return html`
      <div class="section">
        <div class="section-header m3-label-large-emphasized">
          <span class="section-header-left"><ha-icon icon="mdi:webcam"></ha-icon><span>Webcam</span></span>
        </div>
        <div class="section-body-inner">
          <div class="row">
            <div class="row-left">
              ${c.sensor_webcam_status && !this._isUnk(v.webcamStatus)
                ? html`<span class="chip info m3-label-medium">Status: ${v.webcamStatus ?? ""}</span>`
                : nothing}
              ${c.camera_webcam && !this._isUnk(v.webcamCamState)
                ? html`<span class="chip info m3-label-medium">Camera: ${v.webcamCamState ?? ""}</span>`
                : nothing}
            </div>
            <div class="actions">
              ${c.btn_webcam_start
                ? html`<button
                    class="btn m3-label-large-emphasized"
                    type="button"
                    @click=${(e: Event) => this._onPressClick(e, c.btn_webcam_start)}
                  >
                    <ha-icon icon="mdi:play"></ha-icon><span>Start</span>
                  </button>`
                : nothing}
              ${c.btn_webcam_stop
                ? html`<button
                    class="btn m3-label-large-emphasized"
                    type="button"
                    @click=${(e: Event) => this._onPressClick(e, c.btn_webcam_stop)}
                  >
                    <ha-icon icon="mdi:stop"></ha-icon><span>Stop</span>
                  </button>`
                : nothing}
            </div>
          </div>
          ${c.show_camera_preview && c.camera_webcam
            ? html`<div class="camera"><hui-image entity=${c.camera_webcam} aspect_ratio="16:9"></hui-image></div>`
            : nothing}
        </div>
      </div>
    `;
  }

  private _isUnk(state: unknown): boolean {
    return state == null || String(state).toLowerCase() === "unknown" || String(state).toLowerCase() === "unavailable";
  }

  private _renderVersion(c: PcOverviewCardConfig, v: ComputedPcVals) {
    // Gated on the current show-conditions, not just whether these fields
    // are configured — otherwise a configured-but-currently-unknown entity
    // (e.g. firmware_security not yet reporting) leaves an empty row
    // showing (just the border-top divider, no badges inside it).
    const showAnyBadge = v.showFw || v.showCpuVuln || v.showMic || v.showWcam || v.showSmartNvme || v.showSmartSda;
    return html`
      <div class="section version-section${this._versionOpen ? "" : " collapsed"}">
        <div
          class="section-header toggle m3-label-large-emphasized"
          id="version-toggle"
          tabindex="0"
          role="button"
          aria-expanded=${this._versionOpen ? "true" : "false"}
          @click=${() => this._toggleVersion()}
          @keydown=${(e: KeyboardEvent) => this._toggleKeydown(e, () => this._toggleVersion())}
        >
          <span class="section-header-left">
            <ha-icon icon="mdi:information-outline"></ha-icon><span>Version / system</span>
          </span>
          <ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon>
        </div>
        <div class="section-body version-body" style="max-height:0">
          <div class="section-body-inner">
            ${this._renderMeta(v)}
            ${v.showInhibit
              ? html`<div class="meta-chip-row">
                  <span class="chip warn m3-label-medium">Sleep/Shutdown Inhibited</span>
                </div>`
              : nothing}
            ${showAnyBadge ? html`<div class="icon-badges">${this._iconBadges(c, v)}</div>` : nothing}
          </div>
        </div>
      </div>
    `;
  }

  /** The machine's facts as a description list. Every row is omitted rather
   * than shown empty, so a PC reporting half these sensors gets a shorter
   * list instead of a column of dashes. */
  private _renderMeta(v: ComputedPcVals) {
    const rows: Array<[string, unknown]> = [
      ["OS", v.distroText],
      ["Kernel", v.kernel],
      ["Agent", v.agentVersion],
      ["Uptime", v.uptime],
      ["Reboot", v.lastReboot],
      ["Power plan", v.powerProfile],
      ["LAN", v.lanIp],
      ["WAN", v.extIp],
    ];
    const shown = rows.filter(([, value]) => value != null && String(value).trim() !== "");
    if (shown.length === 0) return nothing;
    return html`
      <dl class="meta-grid m3-body-small">
        ${shown.map(
          ([key, value]) => html`
            <dt class="meta-key">${key}</dt>
            <dd class="meta-val mono">${value}</dd>
          `
        )}
      </dl>
    `;
  }

  private _iconBadge(
    entityId: string,
    show: boolean,
    semCls: string,
    icon: string,
    title: string
  ) {
    if (!show) return nothing;
    return html`
      <button
        class="icon-badge ${semCls}"
        type="button"
        title=${title}
        aria-label=${title}
        @click=${(e: Event) => this._onMoreInfoClick(e, entityId)}
      >
        <ha-icon icon=${icon}></ha-icon>
      </button>
    `;
  }

  private _iconBadges(c: PcOverviewCardConfig, v: ComputedPcVals) {
    return html`
      ${c.firmware_security
        ? this._iconBadge(
            c.firmware_security,
            v.showFw,
            v.fwBad ? "bad" : "good",
            v.fwBad ? "mdi:shield-alert" : "mdi:shield-check",
            `Firmware / HSI: ${v.fwState ?? ""}`
          )
        : nothing}
      ${c.cpu_vulnerabilities
        ? this._iconBadge(
            c.cpu_vulnerabilities,
            v.showCpuVuln,
            v.cpuVulnBad ? "bad" : "good",
            "mdi:cpu-64-bit",
            "CPU vulnerabilities"
          )
        : nothing}
      ${c.microphone_in_use
        ? this._iconBadge(c.microphone_in_use, v.showMic, "warn", "mdi:microphone", "Mic in use")
        : nothing}
      ${c.webcam_in_use
        ? this._iconBadge(c.webcam_in_use, v.showWcam, "warn", "mdi:webcam", "Webcam in use")
        : nothing}
      ${c.smart_nvme
        ? this._iconBadge(
            c.smart_nvme,
            v.showSmartNvme,
            v.smartNvmeBad ? "bad" : "good",
            "mdi:expansion-card-variant",
            "NVMe SMART"
          )
        : nothing}
      ${c.smart_sda
        ? this._iconBadge(c.smart_sda, v.showSmartSda, v.smartSdaBad ? "bad" : "good", "mdi:harddisk", "SDA SMART")
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pc-overview-card": PcOverviewCard;
  }
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string; preview?: boolean }>;
  }
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "pc-overview-card",
  name: "PC Overview Card",
  description: "PC power state, live perf metrics, Wake-on-LAN, and system info",
});
