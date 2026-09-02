import { defaultColor, readableTextColor, resolveColor } from "./colors";
import { conditionRefs, EntityRef, isOnState, matchWhen, UNAVAILABLE_STATES } from "./conditions";
import {
  AnimationTarget,
  AnimationType,
  BadgeConfig,
  HomeAssistant,
  QuickTogglesCardConfig,
  ResolvedBadge,
  ResolvedItem,
  ResolvedToggle,
  RuntimeState,
  ToggleItemConfig,
  ToggleStateConfig,
} from "./types";

export const DEFAULT_ICON = "mdi:toggle-switch-outline";
const UNAVAILABLE_ICON = "mdi:help-circle-outline";

/** Which layer each animation drives when the config doesn't say. */
const DEFAULT_TARGET: Record<AnimationType, AnimationTarget> = {
  none: "glyph",
  sweep: "ring",
  spin: "glyph",
  pulse: "glyph",
  breathe: "glyph",
  bounce: "glyph",
  shake: "glyph",
  sheen: "plate",
  flash: "plate",
};

/**
 * Not every animation makes sense on every layer — `spin` on the plate would
 * rotate a circle (no visible effect) and `sweep` only exists as a ring arc.
 * An illegal target silently falls back to the animation's default layer
 * rather than rendering nothing.
 */
const LEGAL_TARGETS: Record<AnimationType, AnimationTarget[]> = {
  none: ["glyph", "ring", "plate", "badge"],
  sweep: ["ring"],
  spin: ["glyph"],
  pulse: ["glyph", "ring", "plate", "badge"],
  breathe: ["glyph", "ring", "plate", "badge"],
  bounce: ["glyph"],
  shake: ["glyph"],
  sheen: ["plate"],
  flash: ["plate", "ring"],
};

export function itemKind(item: ToggleItemConfig): "toggle" | "divider" {
  return item.type === "divider" ? "divider" : "toggle";
}

/**
 * The text a value badge shows, or undefined for a plain dot. Value mode is
 * triggered by naming an `entity` or an `attribute` — a badge with only a
 * colour stays a dot.
 *
 * Numbers are rounded and optionally capped ("99+"), the way a notification
 * badge is, because the pill only has room for two or three characters. A
 * non-numeric state is shown verbatim but clipped to four, so a stray
 * `state: cleaning` can't stretch the badge across the medallion.
 */
function badgeText(hass: HomeAssistant, cfg: BadgeConfig, selfEntity: string | undefined): string | undefined {
  if (cfg.entity === undefined && cfg.attribute === undefined) return undefined;
  const entityId = cfg.entity ?? selfEntity;
  if (!entityId) return undefined;
  const entity = hass.states[entityId];
  if (!entity) return undefined;
  const raw = cfg.attribute ? entity.attributes[cfg.attribute] : entity.state;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const num = Number(raw);
  if (Number.isFinite(num)) {
    if (cfg.max !== undefined && num > cfg.max) return `${cfg.max}+`;
    return num.toFixed(Math.max(0, Math.min(3, cfg.round ?? 0)));
  }
  const text = String(raw);
  if (UNAVAILABLE_STATES.has(text.toLowerCase())) return undefined;
  return text.slice(0, 4);
}

function normalizeBadge(
  value: boolean | BadgeConfig,
  color: string,
  darkMode: boolean,
  hass: HomeAssistant,
  selfEntity: string | undefined
): ResolvedBadge | undefined {
  if (value === false) return undefined;
  if (value === true) return { color, animation: "none" };
  const resolved = resolveColor(value.color, darkMode, color);
  const text = badgeText(hass, value, selfEntity);
  return {
    color: resolved,
    animation: value.animation ?? "none",
    text,
    textColor: text === undefined ? undefined : readableTextColor(resolved),
  };
}

/** Entities a value badge reads, for the render signature. */
function badgeRefs(badge: boolean | BadgeConfig | undefined, selfEntity: string | undefined): EntityRef[] {
  if (badge === undefined || typeof badge !== "object" || badge === null) return [];
  if (badge.entity === undefined && badge.attribute === undefined) return [];
  const entity = badge.entity ?? selfEntity;
  if (!entity) return [];
  return [badge.attribute ? { entity, attribute: badge.attribute } : { entity }];
}

