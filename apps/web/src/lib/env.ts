export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
/** Public URL of the app (invite links, auth redirects). On Vercel it falls back to the production domain. */
export const APP_URL =
  process.env.APP_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');
/** Password sign-in for automated tests and local development only. Never enabled in production. */
export const DEV_LOGIN_ENABLED = process.env.PAIRWISE_DEV_LOGIN === '1' && process.env.NODE_ENV !== 'production';
