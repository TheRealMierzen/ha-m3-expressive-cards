import * as mdi from "@mdi/js";

/** "mdi:cpu-64-bit" -> "mdiCpu64Bit", matching @mdi/js's export naming. */
function exportNameFor(icon: string): string {
  const name = icon.startsWith("mdi:") ? icon.slice(4) : icon;
  return "mdi" + name.split("-").map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1)).join("");
}

function pathFor(icon: string | null): string | undefined {
  if (!icon) return undefined;
  return (mdi as Record<string, string | undefined>)[exportNameFor(icon)];
}

/**
 * Real HA renders <ha-icon> via its own component (mdi glyph lookup +
 * theming); this dev harness has no such component, so <ha-icon icon="...">
 * would otherwise render as empty. Registers a trivial stand-in that draws
 * the actual mdi glyph from @mdi/js — dev-only, never shipped in dist/.
 */
export function registerMockHaIcon(): void {
  if (customElements.get("ha-icon")) return;
  customElements.define(
    "ha-icon",
    class extends HTMLElement {
      static get observedAttributes() {
        return ["icon"];
      }
      private _shadow = this.attachShadow({ mode: "open" });

      connectedCallback(): void {
        this._render();
      }
      attributeChangedCallback(): void {
        this._render();
      }
      private _render(): void {
        // Renders into our own shadow root, never the light DOM — ha-icon
        // instances live inside Lit-rendered templates, and writing to
        // this element's own (light-DOM) innerHTML/children races with
        // Lit's DOM management the instant the element connects.
        // :host sets a 24px default (mirroring real ha-icon's own default
        // size) that author CSS on the host element — e.g. `.chip-ic
        // {width:16px}` — overrides from outside, same as the real thing.
        const path = pathFor(this.getAttribute("icon"));
        this._shadow.innerHTML = `
          <style>
            :host {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 24px;
              height: 24px;
            }
            svg { width: 100%; height: 100%; }
          </style>
          ${path ? `<svg viewBox="0 0 24 24"><path fill="currentColor" d="${path}"/></svg>` : ""}
        `;
      }
    }
  );
}
