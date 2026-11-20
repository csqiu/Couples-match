'use server';
import { redirect } from 'next/navigation';
import { APP_URL, DEV_LOGIN_ENABLED } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

export interface LoginState {
  sent?: string;
  error?: string;
}

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === 'string' ? next : '';
  return n.startsWith('/') && !n.startsWith('//') ? n : '/app';
}

export async function sendMagicLink(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter a valid email address.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${APP_URL}/auth/callback?next=${encodeURIComponent(safeNext(form.get('next')))}` },
  });
  if (error) return { error: error.status === 429 ? 'Too many sign-in emails. Try again in a few minutes.' : error.message };
  return { sent: email };
}

export async function signInWithGoogle(form: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${APP_URL}/auth/callback?next=${encodeURIComponent(safeNext(form.get('next')))}` },
  });
  if (error || !data.url) redirect('/login?error=google');
  redirect(data.url);
}

/** Password sign-in for automated tests and local development only. */
export async function devSignIn(_: LoginState, form: FormData): Promise<LoginState> {
  if (!DEV_LOGIN_ENABLED) return { error: 'Not available.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get('email') ?? ''),
    password: String(form.get('password') ?? ''),
  });
  if (error) return { error: error.message };
  redirect(safeNext(form.get('next')));
}
