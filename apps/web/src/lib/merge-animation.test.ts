import { describe, expect, it } from 'vitest';
import { BEATS, frame, geometry, STILL_STEP } from './merge-animation';

const g = geometry(1440, 900);

describe('landing animation', () => {
  it('fills both lists one row at a time', () => {
    expect(frame(0, g).singles[0].filter((r) => r.visible)).toHaveLength(0);
    expect(frame(3, g).singles[0].filter((r) => r.visible)).toHaveLength(3);
    expect(frame(5, g).singles[1].filter((r) => r.visible)).toHaveLength(5);
  });

  it('starts the lists at both edges of a wide screen', () => {
    const f = frame(5, g);
    expect(f.singles[0][0].x).toBe(32);
    expect(f.singles[1][0].x + g.sw).toBe(1440 - 32);
  });

  it('slides each row onto its half of a pair, then shows the pairs there', () => {
    const merging = frame(7, g);
    const pairs = frame(8, g);
    const first = pairs.pairs[0];
    expect(merging.singles[0][0]).toMatchObject({ x: first.x, y: first.y });
    expect(merging.singles[1][0]).toMatchObject({ x: first.x + g.pw / 2, y: first.y });
    expect(pairs.pairs.filter((p) => p.visible)).toHaveLength(5);
    expect(frame(9, g).pairs.filter((p) => p.visible)).toHaveLength(10);
  });

  it('shuffles: every pair keeps a distinct rank', () => {
    for (let s = 11; s <= 15; s++) {
      const ranks = frame(s, g).pairs.map((p) => p.n);
      expect(new Set(ranks).size).toBe(10);
    }
    expect(frame(11, g).pairs.map((p) => p.n)).not.toEqual(frame(12, g).pairs.map((p) => p.n));
  });

  it('loops, and the reduced-motion still frame shows the full merged list', () => {
    expect(frame(BEATS.length, g)).toEqual(frame(0, g));
    expect(frame(STILL_STEP, g).pairs.every((p) => p.visible)).toBe(true);
  });

  it('puts everything below the panel on a phone', () => {
    const p = geometry(390, 844);
    expect(p.ptop).toBeGreaterThan(400);
    expect(p.px + p.pw).toBeLessThanOrEqual(390);
  });
});
