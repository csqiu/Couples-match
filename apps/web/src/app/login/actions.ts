'use server';
import { redirect } from 'next/navigation';
import { APP_URL, DEV_LOGIN_ENABLED } from '@/lib/env';
import { BETA_FULL_MESSAGE, isBetaFull } from '@/lib/beta';
import { safeNext } from '@/lib/safe-next';
import { createClient } from '@/lib/supabase/server';

export interface LoginState {
  sent?: string;
  error?: string;
}

export async function sendMagicLink(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Enter a valid email address.' };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${APP_URL}/auth/callback?next=${encodeURIComponent(safeNext(form.get('next')))}` },
  });
  if (error) {
    if (error.status === 429) return { error: 'Too many sign-in emails. Try again in a few minutes.' };
    if (isBetaFull(error.message)) return { error: BETA_FULL_MESSAGE };
    return { error: error.message };
  }
  return { sent: email };
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
