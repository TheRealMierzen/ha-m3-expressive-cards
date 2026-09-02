import { html, nothing, TemplateResult } from "lit";
import { AnimationTarget, ResolvedToggle } from "./types";

/** One class prefix per animatable layer, so the CSS rules stay flat. */
const TARGET_PREFIX: Record<AnimationTarget, string> = {
  glyph: "g",
  ring: "r",
  plate: "p",
  badge: "b",
};

export function medallionClasses(toggle: ResolvedToggle, pressing = false): string {
  const classes = ["medallion", toggle.on ? "on" : "off"];
  if (!toggle.available) classes.push("unavailable");
  if (toggle.pending) classes.push("pending");
  if (toggle.armed) classes.push("armed");
  if (toggle.flashing) classes.push("flashing");
  if (toggle.emphasis) classes.push("emphasis");
  if (pressing) classes.push("pressing");
  for (const [target, type] of Object.entries(toggle.animations)) {
    if (!type || type === "none") continue;
    classes.push(`${TARGET_PREFIX[target as AnimationTarget]}-${type}`);
  }
  return classes.join(" ");
}

/**
 * The medallion's visuals only — no button, no event handlers — so the card
 * and the editor's live row previews render byte-identical circles.
 *
 * Every layer is always in the DOM (except the badge, which is genuinely
 * optional) and switched by opacity/animation rather than being added and
 * removed. Layers that come and go would restart their neighbours' CSS
 * animations on every state change.
 */
export function renderMedallion(toggle: ResolvedToggle, pressing = false): TemplateResult {
  return html`
    <div
      class=${medallionClasses(toggle, pressing)}
      style="--qt-color:${toggle.color};--qt-glow:${toggle.glow};${toggle.badge
        ? `--qt-badge-color:${toggle.badge.color};`
        : ""}${toggle.badge?.textColor ? `--qt-badge-text:${toggle.badge.textColor};` : ""}"
    >
      <span class="glow"></span>
      <span class="plate"></span>
      <span class="ring"></span>
      <span class="arc"></span>
      <span class="flash"></span>
      <ha-icon class="glyph" icon=${toggle.icon}></ha-icon>
      ${toggle.badge
        ? html`<span class=${toggle.badge.text !== undefined ? "badge badge-value" : "badge"}
            >${toggle.badge.text ?? nothing}</span
          >`
        : nothing}
    </div>
  `;
}
