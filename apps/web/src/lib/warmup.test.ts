import { describe, expect, it } from 'vitest';
import type { FontId, PaletteId } from './looks';
import { runWarmup, toLookId, WARMUP_MAX_QUESTIONS, type WarmupAnswer } from './warmup';

const fonts: FontId[] = ['quirky', 'bookish', 'tech', 'wide'];
const palettes: PaletteId[] = ['sageplum', 'scrubs', 'paperpencil', 'sunset'];
const id = (l: { font: FontId; palette: PaletteId }) => toLookId(l);

describe('theme warm-up on the engine', () => {
  it('ranks all 16 looks with both favourites first (the common-sense rule)', () => {
    const r = runWarmup({ fonts, palettes, answers: [] });
    expect(r.order).toHaveLength(16);
    expect(new Set(r.order.map(id)).size).toBe(16);
    expect(id(r.order[0])).toBe('quirky.sageplum');
    expect(id(r.order[15])).toBe('wide.sunset');
    expect(r.settledByRule).toBeGreaterThan(0);
  });

  it('never lets a look rank above one that is better on both counts', () => {
    const r = runWarmup({ fonts, palettes, answers: [] });
    const pos = new Map(r.order.map((l, i) => [id(l), i]));
    for (const a of r.order) {
      for (const b of r.order) {
        if (fonts.indexOf(a.font) <= fonts.indexOf(b.font) && palettes.indexOf(a.palette) <= palettes.indexOf(b.palette) && id(a) !== id(b)) {
          expect(pos.get(id(a))!).toBeLessThan(pos.get(id(b))!);
        }
      }
    }
  });

  it('asks a real trade-off: one look better on font, the other on colors', () => {
    const q = runWarmup({ fonts, palettes, answers: [] }).question!;
    expect(q).not.toBeNull();
    const fontBetter = fonts.indexOf(q.left.font) < fonts.indexOf(q.right.font);
    const colorBetter = palettes.indexOf(q.left.palette) < palettes.indexOf(q.right.palette);
    expect(fontBetter).not.toBe(colorBetter);
  });

  it('learns from answers: always picking the better colors puts colors first', () => {
    const answers: WarmupAnswer[] = [];
    for (let i = 0; i < WARMUP_MAX_QUESTIONS; i++) {
      const r = runWarmup({ fonts, palettes, answers });
      if (!r.question) break;
      const { left, right } = r.question;
      const leftColorBetter = palettes.indexOf(left.palette) < palettes.indexOf(right.palette);
      answers.push({ left: id(left), right: id(right), winner: leftColorBetter ? 'left' : 'right' });
    }
    const r = runWarmup({ fonts, palettes, answers });
    const pos = new Map(r.order.map((l, i) => [id(l), i]));
    // Font #4 in color #1 now beats font #1 in color #3.
    expect(pos.get('wide.sageplum')!).toBeLessThan(pos.get('quirky.paperpencil')!);
    expect(r.answered).toBe(answers.length);
  });

  it('stops after the question cap', () => {
    let answers: WarmupAnswer[] = [];
    for (let i = 0; i < WARMUP_MAX_QUESTIONS; i++) {
      const q = runWarmup({ fonts, palettes, answers }).question;
      if (!q) break;
      answers = [...answers, { left: id(q.left), right: id(q.right), winner: 'tie' }];
    }
    expect(runWarmup({ fonts, palettes, answers }).question).toBeNull();
  });
});
