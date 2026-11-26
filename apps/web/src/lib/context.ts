import 'server-only';
import type { CoupleRow, InviteRow, ProfileRow, RankListRow, SpecialtyRow } from '@pairwise/db';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient } from './supabase/server';

export interface AppContext {
  user: { id: string; email: string };
  profile: ProfileRow;
  specialty: SpecialtyRow | null;
  couple: CoupleRow | null;
  role: 'a' | 'b' | null;
  partner: ProfileRow | null;
  openInvite: Pick<InviteRow, 'id' | 'email' | 'expires_at' | 'created_at'> | null;
  /** The couple's open list (both partners work in the same one). */
  list: Pick<RankListRow, 'id' | 'number' | 'name'> | null;
}

/** Everything the signed-in pages need about "me", my couple and my partner. Cached per request. */
export const getContext = cache(async (): Promise<AppContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: couples }] = await Promise.all([
    supabase.from('profiles').select('*').eq('user_id', user.id).single(),
    supabase.from('couples').select('*').neq('status', 'dissolved').order('created_at', { ascending: false }).limit(1),
  ]);
  if (!profile) return null;
  const couple = couples?.[0] ?? null;
  const role = couple ? (couple.partner_a === user.id ? 'a' : 'b') : null;
  const partnerId = couple ? (role === 'a' ? couple.partner_b : couple.partner_a) : null;

  const [{ data: specialty }, { data: partner }, { data: invites }, { data: list }] = await Promise.all([
    profile.specialty
      ? supabase.from('specialties').select('*').eq('code', profile.specialty).single()
      : Promise.resolve({ data: null }),
    partnerId ? supabase.from('profiles').select('*').eq('user_id', partnerId).single() : Promise.resolve({ data: null }),
    couple && couple.status === 'pending'
      ? supabase
          .from('invites')
          .select('id, email, expires_at, created_at')
          .eq('couple_id', couple.id)
          .is('accepted_at', null)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [] }),
    couple?.active_list
      ? supabase.from('rank_lists').select('id, number, name').eq('id', couple.active_list).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    user: { id: user.id, email: user.email ?? profile.email },
    profile,
    specialty: specialty ?? null,
    couple,
    role,
    partner: partner ?? null,
    openInvite: invites?.[0] ?? null,
    list: list ?? null,
  };
});

export async function requireContext(): Promise<AppContext> {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  return ctx;
}

/** Signed in and in a couple; otherwise back to setup. */
export async function requireCouple(): Promise<AppContext & { couple: CoupleRow }> {
  const ctx = await requireContext();
  if (!ctx.couple || !ctx.profile.specialty) redirect('/app/setup');
  return ctx as AppContext & { couple: CoupleRow };
}

export function displayName(p: Pick<ProfileRow, 'display_name' | 'email'> | null | undefined, fallback = 'Your partner') {
  return p?.display_name || p?.email?.split('@')[0] || fallback;
}
