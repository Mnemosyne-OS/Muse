/**
 * Glyphs — line-art icons for Muse's chrome (doc 59, hairline design language).
 *
 * The chrome shipped emoji pictograms (🚀 🗑 🧠 📄 …): platform-styled stickers
 * that ignore the theme, differ between Windows and macOS, and read as template
 * output — "made-IA" at a glance. These are 12-grid stroke glyphs drawn on
 * `currentColor`, so they inherit each control's color and every hover/active
 * state for free, with no icon variants.
 *
 * Muse runs sandboxed in an iframe and cannot read the host's CSS variables, so
 * colors stay in the cartridge's own palette — the GRAMMAR is what carries over:
 * 12-grid, stroke-only, width 1.15-1.3, round caps, fills reserved for dots.
 *
 * Adding one: draw on the 12-grid, stroke `currentColor`, no fill except tiny
 * accents. Never reach for an emoji in chrome position.
 */
import type { CSSProperties } from 'react';

const g: CSSProperties = { flexShrink: 0, display: 'block' };

export interface GlyphProps { size?: number }

const Svg = ({ size = 12, children }: GlyphProps & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={g} aria-hidden="true">{children}</svg>
);

/* ── Creation lanes ──────────────────────────────────────────────────────── */

/** Auto — the router decides: a spark. */
export const GSpark = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M6 1.2l1.1 2.9 2.9 1.1-2.9 1.1L6 9.2 4.9 6.3 2 5.2l2.9-1.1z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    <path d="M9.9 8.6l.35.9.9.35-.9.35-.35.9-.35-.9-.9-.35.9-.35z" fill="currentColor" opacity="0.7" />
  </Svg>
);

/** Document — a sheet with a folded corner. */
export const GDoc = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M2.8 1.6h4l3 3v5.9a.9.9 0 0 1-.9.9H2.8a.9.9 0 0 1-.9-.9V2.5a.9.9 0 0 1 .9-.9z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    <path d="M6.6 1.7v3.1h3.1M4.2 7.2h3.6M4.2 9h2.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </Svg>
);

/** Site — a meridian globe. */
export const GGlobe = (p: GlyphProps) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="4.4" stroke="currentColor" strokeWidth="1.15" />
    <path d="M1.6 6h8.8M6 1.6c1.5 1.5 1.5 7.3 0 8.8-1.5-1.5-1.5-7.3 0-8.8z" stroke="currentColor" strokeWidth="1.1" />
  </Svg>
);

/** App — a cartridge/puzzle nub. */
export const GPuzzle = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M2 4.3h1.4a1.1 1.1 0 1 0 2.2 0H7a.8.8 0 0 1 .8.8v1.3a1.1 1.1 0 1 1 0 2.2v1.3a.8.8 0 0 1-.8.8H2.8a.8.8 0 0 1-.8-.8z"
      stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    <path d="M9.2 2h1.6M10 1.2v1.6" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" opacity="0.75" />
  </Svg>
);

/* ── Memory ──────────────────────────────────────────────────────────────── */

/** Memory — a neural node with its links. */
export const GMemory = (p: GlyphProps) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="1.6" stroke="currentColor" strokeWidth="1.15" />
    <circle cx="2" cy="2.6" r="1" stroke="currentColor" strokeWidth="1.05" />
    <circle cx="10" cy="3.2" r="1" stroke="currentColor" strokeWidth="1.05" />
    <circle cx="3.2" cy="9.8" r="1" stroke="currentColor" strokeWidth="1.05" />
    <path d="M2.8 3.3l1.9 1.7M9.2 3.9L7.4 5.2M4.1 9.1l1.2-1.6" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" />
  </Svg>
);

/** No memory — a slashed circle. */
export const GBan = (p: GlyphProps) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="4.4" stroke="currentColor" strokeWidth="1.15" />
    <path d="M2.9 2.9l6.2 6.2" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
  </Svg>
);

/** Pick — tune sliders. */
export const GSliders = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M1.6 3.8h8.8M1.6 8.2h8.8" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    <circle cx="4.3" cy="3.8" r="1.5" stroke="currentColor" strokeWidth="1.15" fill="#0d1526" />
    <circle cx="7.7" cy="8.2" r="1.5" stroke="currentColor" strokeWidth="1.15" fill="#0d1526" />
  </Svg>
);

/** Protected vault — a closed padlock. */
export const GLock = (p: GlyphProps) => (
  <Svg {...p}>
    <rect x="2.4" y="5.2" width="7.2" height="5.2" rx="1.1" stroke="currentColor" strokeWidth="1.15" />
    <path d="M4.2 5.1V3.9a1.8 1.8 0 0 1 3.6 0v1.2" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
  </Svg>
);

/* ── Actions ─────────────────────────────────────────────────────────────── */

/** Launch — a rocket silhouette. */
export const GLaunch = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M6 1.3c1.7 1.3 2.6 3.2 2.6 5.2L6 8.9 3.4 6.5c0-2 .9-3.9 2.6-5.2z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    <path d="M4.6 8.2l-1.3 2.4 2.1-.9M7.4 8.2l1.3 2.4-2.1-.9" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    <circle cx="6" cy="4.7" r="0.85" fill="currentColor" opacity="0.85" />
  </Svg>
);

/** Delete — a lidded bin. */
export const GTrash = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M1.8 3.2h8.4M4.6 3.1V2a.8.8 0 0 1 .8-.8h1.2a.8.8 0 0 1 .8.8v1.1" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    <path d="M2.9 3.2l.5 6.6a.9.9 0 0 0 .9.9h3.4a.9.9 0 0 0 .9-.9l.5-6.6" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    <path d="M5 5.3v3M7 5.3v3" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" opacity="0.8" />
  </Svg>
);

