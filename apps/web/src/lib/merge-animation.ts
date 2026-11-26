/**
 * The landing page's background animation: two lists (one per partner) fill in, link,
 * slide together into one list of pairs, multiply, and shuffle. Pure: given a step and
 * the screen size, where every row is. Drawn by components/merge-backdrop.tsx.
 */

/** How long each step lasts (ms, at pace 1). */
export const BEATS = [350, 170, 170, 170, 170, 420, 650, 780, 260, 800, 450, 820, 820, 820, 820, 820, 700, 700];
/** The step shown when motion is reduced: the merged list, multiplied. */
export const STILL_STEP = 10;

// Pair k is row MAKEUP[k][0] of the first list with row MAKEUP[k][1] of the second.
const MAKEUP: Array<[number, number]> = [[0, 0], [1, 2], [2, 1], [3, 4], [4, 3], [0, 1], [1, 0], [2, 3], [3, 2], [0, 2]];
const SHUFFLES = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 0, 5, 2, 3, 7, 4, 6, 9, 8],
  [5, 1, 0, 7, 2, 9, 3, 4, 8, 6],
  [5, 7, 1, 0, 9, 2, 4, 3, 6, 8],
  [7, 5, 9, 1, 2, 0, 4, 6, 3, 8],
  [7, 9, 5, 2, 1, 4, 0, 6, 8, 3],
];

export interface Geometry {
  /** Left edge of each partner's list, and their rows' size and spacing. */
  lx: number;
  rx: number;
  sw: number;
  sh: number;
  sstep: number;
  stop: number;
  /** The merged list: left edge, width, row height and spacing. */
  px: number;
  pw: number;
  ph: number;
  pstep: number;
  ptop: number;
  radius: number;
  font: number;
}

/** Wide screens: the lists start at both edges and meet right of centre (the panel is on the left). Narrow: below the panel. */
export function geometry(w: number, h: number): Geometry {
  if (w < 768) {
    const sw = Math.round((w - 70) / 2);
    const ptop = Math.max(Math.round(h * 0.6), 470);
    return { lx: 22, rx: w - 22 - sw, sw, sh: 26, sstep: 32, stop: ptop + 28, px: 24, pw: w - 48, ph: 24, pstep: 28, ptop, radius: 8, font: 10 };
  }
  const pw = Math.round(Math.min(520, Math.max(380, w * 0.34)));
  const px = Math.round(Math.min(w - pw - 48, w * 0.56));
  return { lx: 32, rx: w - 32 - 240, sw: 240, sh: 40, sstep: 52, stop: Math.round(h / 2 - 125), px, pw, ph: 38, pstep: 50, ptop: Math.round(h / 2 - 244), radius: 12, font: 13 };
}

export interface RowFrame {
  x: number;
  y: number;
  /** Scale while a single row shrinks into its half of a pair. */
  sx: number;
  sy: number;
  visible: boolean;
  /** Rank shown on the row. */
  n: number;
}

export interface Frame {
  /** The two lists: [first partner's rows, second partner's rows]. */
  singles: [RowFrame[], RowFrame[]];
  linksOn: boolean;
  /** Link curves, first-list row to second-list row (for the moment before merging). */
  links: Array<{ y1: number; y2: number }>;
  pairs: Array<RowFrame & { left: number; right: number }>;
}

export function frame(step: number, g: Geometry): Frame {
  const s = ((step % BEATS.length) + BEATS.length) % BEATS.length;
  const shownSingles = s === 0 ? 0 : Math.min(5, s);
  const together = s >= 7;
  const singlesOn = s >= 1 && s <= 7;
  const shownPairs = s < 8 || s >= 17 ? 0 : s === 8 ? 5 : 10;
  const order = SHUFFLES[s >= 11 && s <= 16 ? Math.min(5, s - 10) : 0];
  const sy = (i: number) => g.stop + i * g.sstep;
  const py = (slot: number) => g.ptop + slot * g.pstep;
  const half = g.pw / 2;

  const singles = ([0, 1] as const).map((side) =>
    [0, 1, 2, 3, 4].map((i): RowFrame => {
      const k = MAKEUP.findIndex((m, idx) => idx < 5 && m[side] === i);
      const shown = i < shownSingles;
      return {
        x: together ? g.px + side * half : side === 0 ? g.lx : g.rx,
        y: together ? py(k) : sy(i) + (shown ? 0 : 14),
        sx: together ? half / g.sw : 1,
        sy: together ? g.ph / g.sh : 1,
        visible: shown && singlesOn,
        n: i + 1,
      };
    }),
  ) as [RowFrame[], RowFrame[]];

  const pairs = MAKEUP.map(([left, right], id) => {
    const slot = order.indexOf(id);
    const visible = id < shownPairs;
    // The first five appear where their halves met; the rest glide out of the pair they split from.
    const from = id < 5 ? py(id) : py(id - 5);
    return { x: g.px, y: visible ? py(slot) : from, sx: 1, sy: 1, visible, n: slot + 1, left, right };
  });

  return {
    singles,
    linksOn: s === 6,
    links: MAKEUP.slice(0, 5).map(([l, r]) => ({ y1: sy(l) + g.sh / 2, y2: sy(r) + g.sh / 2 })),
    pairs,
  };
}
