import { HomeAssistant } from "../src/types";

interface SchemaEntry {
  name: string;
  title?: string;
  type?: string;
  expanded?: boolean;
  schema?: SchemaEntry[];
  selector?: Record<string, any>;
}

/**
 * Real HA renders the editor's fields via <ha-form> plus the selector
 * components it drives (ha-entity-picker, ha-selector-select, the expandable
 * panel). None of those exist here, so this registers a deliberately plain
 * stand-in that speaks the same contract: `.schema` + `.data` in, a
 * `value-changed` event carrying the whole updated data object out.
 *
 * Dev-only, never bundled into dist/. It is not a visual proxy for the real
 * thing — it exists to exercise the editor's data flow (which keys get
 * written, which get deleted, which defaults are deliberately not persisted,
 * and how the schema changes shape as fields are filled in), not its looks
 * in HA. Multi-value selectors in particular are plain comma-separated text
 * boxes here, where real HA gives you a chip picker.
 *
 * Copied verbatim between cards: each card stays independently buildable, so
 * this is duplicated rather than imported across folders.
 */
export function registerMockHaForm(): void {
  if (customElements.get("ha-form")) return;

  customElements.define(
    "ha-form",
    class extends HTMLElement {
      private _shadow = this.attachShadow({ mode: "open" });
      private _schema: SchemaEntry[] = [];
      private _data: Record<string, unknown> = {};
      private _computeLabel?: (s: SchemaEntry) => string;
      private _computeHelper?: (s: SchemaEntry) => string | undefined;
      private _hass?: HomeAssistant;
      private _connected = false;
      /** Which expandable panels are open, kept across re-renders. */
      private _open = new Set<string>();
      /** Panels the user has clicked, so a schema's `expanded: true` only
       * decides the *first* render and can't fight a deliberate collapse. */
      private _touched = new Set<string>();

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
      set computeLabel(fn: (s: SchemaEntry) => string) {
        this._computeLabel = fn;
      }
      set computeHelper(fn: (s: SchemaEntry) => string | undefined) {
        this._computeHelper = fn;
      }

      connectedCallback(): void {
        this._connected = true;
        this._render();
      }

      private _emit(name: string, value: unknown): void {
        this.dispatchEvent(
          new CustomEvent("value-changed", {
            detail: { value: { ...this._data, [name]: value } },
            bubbles: true,
            composed: true,
          })
        );
      }

      private _field(entry: SchemaEntry): HTMLElement {
        const kind = Object.keys(entry.selector ?? {})[0] ?? "text";
        const config = entry.selector?.[kind] ?? {};
        const current = this._data[entry.name];
        const multiple = config.multiple === true;

        if (kind === "boolean") {
          const input = document.createElement("input");
          input.type = "checkbox";
          input.checked = current === true;
          input.addEventListener("change", () => this._emit(entry.name, input.checked));
          return input;
        }

        if (multiple) {
          const input = document.createElement("input");
          input.type = "text";
          input.placeholder = "comma separated";
          input.value = Array.isArray(current) ? current.join(", ") : "";
          input.addEventListener("change", () => {
            const parts = input.value
              .split(",")
              .map((p) => p.trim())
              .filter((p) => p !== "");
            this._emit(entry.name, parts);
          });
          return input;
        }

        if (kind === "select") {
          const select = document.createElement("select");
          const blank = document.createElement("option");
          blank.value = "";
          blank.textContent = "—";
          select.appendChild(blank);
          for (const opt of (config.options ?? []) as Array<{ value: string; label: string }>) {
            const el = document.createElement("option");
            el.value = opt.value;
            el.textContent = opt.label;
            select.appendChild(el);
          }
          select.value = current === undefined ? "" : String(current);
          select.addEventListener("change", () => this._emit(entry.name, select.value));
          return select;
        }

        if (kind === "entity") {
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
          // An entity that no longer exists must stay selectable, or opening
          // the editor would silently drop it from the config.
          if (value !== "" && !this._hass?.states[value]) {
            const el = document.createElement("option");
            el.value = value;
            el.textContent = `${value} (missing)`;
            select.appendChild(el);
          }
          select.value = value;
          select.addEventListener("change", () => this._emit(entry.name, select.value));
          return select;
        }

        const input = document.createElement("input");
        input.type = kind === "number" ? "number" : "text";
        if (kind === "number") {
          if (config.min !== undefined) input.min = String(config.min);
          if (config.max !== undefined) input.max = String(config.max);
          if (config.step !== undefined) input.step = String(config.step);
        }
        input.value = current === undefined || current === null ? "" : String(current);
        input.addEventListener("change", () => {
          if (kind === "number") {
            this._emit(entry.name, input.value === "" ? undefined : Number(input.value));
          } else {
            this._emit(entry.name, input.value);
          }
        });
        return input;
      }

      private _renderEntries(entries: SchemaEntry[], into: ParentNode): void {
        for (const entry of entries) {
          if (entry.type === "expandable") {
            const key = entry.title ?? entry.name;
            const details = document.createElement("details");
            details.className = "group";
            details.open = this._open.has(key) || (entry.expanded === true && !this._touched.has(key));
            details.addEventListener("toggle", () => {
              this._touched.add(key);
              if (details.open) this._open.add(key);
              else this._open.delete(key);
            });
            const summary = document.createElement("summary");
            summary.textContent = entry.title ?? entry.name;
            details.appendChild(summary);
            this._renderEntries(entry.schema ?? [], details);
            into.appendChild(details);
            continue;
          }

          if (entry.type === "grid") {
            const grid = document.createElement("div");
            grid.className = "grid";
            this._renderEntries(entry.schema ?? [], grid);
            into.appendChild(grid);
            continue;
          }

          const kind = Object.keys(entry.selector ?? {})[0] ?? "text";
          const wrap = document.createElement("div");
          wrap.className = kind === "boolean" ? "field inline" : "field";
          wrap.dataset.field = entry.name;

          const label = document.createElement("label");
          label.textContent = this._computeLabel?.(entry) ?? entry.name;
          wrap.appendChild(label);
          wrap.appendChild(this._field(entry));

          const helperText = this._computeHelper?.(entry);
          if (helperText) {
            const helper = document.createElement("div");
            helper.className = "helper";
            helper.textContent = helperText;
            wrap.appendChild(helper);
          }
          into.appendChild(wrap);
        }
      }

      private _render(): void {
        if (!this._connected) return;
        this._shadow.innerHTML = `
          <style>
            :host { display: block; font-size: 13px; }
            .field { display: flex; flex-direction: column; gap: 3px; margin: 8px 0; }
            .field.inline { flex-direction: row; align-items: center; gap: 8px; }
            label { font-size: 12px; opacity: 0.75; }
            .helper { font-size: 11px; opacity: 0.5; line-height: 1.35; }
            input[type="text"], input[type="number"], select {
              font: inherit; font-size: 13px; padding: 5px 7px; border-radius: 6px;
              border: 1px solid rgba(127,127,127,0.4); background: transparent; color: inherit;
            }
            .grid {
              display: grid; grid-template-columns: 1fr 1fr; gap: 0 10px;
            }
            details.group {
              border: 1px solid rgba(127,127,127,0.3); border-radius: 8px;
              padding: 4px 10px; margin: 10px 0;
            }
            summary { cursor: pointer; font-size: 12px; font-weight: 600; opacity: 0.8; padding: 4px 0; }
          </style>
        `;
        this._renderEntries(this._schema, this._shadow);
      }
    }
  );
}