/** Save to disk — an arrow into a tray. */
export const GSave = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M6 1.6v5.6M3.8 5.2L6 7.4l2.2-2.2" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1.9 8.2v1.3a.9.9 0 0 0 .9.9h6.4a.9.9 0 0 0 .9-.9V8.2" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
  </Svg>
);

/** Print / open externally — a sheet leaving the frame. */
export const GPrint = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M3.6 4.3V2.1h4.8v2.2" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    <rect x="1.7" y="4.3" width="8.6" height="3.9" rx="1" stroke="currentColor" strokeWidth="1.15" />
    <path d="M3.6 7.6h4.8v2.4H3.6z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" fill="#0d1526" />
    <circle cx="8.6" cy="5.9" r="0.55" fill="currentColor" />
  </Svg>
);

/** Regenerate — a circular arrow. */
export const GRefresh = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M10 6a4 4 0 1 1-1.3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M10.3 1.5v2.2H8.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Truth pass — a shield. */
export const GShield = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M6 1.4l3.6 1.5v3.3c0 2.1-1.5 3.6-3.6 4.4-2.1-.8-3.6-2.3-3.6-4.4V2.9z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    <path d="M4.4 6.1l1.2 1.2 2.1-2.4" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Folder. */
export const GFolder = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M1.7 3.4a.9.9 0 0 1 .9-.9h2l1.2 1.4h4.5a.9.9 0 0 1 .9.9v4.4a.9.9 0 0 1-.9.9H2.6a.9.9 0 0 1-.9-.9z"
      stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
  </Svg>
);

/** Versions — a clock. */
export const GClock = (p: GlyphProps) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="4.4" stroke="currentColor" strokeWidth="1.15" />
    <path d="M6 3.4V6l1.9 1.2" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Cost — a card with its stripe. */
export const GCost = (p: GlyphProps) => (
  <Svg {...p}>
    <rect x="1.4" y="2.9" width="9.2" height="6.2" rx="1.1" stroke="currentColor" strokeWidth="1.15" />
    <path d="M1.5 5.1h9M3.4 7.4h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </Svg>
);

/** Back — an arrow to the left. */
export const GBack = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M10 6H2.3M5.3 2.9L2.2 6l3.1 3.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Forward — an arrow to the right (row affordance). */
export const GForward = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M2 6h7.7M6.7 2.9L9.8 6l-3.1 3.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Close. */
export const GClose = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M2.9 2.9l6.2 6.2M9.1 2.9L2.9 9.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </Svg>
);

/** Check — selection mark (inside the hairline box). */
export const GCheck = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M2.4 6.3l2.5 2.5 4.7-5.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Copy — two stacked frames. */
export const GCopy = (p: GlyphProps) => (
  <Svg {...p}>
    <rect x="1.6" y="1.6" width="6.2" height="6.2" rx="1.1" stroke="currentColor" strokeWidth="1.15" />
    <path d="M4.2 10.4h5a1.2 1.2 0 0 0 1.2-1.2v-5" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
  </Svg>
);

/** View — an eye. */
export const GEye = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M0.9 6S2.9 2.6 6 2.6 11.1 6 11.1 6 9.1 9.4 6 9.4 0.9 6 0.9 6z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.15" />
  </Svg>
);

/** Play — run the built app. */
export const GPlay = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M3.5 2.2l6.2 3.8-6.2 3.8z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
  </Svg>
);

/** Design — a palette. */
export const GPalette = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M6 1.5a4.5 4.5 0 0 0 0 9c.7 0 1.1-.5 1.1-1 0-.6-.5-.9-.5-1.4 0-.4.4-.8.9-.8h1a2.5 2.5 0 0 0 2.5-2.5C11 2.9 8.8 1.5 6 1.5z"
      stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    <circle cx="4" cy="4.4" r="0.7" fill="currentColor" opacity="0.85" />
    <circle cx="6.4" cy="3.4" r="0.7" fill="currentColor" opacity="0.6" />
  </Svg>
);

/** Book — the doc library. */
export const GBook = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M1.8 2.4h2.9c.8 0 1.3.4 1.3 1v6.2c0-.5-.5-1-1.3-1H1.8z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    <path d="M10.2 2.4H7.3c-.8 0-1.3.4-1.3 1v6.2c0-.5.5-1 1.3-1h2.9z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
  </Svg>
);

/** Framing — a compass, the step that sets the direction. */
export const GCompass = (p: GlyphProps) => (
  <Svg {...p}>
    <circle cx="6" cy="6" r="4.4" stroke="currentColor" strokeWidth="1.15" />
    <path d="M7.9 4.1L6.7 6.7 4.1 7.9 5.3 5.3z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
  </Svg>
);

/** Artifacts — a drafting square. */
export const GDraft = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M1.7 9.9L6 1.6l4.3 8.3z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
    <path d="M3.6 7.4h4.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
  </Svg>
);

/** Hand-off — a link between two rings. */
export const GHandoff = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M5 7.4L7.4 5a1.9 1.9 0 0 1 2.7 2.7l-1 1a1.9 1.9 0 0 1-2.7 0" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    <path d="M7 4.6L4.6 7a1.9 1.9 0 0 1-2.7-2.7l1-1A1.9 1.9 0 0 1 5.6 3.3" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
  </Svg>
);

/** Build — a hammer. */
export const GBuild = (p: GlyphProps) => (
  <Svg {...p}>
    <path d="M2.2 10.3l4.3-4.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M5.9 4.4l1.7-1.7 1 1 1.4-1.4-2.4-.9-2.4.9-1 1z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round" />
  </Svg>
);
