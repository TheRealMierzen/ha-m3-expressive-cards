import { css } from "lit";

/**
 * The medallion's own visuals, split out of card.css.ts because the editor
 * renders live medallion previews in its row headers and needs the exact
 * same circles in its own shadow root.
 *
 * Consumes --qt-plate / --qt-glyph / --qt-badge / --qt-ring for geometry and
 * --m3-* for surface, motion and shape tokens; both hosts supply those
 * themselves, at different sizes.
 *
 * Note the medallion stays a circle. M3 Expressive's signature press
 * feedback is a shape morph, but the ring is a radial-gradient annulus and
 * the sweep arc a conic gradient — both assume a circle, and morphing only
 * the plate would leave the ring visibly detached from it. The card already
 * has four independent state channels and doesn't need shape as a fifth, so
 * press feedback here is the spring-driven scale instead, which is equally
 * Expressive and doesn't fight the anatomy.
 */
export const medallionStyles = css`
  /* ------------------------------------------------------------ medallion */

  .medallion {
    position: relative;
    width: var(--qt-plate);
    height: var(--qt-plate);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Spatial spring: the medallion overshoots and settles on release
       rather than easing flatly back. */
    transition: transform var(--m3-spring-spatial-fast-duration) var(--m3-spring-spatial-fast);
  }
  .medallion.pressing {
    transform: scale(0.93);
  }

  /* Its own layer rather than a box-shadow on .plate, so glow strength maps
     straight to opacity — no alpha arithmetic on a colour that might be a
     var() the card can't introspect. */
  .glow {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    box-shadow: 0 0 16px 0 var(--qt-color);
    opacity: var(--qt-glow, 0);
    transition: opacity var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
    pointer-events: none;
  }

  .plate {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    overflow: hidden;
    background: var(--m3-surface-container-high);
    box-shadow: inset 0 0 0 1px var(--m3-outline-variant);
    transition: background var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }

  /* M3 state layer. Tinted with the toggle's own colour rather than the
     content colour, which makes hover on an *off* medallion double as a
     preview of what turning it on will look like — a behaviour this card
     already wanted, now expressed as the standard M3 mechanism.
     ::before, because .plate::after is the sheen animation. */
  .plate::before {
    content: "";
    position: absolute;
    inset: 0;
    background: var(--qt-color);
    opacity: 0;
    transition: opacity var(--m3-spring-effects-fast-duration) var(--m3-spring-effects-fast);
  }
  .on .plate {
    background: color-mix(in srgb, var(--qt-color) 16%, transparent);
    box-shadow: inset 0 0 0 1px transparent;
  }

  .ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: var(--qt-ring) solid var(--qt-color);
    opacity: 0;
    transition: opacity var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
    pointer-events: none;
  }
  .on .ring {
    opacity: 0.7;
  }
  /* A static ring competing with the sweeping arc reads as a fat blurry
     circle; dropping it to a faint track is what makes the arc legible. */
  .r-sweep .ring {
    opacity: 0.2;
  }
  .armed .ring,
  .emphasis.on .ring {
    opacity: 1;
  }

  /* The sweep arc: a conic gradient masked down to an annulus, so a single
     rotate keyframe moves a partial arc around the rim. A border can't do
     this (borders can't be partially transparent around the circumference)
     and SVG would need a second coordinate system for every size. */
  .arc {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    opacity: 0;
    background: conic-gradient(
      from 0deg,
      transparent 0deg,
      transparent 170deg,
      color-mix(in srgb, var(--qt-color) 35%, transparent) 250deg,
      var(--qt-color) 350deg,
      var(--qt-color) 360deg
    );
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - var(--qt-ring)), #000 0);
    mask: radial-gradient(farthest-side, transparent calc(100% - var(--qt-ring)), #000 0);
    pointer-events: none;
  }

  /* Press confirmation and the "flash" animation share this layer. */
  .flash {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: var(--qt-color);
    opacity: 0;
    pointer-events: none;
  }
  .flashing .flash {
    animation: qt-flash 700ms var(--m3-ease-emphasized) 1;
  }

  .glyph {
    position: relative;
    z-index: 2;
    color: var(--m3-on-surface-variant);
    /* --mdc-icon-size is what real HA's ha-icon sizes its glyph by; width
       and height alone leave the drawn icon at its own default. */
    --mdc-icon-size: var(--qt-glyph);
    width: var(--qt-glyph);
    height: var(--qt-glyph);
    min-width: var(--qt-glyph);
    min-height: var(--qt-glyph);
    /* Real ha-icon inherits surrounding line-height, which inflates its box
       asymmetrically and visibly off-centres the glyph inside a small
       circular badge. This flex + line-height:0 block is the fix (proven in
       pc-control's .icon-badge and garage-control's .header-btn); a
       transform nudge is not. Not reproducible in the dev harness. */
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    line-height: 0;
    transition: color var(--m3-spring-effects-default-duration) var(--m3-spring-effects-default);
  }
  .on .glyph {
    color: var(--qt-color);
  }
  .unavailable .glyph {
    opacity: 0.4;
  }
  .unavailable .plate {
    box-shadow: inset 0 0 0 1px var(--m3-outline);
  }

  .badge {
    position: absolute;
    z-index: 3;
    top: 1px;
    right: 1px;
    width: var(--qt-badge);
    height: var(--qt-badge);
    border-radius: 50%;
    background: var(--qt-badge-color, var(--qt-color));
    /* Halo in the card's own background so the dot stays separate from the
       ring it sits on top of. */
    box-shadow: 0 0 0 2px var(--m3-surface-container-low);
    pointer-events: none;
  }

  /* A badge carrying a value is a pill, not a dot: it grows to fit two or
     three characters and hangs off the rim so it covers as little of the
     glyph as possible. Anchored by its top-right corner, so widening pushes
     it leftward over the plate rather than into the next medallion. */
  .badge.badge-value {
    top: calc(var(--qt-badge) * -0.25);
    right: calc(var(--qt-badge) * -0.35);
    width: auto;
    min-width: calc(var(--qt-badge) * 1.75);
    height: calc(var(--qt-badge) * 1.75);
    padding: 0 calc(var(--qt-badge) * 0.28);
    border-radius: var(--m3-shape-full);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--qt-badge-text, #ffffff);
    font-size: calc(var(--qt-badge) * 1);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.02em;
    /* Digits shouldn't shuffle width as the value changes. */
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* ----------------------------------------------------- animation layers */

  .g-spin .glyph {
    animation: qt-spin 2.6s linear infinite;
  }
  .g-pulse .glyph {
    animation: qt-pulse 1.5s var(--m3-ease-emphasized) infinite;
  }
  .g-breathe .glyph {
    animation: qt-breathe 2.6s ease-in-out infinite;
  }
  .g-bounce .glyph {
    animation: qt-bounce 1.3s var(--m3-ease-emphasized) infinite;
  }
  .g-shake .glyph {
    animation: qt-shake 0.9s ease-in-out infinite;
  }

  .r-sweep .arc {
    opacity: 1;
    animation: qt-spin 1.35s linear infinite;
  }
  .r-pulse .ring {
    animation: qt-ring-pulse 1.5s var(--m3-ease-emphasized) infinite;
  }
  .r-breathe .ring {
    animation: qt-breathe 2.6s ease-in-out infinite;
  }
  .r-flash .arc {
    opacity: 1;
    animation: qt-flash 700ms var(--m3-ease-emphasized) 1;
  }

  .p-pulse .plate {
    animation: qt-pulse 1.6s var(--m3-ease-emphasized) infinite;
  }
  .p-breathe .glow {
    animation: qt-glow-breathe 3s ease-in-out infinite;
  }
  .p-flash .flash {
    animation: qt-flash 700ms var(--m3-ease-emphasized) 1;
  }
  /* Sheen rides inside .plate's overflow:hidden, so the diagonal highlight
     is clipped to the circle without needing its own mask. */
  .p-sheen .plate::after {
    content: "";
    position: absolute;
    inset: -30%;
    background: linear-gradient(
      115deg,
      transparent 38%,
      color-mix(in srgb, var(--qt-color) 55%, transparent) 50%,
      transparent 62%
    );
    animation: qt-sheen 2.4s linear infinite;
  }

  .b-pulse .badge {
    animation: qt-pulse 1.4s var(--m3-ease-emphasized) infinite;
  }
  .b-breathe .badge {
    animation: qt-breathe 1.9s ease-in-out infinite;
  }

  @keyframes qt-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes qt-pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.14);
    }
  }
  @keyframes qt-ring-pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.7;
    }
    50% {
      transform: scale(1.1);
      opacity: 0.25;
    }
  }
  @keyframes qt-breathe {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
  @keyframes qt-glow-breathe {
    0%,
    100% {
      opacity: var(--qt-glow, 0.5);
    }
    50% {
      opacity: calc(var(--qt-glow, 0.5) * 0.25);
    }
  }
  @keyframes qt-bounce {
    0%,
    55%,
    100% {
      transform: translateY(0);
    }
    25% {
      transform: translateY(-14%);
    }
  }
  @keyframes qt-shake {
    0%,
    100% {
      transform: rotate(0deg);
    }
    20% {
      transform: rotate(-8deg);
    }
    60% {
      transform: rotate(8deg);
    }
  }
  @keyframes qt-flash {
    0% {
      opacity: 0;
    }
    18% {
      opacity: 0.55;
    }
    100% {
      opacity: 0;
    }
  }
  @keyframes qt-sheen {
    0% {
      transform: translateX(-115%);
    }
    60%,
    100% {
      transform: translateX(115%);
    }
  }

  /* On a light plate the tint has to work harder to read as "on". */
  :host([data-theme="light"]) .on .plate {
    background: color-mix(in srgb, var(--qt-color) 22%, transparent);
  }
  :host([data-theme="light"]) .glow {
    box-shadow: 0 0 14px 0 var(--qt-color);
  }

  /* The state layer covers press for every medallion, on or off. Pointer
     hover is handled separately below because on touch :hover sticks after a
     tap and would leave the last-pressed medallion permanently lit. */
  .medallion.pressing .plate::before {
    opacity: var(--m3-state-pressed);
  }
  .unavailable .plate::before {
    opacity: 0 !important;
  }

  @media (hover: hover) {
    .slot:hover .medallion {
      transform: scale(1.07);
    }
    /* Press must still win over hover — same specificity otherwise, and this
       rule comes later. */
    .slot:hover .medallion.pressing {
      transform: scale(0.93);
    }
    /* One rule now covers what used to be three separate plate backgrounds
       (off, on, and the light-theme on variant): the state layer is already
       tinted with --qt-color, so it lifts an on medallion in its own colour
       and previews that colour on an off one. */
    .slot:hover .plate::before {
      opacity: var(--m3-state-hover);
    }
    /* Off medallions preview their own colour at a whisper, so hovering
       tells you what turning it on will look like. */
    .slot:hover .off .ring {
      opacity: 0.28;
    }
    .slot:hover .off .glyph {
      color: var(--m3-on-surface);
    }
    .slot:hover .on .glow {
      opacity: calc(var(--qt-glow, 0.5) + 0.25);
    }
    /* The hover preview must not out-specify the states that own the ring.
       After the first tap of a confirm: toggle the cursor is by definition
       still on the medallion, so the faint preview would replace the
       full-strength "tap again" ring at the one moment it matters. Same for
       the reduced-motion emphasis ring, which is standing in for animation
       that isn't allowed to run. */
    .slot:hover .medallion.armed .ring,
    .slot:hover .medallion.emphasis.on .ring {
      opacity: 1;
    }
    .slot:hover .medallion.armed .glyph {
      color: var(--qt-color);
    }

    /* An unavailable entity shouldn't advertise itself as ready to use. */
    .slot:hover .unavailable .ring {
      opacity: 0;
    }
  }

  /* Motion is dropped here, but resolveItems() has already substituted a
     static badge + full-strength ring for anything that would have been
     animating — with no text on the card, silence would otherwise mean the
     state simply disappears. */
  @media (prefers-reduced-motion: reduce) {
    .medallion,
    .glow,
    .plate,
    .plate::before,
    .ring,
    .glyph {
      transition: none;
    }
    .glyph,
    .ring,
    .arc,
    .plate,
    .badge,
    .flash,
    .plate::after {
      animation: none !important;
    }
  }
`;