function normalizeGlow(value: boolean | number | undefined, on: boolean): number {
  if (value === undefined) return on ? 0.5 : 0;
  if (value === true) return 1;
  if (value === false) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return Math.min(Math.max(value, 0), 1);
  return on ? 0.5 : 0;
}

/**
 * Resolves one toggle to its view model.
 *
 * The cascade is **per field, earliest match wins** — not first-matching-entry-
 * wins-wholesale. For each of icon / colour / animation / badge / glow
 * independently, the value comes from the earliest matching `states` entry
 * that specifies that field, then the toggle's base config, then the entity's
 * own attributes. That's what lets a condition say only what's *different*
 * ("also spin the glyph") without restating the base appearance.
 *
 * Animations cascade per *layer*: the earliest matching entry claims a layer,
 * and later entries can't take one already claimed. `animation: none` claims
 * a layer too, which is how a condition suppresses motion a lower-priority
 * entry would otherwise add.
 */
function resolveToggle(
  hass: HomeAssistant,
  item: ToggleItemConfig,
  index: number,
  runtime: RuntimeState,
  darkMode: boolean
): ResolvedToggle {
  const entityId = item.entity && item.entity !== "" ? item.entity : undefined;
  const entity = entityId ? hass.states[entityId] : undefined;
  const rawState = entity?.state ?? "";
  const available = Boolean(entity) && !UNAVAILABLE_STATES.has(rawState.toLowerCase());

  const actualOn = available && isOnState(rawState);
  const pendingValue = entityId ? runtime.pending[entityId] : undefined;
  const momentary = item.momentary === true;
  // A momentary button never latches, so it has no "on" of its own — its
  // press feedback is the flash, and any lasting state comes from a
  // `states` entry watching whatever the action started.
  const on = momentary ? false : (pendingValue ?? actualOn);

  const matched = (item.states ?? []).filter((s) => matchWhen(hass, s.when, entityId, on));

  const pick = <K extends keyof ToggleStateConfig>(key: K): ToggleStateConfig[K] | undefined => {
    for (const entry of matched) {
      if (entry[key] !== undefined) return entry[key];
    }
    return undefined;
  };

  const color = resolveColor(pick("color") ?? item.color, darkMode, defaultColor(darkMode));

  let icon = pick("icon") ?? item.icon ?? entity?.attributes.icon ?? DEFAULT_ICON;
  if (!entity && !item.icon && !pick("icon")) icon = UNAVAILABLE_ICON;

  const animations: Partial<Record<AnimationTarget, AnimationType>> = {};
  for (const entry of matched) {
    const type = entry.animation;
    if (type === undefined) continue;
    const requested = entry.animation_target;
    const target =
      requested && LEGAL_TARGETS[type].includes(requested) ? requested : DEFAULT_TARGET[type];
    if (animations[target] !== undefined) continue;
    animations[target] = type;
  }

  const badgeSpec = pick("badge");
  let badge =
    badgeSpec === undefined ? undefined : normalizeBadge(badgeSpec, color, darkMode, hass, entityId);
  if (badge && animations.badge !== undefined) {
    badge = { ...badge, animation: animations.badge };
  } else if (badge && badge.animation !== "none") {
    animations.badge = badge.animation;
  }

  const wouldAnimate = Object.values(animations).some((a) => a !== undefined && a !== "none");

  // Reduced motion is a design case here, not just a guard: with no text on
  // the card, motion is sometimes the *only* channel saying "busy". Dropping
  // the keyframes without substituting something static would make that
  // state invisible, so an animating toggle keeps a badge and a full-strength
  // ring instead.
  const emphasis = runtime.reducedMotion && wouldAnimate;
  if (emphasis) {
    for (const key of Object.keys(animations) as AnimationTarget[]) {
      animations[key] = "none";
    }
    if (!badge) badge = { color, animation: "none" };
    else badge = { ...badge, animation: "none" };
  }

  return {
    kind: "toggle",
    index,
    entityId,
    label: item.name ?? entity?.attributes.friendly_name ?? entityId ?? "Toggle",
    icon,
    color,
    on,
    available,
    pending: pendingValue !== undefined,
    momentary,
    armed: runtime.armedIndex === index,
    flashing: runtime.flashIndex === index,
    glow: normalizeGlow(pick("glow"), on),
    badge,
    animations,
    emphasis,
  };
}

/**
 * A toggle with no `visible` clause is always shown. Missing entities count as
 * visible: see ToggleItemConfig.visible — losing a control to a typo is a
 * worse failure than showing one that should have been hidden.
 */
