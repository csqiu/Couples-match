'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@pairwise/db';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** The browser client (one per tab). Used for live updates; writes go through server actions. */
export function browserClient() {
  client ??= createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  return client;
}
