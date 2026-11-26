import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next';

describe('safeNext', () => {
  it('keeps paths on this site', () => {
    expect(safeNext('/app/list')).toBe('/app/list');
    expect(safeNext('/invite/abc?x=1#y')).toBe('/invite/abc?x=1#y');
  });
  it('refuses anything that leaves the site', () => {
    for (const bad of ['//evil.com', '/\\evil.com', '/\\/evil.com', 'https://evil.com', 'evil.com', '/\t/evil.com', '', null, undefined]) {
      expect(safeNext(bad)).toBe('/app');
    }
  });
});
