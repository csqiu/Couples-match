import { Marked } from 'marked';

const md = new Marked({ gfm: true });
md.use({
  renderer: {
    // Links to other sites open in a new tab; links between guides stay in place.
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const external = /^https?:\/\//.test(href);
      const t = title ? ` title="${title}"` : '';
      return `<a href="${href}"${t}${external ? ' target="_blank" rel="noreferrer"' : ''}>${text}</a>`;
    },
  },
});

/** A guide's Markdown as HTML. The text is our own (src/content/guides.ts), not user input. */
export function guideHtml(body: string): string {
  return md.parse(body, { async: false }) as string;
}
