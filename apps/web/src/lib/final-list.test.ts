import { matchOutcome, NO_MATCH, type ProgramRef } from '@pairwise/engine';
import { describe, expect, it } from 'vitest';
import { toCsv } from './csv-export';
import { checkMove, checklistFor, computeFinalList, feesFor, RANK_LIMIT, type ListRow } from './final-list';
import { couple, names } from './test-fixtures';

const opts = { names, matchType: 'main' as const };

describe('final list', () => {
  const data = couple({ settings: { tierAPriority: 'partner1' } });
  const list = computeFinalList(data, opts);

  it('orders every pair, explains each row, and keeps No Match at the bottom', () => {
    expect(list.rows).toHaveLength(5 * 5 - 1);
    expect(list.rows.map((r) => r.rank)).toEqual(list.rows.map((_, i) => i + 1));
    expect(list.rows[0].why).toBe('This is the top of your list.');
    for (const r of list.rows.slice(1)) expect(r.why.length).toBeGreaterThan(10);
    const firstNoMatch = list.rows.findIndex((r) => r.band === 'no_match');
    expect(list.rows.slice(firstNoMatch).every((r) => r.band === 'no_match')).toBe(true);
    expect(list.rows.find((r) => r.sides[1].id === 'NO_MATCH')?.sides[1].code).toBe('999999999');
  });

  it('estimates fees for any length, with the tier warning near a boundary', () => {
    const rows: ListRow[] = Array.from({ length: 152 }, (_, i) => ({
      ...list.rows[0],
      rank: i + 1,
      pairId: `p${i}`,
      sides: [{ ...list.rows[0].sides[0], id: `a${i % 25}` }, { ...list.rows[0].sides[1], id: `b${i % 10}` }],
    }));
    const f = feesFor(rows, 152);
    expect(f.partners[0]).toMatchObject({ uniqueCodes: 25, extraRankFeeUsd: 150, lengthFeeUsd: 100, couplesFeeUsd: 45, totalUsd: 295 });
    expect(f.partners[1]).toMatchObject({ uniqueCodes: 10, extraRankFeeUsd: 0 });
    expect(f.tierWarning).toEqual({ pairsToCut: 2, saveUsdPerPartner: 50 });
    expect(feesFor(rows, 99).partners[0].lengthFeeUsd).toBe(0);
  });

  it('the checklist flags missing NRMP codes per partner', () => {
    const items = checklistFor(list.rows, list.length, names, false);
    expect(items.find((i) => i.label.startsWith('Alex'))?.ok).toBe(false);
    const withCodes = list.rows.map((r) => ({ ...r, sides: r.sides.map((s) => ({ ...s, code: s.code || '1234140C0' })) as ListRow['sides'] }));
    expect(checklistFor(withCodes, list.length, names, false).every((i) => i.ok)).toBe(true);
  });

  it('a drag that breaks a hard rule is blocked with a reason; an allowed one becomes a pin', () => {
    const top = list.rows[0].pairId;
    const last = list.rows[list.rows.length - 1].pairId; // a No Match pair
    const blocked = checkMove(data, last, top, names);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.blocking[0].text).toMatch(/because/);

    // Two adjacent pairs ordered only by score can be swapped.
    const free = list.rows.findIndex((r, i) => i > 0 && /fits your answers better/.test(r.why));
    expect(free).toBeGreaterThan(0);
    const ok = checkMove(data, list.rows[free].pairId, list.rows[free - 1].pairId, names);
    expect(ok).toEqual({ ok: true, pin: { higher: list.rows[free].pairId, lower: list.rows[free - 1].pairId, source: 'manual_drag', moved: 'higher' } });
  });

  it('exports CSV with both partners’ programs and codes', () => {
    const csv = toCsv(list.rows.slice(0, 2), names);
    const [header, first] = csv.trim().split('\n');
    expect(header).toBe('Rank,Alex program,Alex NRMP code,Sam program,Sam NRMP code,Distance (mi),Band');
    expect(first.startsWith('1,')).toBe(true);
  });

  it('No Match rows are locked at the end as 1–NM, 2–NM, …, NM–1, NM–2, …', () => {
    const nm = list.rows.filter((r) => r.band === 'no_match');
    expect(nm.every((r) => r.locked)).toBe(true);
    expect(nm.map((r) => (r.sides[1].id === 'NO_MATCH' ? `a${r.sides[0].id}` : `b${r.sides[1].id}`))).toEqual([
      ...data.ranks.filter((r) => r.user_id === 'user-a').map((r) => `a${r.program_id}`),
      ...data.ranks.filter((r) => r.user_id === 'user-b').map((r) => `b${r.program_id}`),
    ]);
    expect(list.rows.slice(-nm.length)).toEqual(nm);
    expect(list.rows.some((r) => r.sides[0].id === 'NO_MATCH' && r.sides[1].id === 'NO_MATCH')).toBe(false);
    const unlocked = computeFinalList(couple({ settings: { tierAPriority: 'partner1', noMatchUnlocked: true } }), opts);
    expect(unlocked.noMatchLocked).toBe(false);
    expect(unlocked.rows.some((r) => r.locked)).toBe(false);
  });

  it('a shorter length cuts both-match pairs; they show in "Not on your list" and can be added back', () => {
    const short = computeFinalList(couple({ settings: { tierAPriority: 'partner1', listLength: 12 } }), opts);
    expect(short.target).toBe(12);
    expect(short.rows).toHaveLength(12); // 4 both-match pairs + 8 No Match rows
    expect(short.rows.filter((r) => r.band !== 'no_match')).toHaveLength(4);
    expect(short.available).toHaveLength(16 - 4);
    const pick = short.available[3].pairId;
    const withPick = computeFinalList(couple({ settings: { tierAPriority: 'partner1', listLength: 12, includedPairs: [pick] } }), opts);
    expect(withPick.rows).toHaveLength(13);
    expect(withPick.rows.find((r) => r.pairId === pick)?.added).toBe(true);
    expect(withPick.available.some((p) => p.pairId === pick)).toBe(false);
  });

  it('the checklist flags rows that can never be the match', () => {
    expect(checklistFor(list.rows, list.length, names, false).find((i) => i.label === 'Every row can be your match')?.ok).toBe(true);
    // Move a (program, No Match) row above a both-match row with the same program for partner 1.
    const nm = list.rows.find((r) => r.sides[1].id === NO_MATCH && r.sides[0].id !== NO_MATCH)!;
    const victim = list.rows.find((r) => r.band !== 'no_match' && r.sides[0].id === nm.sides[0].id)!;
    const rows = [nm, ...list.rows.filter((r) => r !== nm)].map((r, i) => ({ ...r, rank: i + 1 }));
    const item = checklistFor(rows, rows.length, names, false).find((i) => i.label === 'Every row can be your match')!;
    expect(item.ok).toBe(false);
    expect(item.detail).toContain(`(${victim.sides[0].short} + ${victim.sides[1].short}) can’t be reached, because #1 (${nm.sides[0].short} + No Match) always works first`);
  });

  it('pairs added past the limit make the list longer than 300; only the first 300 count', () => {
    const fake = (i: number): ListRow => ({ ...list.rows[0], rank: i + 1, pairId: `p${i}` });
    const rows = Array.from({ length: RANK_LIMIT + 12 }, (_, i) => fake(i));
    const items = checklistFor(rows, RANK_LIMIT, names, false);
    expect(items.find((i) => i.label.includes(`${RANK_LIMIT}-rank limit`))).toMatchObject({ ok: false });
    expect(feesFor(rows, RANK_LIMIT).ranks).toBe(RANK_LIMIT);
  });

  it('shows a tidier order that matches exactly the same way as the engine order', () => {
    const pairs = (l: typeof list) => l.rows.map((r) => [r.sides[0].id, r.sides[1].id] as [ProgramRef, ProgramRef]);
    const engine = computeFinalList(couple({ settings: { tierAPriority: 'partner1', listOrder: 'engine' } }), opts);
    expect(engine.order).toBe('engine');
    expect(engine.tidied).toBe(0);
    for (const order of ['partner1', 'partner2', 'balanced'] as const) {
      const tidy = computeFinalList(couple({ settings: { tierAPriority: 'partner1', listOrder: order } }), opts);
      expect(tidy.order).toBe(order);
      // Every combination of reachable programs gives the same match.
      const p1 = tidy.programs[0].map((p) => p.id);
      const p2 = tidy.programs[1].map((p) => p.id);
      for (let m1 = 0; m1 < 1 << p1.length; m1++) {
        for (let m2 = 0; m2 < 1 << p2.length; m2++) {
          const reach = { partners: [new Set(p1.filter((_, i) => m1 & (1 << i))), new Set(p2.filter((_, i) => m2 & (1 << i)))] as [Set<string>, Set<string>] };
          const a = matchOutcome(pairs(engine), reach);
          const b = matchOutcome(pairs(tidy), reach);
          expect(a === -1 ? null : engine.rows[a].pairId).toBe(b === -1 ? null : tidy.rows[b].pairId);
        }
      }
      for (const r of tidy.rows.slice(1)) expect(r.why.length).toBeGreaterThan(10);
    }
  });

  it('lists each partner’s programs in their own order for the simulator', () => {
    expect(list.programs[0].map((p) => p.rank)).toEqual(list.programs[0].map((_, i) => i + 1));
    expect(list.programs[1]).toHaveLength(4);
  });
});

