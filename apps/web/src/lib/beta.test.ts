import { describe, expect, it } from 'vitest';
import { isBetaFull } from './beta';

describe('isBetaFull', () => {
  it('recognises the refusal Supabase Auth returns when the signup trigger fires', () => {
    expect(isBetaFull('Database error saving new user')).toBe(true);
    expect(isBetaFull('beta_full')).toBe(true);
    expect(isBetaFull('Email rate limit exceeded')).toBe(false);
    expect(isBetaFull(null)).toBe(false);
  });
});
