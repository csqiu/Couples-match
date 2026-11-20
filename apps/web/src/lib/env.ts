export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
/** Password sign-in for automated tests and local development only. Never enabled in production. */
export const DEV_LOGIN_ENABLED = process.env.PAIRWISE_DEV_LOGIN === '1' && process.env.NODE_ENV !== 'production';
