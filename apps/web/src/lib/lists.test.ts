import { describe, expect, it } from 'vitest';
import { continueStep, countsFromDraft, listTitle, nextVersionLabel, stepStatus, versionLabel } from './lists';

describe('list and version labels', () => {
  it('numbers versions X.Y', () => {
    expect(versionLabel(2, 3)).toBe('2.3');
    expect(nextVersionLabel(3, 0)).toBe('3.1');
    expect(nextVersionLabel(3, 1)).toBe('3.2');
  });
  it('titles lists with or without a name', () => {
    expect(listTitle({ number: 1, name: null })).toBe('List 1');
    expect(listTitle({ number: 3, name: 'After interviews' })).toBe('List 3 · After interviews');
  });
});

describe('dashboard summaries', () => {
  const people = [
    { id: 'a', name: 'Alex' },
    { id: 'b', name: 'Jordan' },
  ];
  it('counts a parked draft', () => {
    const counts = countsFromDraft({ ranks: [{ userId: 'a' }, { userId: 'a' }, { userId: 'b' }], comparisons: [{}, {}], exceptions: [{}] });
    expect(counts).toEqual({ programs: { a: 2, b: 1 }, answers: 2, resolved: 1 });
    expect(countsFromDraft(null)).toEqual({ programs: {}, answers: 0, resolved: 0 });
  });
  it('describes each step', () => {
    expect(stepStatus({ programs: { a: 3 }, answers: 1, resolved: 0 }, people, null)).toEqual({
      rank: 'Alex ranked',
      compare: '1 answer',
      conflicts: 'Check for conflicts',
      list: 'Not saved yet',
    });
    expect(stepStatus({ programs: { a: 3, b: 2 }, answers: 0, resolved: 2 }, people, 156).rank).toBe('Both ranked');
    expect(stepStatus({ programs: { a: 3, b: 2 }, answers: 0, resolved: 2 }, people, 156).list).toBe('Last saved: 156 pairs');
  });
  it('continues at the furthest step reached', () => {
    expect(continueStep({ programs: {}, answers: 0, resolved: 0 }, 0)).toBe('rank');
    expect(continueStep({ programs: {}, answers: 2, resolved: 0 }, 0)).toBe('compare');
    expect(continueStep({ programs: {}, answers: 2, resolved: 0 }, 1)).toBe('list');
  });
});
