'use server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const MESSAGES: Record<string, string> = {
  invite_invalid: 'This invite link has already been used or was cancelled. Ask your partner to send a new one.',
  invite_expired: 'This invite has expired. Ask your partner to send a new one.',
  invite_email_mismatch: 'You’re signed in with a different email than the one invited.',
  already_in_couple: 'You’re already in a couple for this match year.',
  different_match: 'You and your partner need to be in the same NRMP match.',
};

export async function acceptInvite(token: string, _: { error?: string }): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_invite', { p_token: token });
  if (error) {
    const key = Object.keys(MESSAGES).find((k) => error.message.includes(k));
    return { error: key ? MESSAGES[key] : error.message };
  }
  redirect('/app/setup?joined=1');
}
