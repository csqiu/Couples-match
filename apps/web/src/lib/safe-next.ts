/**
 * Where to go after signing in: a path on this site only (bug log #31). "/\evil.com" and
 * "//evil.com" start with "/" but browsers read them as another site, so the path is
 * resolved against a placeholder origin and must stay on it.
 */
export function safeNext(next: unknown, fallback = '/app'): string {
  if (typeof next !== 'string' || !next.startsWith('/') || /[\\\u0000-\u001f]/.test(next)) return fallback;
  try {
    const base = 'https://same.invalid';
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
