import { describe, expect, it } from 'vitest';
import { GUIDES } from '@/content/guides';
import { guideHtml } from './guide-html';

describe('guides', () => {
  const slugs = new Set(GUIDES.map((g) => g.slug));

  it('have unique slugs, titles and descriptions', () => {
    expect(slugs.size).toBe(GUIDES.length);
    for (const g of GUIDES) {
      expect(g.title.length).toBeGreaterThan(5);
      expect(g.description.length).toBeGreaterThan(20);
    }
  });

  it('link to each other by /guides paths, never to the draft docs', () => {
    for (const g of GUIDES) {
      expect(g.body, g.slug).not.toMatch(/claude\.ai/);
      for (const [, path] of g.body.matchAll(/\]\(\/guides\/([^)#]+)/g)) expect(slugs.has(path), `${g.slug} → ${path}`).toBe(true);
    }
  });

  it('render to HTML with tables, and external links open in a new tab', () => {
    const html = guideHtml(GUIDES.find((g) => g.slug === 'how-the-couples-match-works')!.body);
    expect(html).toContain('<table>');
    expect(html).toContain('id="two-orders"');
    expect(html).toMatch(/<a href="https:\/\/www\.nrmp\.org[^"]*" target="_blank" rel="noreferrer">/);
    expect(guideHtml(GUIDES.find((g) => g.slug === 'how-to-use-pairwise')!.body)).toContain('<a href="/guides/');
  });
});
