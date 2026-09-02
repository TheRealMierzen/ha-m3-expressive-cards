import { HomeAssistant } from "../src/types";

interface SchemaEntry {
  name: string;
  selector: Record<string, any>;
}

/**
 * Real HA renders the editor's fields via <ha-form> plus the selector
 * components it drives (ha-entity-picker, ha-icon-picker, ha-selector-select
 * and friends). None of those exist here, so this registers a deliberately
 * plain stand-in that speaks the same contract: `.schema` + `.data` in,
 * a `value-changed` event carrying the whole updated data object out.
 *
 * Dev-only, never bundled into dist/. It is not a visual proxy for the real
 * thing — it exists to exercise the editor's data flow (cascade order,
 * add/remove/reorder, YAML-only guards), not its looks in HA.
 */
export function registerMockHaForm(): void {
  if (customElements.get("ha-form")) return;

  customElements.define(
    "ha-form",
    class extends HTMLElement {
      private _shadow = this.attachShadow({ mode: "open" });
      private _schema: SchemaEntry[] = [];
      private _data: Record<string, unknown> = {};
      private _computeLabel?: (s: { name: string }) => string;
      private _computeHelper?: (s: { name: string }) => string | undefined;
      private _hass?: HomeAssistant;
      private _connected = false;

      set schema(value: SchemaEntry[]) {
        this._schema = value ?? [];
        this._render();
      }
      set data(value: Record<string, unknown>) {
        this._data = value ?? {};
        this._render();
      }
      set hass(value: HomeAssistant) {
        this._hass = value;
        this._render();
      }
      set computeLabel(fn: (s: { name: string }) => string) {
        this._computeLabel = fn;
      }
      set computeHelper(fn: (s: { name: string }) => string | undefined) {
        this._computeHelper = fn;
      }

      connectedCallback(): void {
        this._connected = true;
        this._render();
      }

      private _emit(name: string, value: unknown): void {
        const next = { ...this._data, [name]: value };
        this.dispatchEvent(
          new CustomEvent("value-changed", { detail: { value: next }, bubbles: true, composed: true })
        );
      }

      private _render(): void {
        if (!this._connected) return;
        this._shadow.innerHTML = `
          <style>
            :host { display: block; }
            .field { display: flex; flex-direction: column; gap: 3px; margin: 8px 0; }
            label { font-size: 12px; opacity: 0.75; }
            .helper { font-size: 11px; opacity: 0.5; line-height: 1.35; }
            input[type="text"], input[type="number"], select {
              font: inherit; font-size: 13px; padding: 5px 7px; border-radius: 6px;
              border: 1px solid rgba(127,127,127,0.4); background: transparent; color: inherit;
            }
            .inline { flex-direction: row; align-items: center; gap: 8px; }
          </style>
        `;

        for (const entry of this._schema) {
          const wrap = document.createElement("div");
          const kind = Object.keys(entry.selector ?? {})[0] ?? "text";
          wrap.className = kind === "boolean" ? "field inline" : "field";
          wrap.dataset.field = entry.name;

          const label = document.createElement("label");
          label.textContent = this._computeLabel?.(entry) ?? entry.name;
          const current = this._data[entry.name];

          let field: HTMLElement;
          if (kind === "boolean") {
            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = current === true;
            input.addEventListener("change", () => this._emit(entry.name, input.checked));
            field = input;
          } else if (kind === "select") {
            const options: Array<{ value: string; label: string }> = entry.selector.select.options ?? [];
            if (entry.selector.select.custom_value) {
              const input = document.createElement("input");
              input.type = "text";
              input.setAttribute("list", `list-${entry.name}`);
              input.value = current === undefined ? "" : String(current);
              const datalist = document.createElement("datalist");
              datalist.id = `list-${entry.name}`;
              for (const option of options) {
                const el = document.createElement("option");
                el.value = option.value;
                datalist.appendChild(el);
              }
              input.addEventListener("change", () => this._emit(entry.name, input.value));
              this._shadow.appendChild(datalist);
              field = input;
            } else {
              const select = document.createElement("select");
              const blank = document.createElement("option");
              blank.value = "";
              blank.textContent = "—";
              select.appendChild(blank);
              for (const option of options) {
                const el = document.createElement("option");
                el.value = option.value;
                el.textContent = option.label;
                select.appendChild(el);
              }
              select.value = current === undefined ? "" : String(current);
              select.addEventListener("change", () => this._emit(entry.name, select.value));
              field = select;
            }
          } else if (kind === "entity") {
            const select = document.createElement("select");
            const blank = document.createElement("option");
            blank.value = "";
            blank.textContent = "—";
            select.appendChild(blank);
            for (const id of Object.keys(this._hass?.states ?? {})) {
              const el = document.createElement("option");
              el.value = id;
              el.textContent = id;
              select.appendChild(el);
            }
            const value = current === undefined ? "" : String(current);
            // An entity that no longer exists must stay selectable, or
            // opening the editor would silently drop it from the config.
            if (value !== "" && !this._hass?.states[value]) {
              const el = document.createElement("option");
              el.value = value;
              el.textContent = `${value} (missing)`;
              select.appendChild(el);
            }
            select.value = value;
            select.addEventListener("change", () => this._emit(entry.name, select.value));
            field = select;
          } else if (kind === "number") {
            const input = document.createElement("input");
            input.type = "number";
            if (entry.selector.number?.min !== undefined) input.min = String(entry.selector.number.min);
            if (entry.selector.number?.max !== undefined) input.max = String(entry.selector.number.max);
            input.value = current === undefined || current === null ? "" : String(current);
            input.addEventListener("change", () =>
              this._emit(entry.name, input.value === "" ? undefined : Number(input.value))
            );
            field = input;
          } else {
            const input = document.createElement("input");
            input.type = "text";
            if (kind === "icon") input.placeholder = "mdi:...";
            input.value = current === undefined ? "" : String(current);
            input.addEventListener("change", () => this._emit(entry.name, input.value));
            field = input;
          }

          wrap.appendChild(label);
          wrap.appendChild(field);
          const helperText = this._computeHelper?.(entry);
          if (helperText) {
            const helper = document.createElement("div");
            helper.className = "helper";
            helper.textContent = helperText;
            wrap.appendChild(helper);
          }
          this._shadow.appendChild(wrap);
        }
      }
    }
  );
}
