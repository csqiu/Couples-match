'use server';
import { revalidatePath } from 'next/cache';
import { requireContext } from '@/lib/context';
import { createClient } from '@/lib/supabase/server';

export async function leaveCouple(): Promise<{ error?: string }> {
  const ctx = await requireContext();
  if (!ctx.couple) return { error: 'You’re not in a couple.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('leave_couple', { p_couple: ctx.couple.id });
  if (error) return { error: 'Couldn’t leave the couple. Try again.' };
  revalidatePath('/app', 'layout');
  return {};
}

/** Deletes the account and everything in it, then signs out. */
export async function deleteAccount(confirmation: string): Promise<{ error?: string }> {
  await requireContext();
  if (confirmation.trim().toLowerCase() !== 'delete') return { error: 'Type DELETE to confirm.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_my_account');
  if (error) return { error: 'Couldn’t delete your account. Try again.' };
  await supabase.auth.signOut();
  return {};
}
