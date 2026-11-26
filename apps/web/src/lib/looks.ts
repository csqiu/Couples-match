/**
 * Looks: a font pairing plus a color palette. The default is Technical + Sage & Plum
 * (docs/design-spec.md); the theme warm-up (/warmup) lets a person rank the others.
 * Every look is CSS tokens only (globals.css: [data-font] and [data-palette]), so any
 * element can show any look, and the whole page switches by setting two attributes on
 * <html>. Light and dark mode stay separate (components/theme-toggle.tsx).
 */

export const FONTS = [
  { id: 'quirky', name: 'Quirky modern', faces: 'Bricolage Grotesque and Inter', blurb: 'Characterful headings, calm text.' },
  { id: 'bookish', name: 'Bookish & handmade', faces: 'Young Serif and Karla', blurb: 'Like a shared notebook.' },
  { id: 'tech', name: 'Technical', faces: 'Space Grotesk and IBM Plex', blurb: 'Precise and engineered.' },
  { id: 'wide', name: 'Wide & playful', faces: 'Unbounded and Albert Sans', blurb: 'Energetic and current.' },
] as const;

export const PALETTES = [
  { id: 'sageplum', name: 'Sage & Plum', blurb: 'Muted botanicals. Grown-up and soothing.' },
  { id: 'scrubs', name: 'Scrubs', blurb: 'Ceil blue and teal from the wards.' },
  { id: 'paperpencil', name: 'Paper & Pencil', blurb: 'Graphite with blue and red pencil, like working it out on paper.' },
  { id: 'sunset', name: 'Sunset Commute', blurb: 'Tangerine and violet. Warm and hopeful.' },
] as const;

export type FontId = (typeof FONTS)[number]['id'];
export type PaletteId = (typeof PALETTES)[number]['id'];
export interface Look {
  font: FontId;
  palette: PaletteId;
}
/** "tech.sageplum" */
export type LookId = `${FontId}.${PaletteId}`;

export const DEFAULT_LOOK: Look = { font: 'tech', palette: 'sageplum' };

const FONT_IDS = new Set<string>(FONTS.map((f) => f.id));
const PALETTE_IDS = new Set<string>(PALETTES.map((p) => p.id));

export const isFontId = (s: unknown): s is FontId => typeof s === 'string' && FONT_IDS.has(s);
export const isPaletteId = (s: unknown): s is PaletteId => typeof s === 'string' && PALETTE_IDS.has(s);

export function lookId(look: Look): LookId {
  return `${look.font}.${look.palette}`;
}

export function parseLookId(s: unknown): Look | null {
  if (typeof s !== 'string') return null;
  const [font, palette] = s.split('.');
  return isFontId(font) && isPaletteId(palette) ? { font, palette } : null;
}

export const fontOf = (id: FontId) => FONTS.find((f) => f.id === id)!;
export const paletteOf = (id: PaletteId) => PALETTES.find((p) => p.id === id)!;
export const lookName = (look: Look) => `${fontOf(look.font).name} · ${paletteOf(look.palette).name}`;

// ---------------------------------------------------------------------------
// Saved on this device

/** The look in use. */
export const LOOK_KEY = 'pairwise-look';
/** The ranked list from the last finished warm-up. */
export const LOOK_LIST_KEY = 'pairwise-look-list';
/** An unfinished warm-up, so a refresh keeps your place. */
export const WARMUP_KEY = 'pairwise-warmup';

export interface SavedLookList {
  order: LookId[];
  fonts: FontId[];
  palettes: PaletteId[];
  /** ISO date the warm-up was finished. */
  at: string;
}

/** Runs in <head> before the page paints, so a saved look never flashes the default first. */
export const lookScript = `(() => { try {
  const v = (localStorage.getItem('${LOOK_KEY}') || '').split('.');
  const f = ${JSON.stringify([...FONT_IDS])}, p = ${JSON.stringify([...PALETTE_IDS])};
  if (f.includes(v[0]) && p.includes(v[1])) {
    document.documentElement.dataset.font = v[0];
    document.documentElement.dataset.palette = v[1];
  }
} catch {} })();`;

function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or storage blocked: the look still applies for this page view.
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The look saved on this device (the default when none is). */
export function savedLook(): Look {
  return parseLookId(read(LOOK_KEY)) ?? DEFAULT_LOOK;
}

/** Switch the whole app to a look and remember it on this device. */
export function applyLook(look: Look) {
  const root = document.documentElement;
  root.dataset.font = look.font;
  root.dataset.palette = look.palette;
  store(LOOK_KEY, lookId(look));
  window.dispatchEvent(new Event('pairwise-look'));
}

export function savedLookList(): SavedLookList | null {
  const raw = read(LOOK_LIST_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as SavedLookList;
    const order = (v.order ?? []).filter((id) => parseLookId(id)) as LookId[];
    return order.length ? { ...v, order } : null;
  } catch {
    return null;
  }
}

export function saveLookList(list: SavedLookList) {
  store(LOOK_LIST_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('pairwise-look'));
}

export function readWarmupProgress<T>(): T | null {
  const raw = read(WARMUP_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveWarmupProgress(value: unknown | null) {
  store(WARMUP_KEY, value === null ? null : JSON.stringify(value));
}