function isVisible(hass: HomeAssistant, item: ToggleItemConfig, on: boolean): boolean {
  if (item.visible === undefined) return true;
  return matchWhen(hass, item.visible, item.entity, on, { missingEntity: true });
}

/**
 * Drops dividers that have nothing to divide. Hiding a toggle can strand its
 * divider at the start or end of the row, or leave two of them touching —
 * visible as a floating tick mark with no group beside it.
 */
function tidyDividers(items: ResolvedItem[]): ResolvedItem[] {
  const out: ResolvedItem[] = [];
  for (const item of items) {
    if (item.kind !== "divider") {
      out.push(item);
      continue;
    }
    if (out.length === 0) continue;
    if (out[out.length - 1].kind === "divider") continue;
    out.push(item);
  }
  while (out.length > 0 && out[out.length - 1].kind === "divider") out.pop();
  return out;
}

/** Pure: no DOM, no service calls, no clock reads. */
export function resolveItems(
  hass: HomeAssistant,
  config: QuickTogglesCardConfig,
  runtime: RuntimeState
): ResolvedItem[] {
  const darkMode = Boolean(hass.themes?.darkMode);
  const resolved: ResolvedItem[] = [];
  (config.toggles ?? []).forEach((item, index) => {
    if (itemKind(item) === "divider") {
      resolved.push({ kind: "divider", index });
      return;
    }
    const toggle = resolveToggle(hass, item, index, runtime, darkMode);
    if (!isVisible(hass, item, toggle.on)) return;
    resolved.push(toggle);
  });
  return tidyDividers(resolved);
}

/** How many toggles (dividers aside) the config declares, visible or not. */
export function configuredToggleCount(config: QuickTogglesCardConfig): number {
  return (config.toggles ?? []).filter((item) => itemKind(item) !== "divider").length;
}

/**
 * Everything the card reads, including entities named only inside conditions
 * and the specific attributes those conditions test. This is the subtle
 * failure mode for this card: leave a condition's entity (or attribute) out
 * and the medallion silently stops reacting to its second sensor, because
 * the card never re-renders for it.
 */
export function cardEntityRefs(config: QuickTogglesCardConfig): EntityRef[] {
  const refs: EntityRef[] = [];
  const seen = new Set<string>();
  const add = (ref: EntityRef): void => {
    const key = ref.attribute ? `${ref.entity}.${ref.attribute}` : ref.entity;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  };
  for (const item of config.toggles ?? []) {
    if (itemKind(item) === "divider") continue;
    if (item.entity) add({ entity: item.entity });
    for (const entry of item.states ?? []) {
      for (const ref of conditionRefs(entry.when)) add(ref);
      // A value badge's own entity, or the number in it goes stale.
      for (const ref of badgeRefs(entry.badge, item.entity)) add(ref);
    }
    // Visibility reads entities too, and a card that doesn't re-render for
    // them would keep showing a toggle its own config says to hide.
    for (const ref of conditionRefs(item.visible)) add(ref);
  }
  return refs;
}

/**
 * The signature also carries the theme: every medallion colour is resolved
 * against dark/light at render time, so a theme flip with no entity change
 * must still re-render. Without this the card kept the dark ramp after HA
 * switched to a light theme — the CSS tokens updated, the resolved colours
 * didn't.
 */
export function renderSignature(hass: HomeAssistant, config: QuickTogglesCardConfig): string {
  return `${hass.themes?.darkMode ? "dark" : "light"}|${entitySignature(hass, config)}`;
}

export function entitySignature(hass: HomeAssistant, config: QuickTogglesCardConfig): string {
  return cardEntityRefs(config)
    .map((ref) => {
      const entity = hass.states[ref.entity];
      if (!entity) return `${ref.entity}:_`;
      if (!ref.attribute) return `${ref.entity}:${entity.state}`;
      return `${ref.entity}.${ref.attribute}:${String(entity.attributes[ref.attribute])}`;
    })
    .join("|");
}

/** "domain.service" -> ["domain", "service"]; null if it isn't that shape. */
export function splitService(service: string | undefined): [string, string] | null {
  if (!service) return null;
  const idx = service.indexOf(".");
  if (idx <= 0 || idx === service.length - 1) return null;
  return [service.slice(0, idx), service.slice(idx + 1)];
}
