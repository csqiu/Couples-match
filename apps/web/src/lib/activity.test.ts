import { describe, expect, it } from 'vitest';
import { describeActivity, type ActivityEvent } from './activity';

let id = 0;
const ev = (type: string, user: string | null, at: string, payload: Record<string, unknown> = { count: 1 }): ActivityEvent => ({
  id: ++id,
  type,
  user_id: user,
  created_at: at,
  payload: payload as ActivityEvent['payload'],
});
const names = { a: 'Alex', b: 'Sam' };

describe('activity feed', () => {
  it('folds bursts by the same person into one line, newest first', () => {
    const items = describeActivity(
      [
        ev('individual_ranks.update', 'a', '2026-11-20T10:00:00Z', { count: 3 }),
        ev('individual_ranks.update', 'a', '2026-11-20T10:05:00Z', { count: 2 }),
        ev('comparisons.insert', 'b', '2026-11-20T10:06:00Z'),
        ev('individual_ranks.update', 'a', '2026-11-20T12:00:00Z', { count: 1 }),
      ],
      names,
    );
    expect(items.map((i) => `${i.who} ${i.text}`)).toEqual([
      'Alex reordered or edited their list (1 change)',
      'Sam answered 1 “this or that” question',
      'Alex reordered or edited their list (5 changes)',
    ]);
    expect(items[2].events).toBe(2);
  });

  it('names settings, restores and unknown people', () => {
    const items = describeActivity(
      [
        ev('couples.settings', 'b', '2026-11-20T10:00:00Z', { changed: ['privacy', 'distanceBands'] }),
        ev('list_versions.restored', 'a', '2026-11-20T11:00:00Z', { name: 'Before interviews' }),
        ev('comparisons.delete', null, '2026-11-20T12:00:00Z'),
        ev('individual_ranks.update', 'admin-id', '2026-11-20T13:00:00Z'),
      ],
      names,
    );
    expect(items.map((i) => `${i.who} ${i.text}`)).toEqual([
      'An admin merged a duplicate program into the listed one; your lists and answers moved across',
      'Someone took back 1 answer',
      'Alex restored the version “Before interviews”',
      'Sam changed tier privacy and the distance bands',
    ]);
  });
});
