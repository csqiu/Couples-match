import type { NextConfig } from 'next';

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseWs = supabase.replace(/^http/, 'ws');
const dev = process.env.NODE_ENV !== 'production';

/**
 * Only the app itself, its Supabase project and the free map tiles may be
 * reached from the page. No third-party scripts or analytics (spec: rank lists
 * are sensitive). Next's hydration needs inline scripts; dev mode also needs eval.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org",
  "font-src 'self' data:",
  `connect-src 'self' ${supabase} ${supabaseWs} https://tiles.openfreemap.org`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const config: NextConfig = {
  // The engine, data and db packages are TypeScript sources in this monorepo.
  transpilePackages: ['@pairwise/engine', '@pairwise/data', '@pairwise/db'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ];
  },
};

export default config;
